/**
 * 🔒 CORE AUTOMATION ENGINE — LOCKED (MVP v1)
 *
 * This file is the single source of truth for automation execution across platforms:
 * - facebook
 * - instagram
 * - website
 * - whatsapp (future)
 *
 * ARCHITECTURAL RULES (DO NOT BREAK):
 * 1. Workspace rules ALWAYS run before AI fallback.
 * 2. Website platform MUST return replies directly (no external send).
 * 3. Facebook / Instagram / WhatsApp MUST send externally and return no reply.
 * 4. All messages MUST be persisted before sending.
 *
 * ⚠️ WARNING:
 * This file MUST NOT be modified casually.
 * Any change requires a deliberate, isolated refactor with owner approval.
 *
 * Status: LOCKED for MVP launch.
 */

import { createServerClient } from '../supabase/server';
import { createDirectMessage } from '../supabase/queries';
import { upsertConversation, insertMessage } from '@/lib/inbox/queries';
import { generateAgentResponseWithTracking } from '../openai/server';
import { env } from '../env';
import { sendCommentReply } from '../automation';
import { fbSendDM } from '../facebook';
import { igSendDM } from '../instagram';
import { waSendMessage } from '../whatsapp';

/* ============================================================================
   AI USAGE ENFORCEMENT (80% WARN, 100% HARD CUT)
============================================================================ */

async function enforceAiUsageOrThrow(
  supabase: any,
  workspaceId: string
): Promise<void> {
  const { data, error } = await supabase.rpc('check_ai_usage', {
    p_workspace_id: workspaceId,
  });

  if (error || !data) {
    console.error('[AI Usage] Failed check:', error);
    throw new Error('AI usage validation failed');
  }

  const { percent_used, hard_blocked } = data;

  if (percent_used >= 80 && percent_used < 100) {
    console.warn(`[AI Usage] Workspace ${workspaceId} at ${percent_used}%`);
  }

  if (hard_blocked || percent_used >= 100) {
    throw new Error('AI usage limit reached');
  }
}

/* ============================================================================
   TYPES
============================================================================ */

export interface AutomationInput {
  workspaceId: string;
  agentId: string;
  commentId?: string;
  commentText: string;
  authorId?: string;
  authorName?: string;
  platform: 'facebook' | 'instagram' | 'website';
  postId?: string;
  pageAccessToken?: string;
}

/* ============================================================================
   ENTRYPOINTS
============================================================================ */

export async function executeAutomationRulesForComment(
  input: AutomationInput
) {
  return executeAutomationRules(input);
}

export async function executeAutomationRulesForMessage(
  input: AutomationInput
) {
  return executeAutomationRules(input);
}

/* ============================================================================
   CORE EXECUTOR
============================================================================ */

async function executeWorkspaceRules(
  supabase: any,
  input: AutomationInput
): Promise<{ matched: boolean; reply?: string }> {
  const { workspaceId, agentId, commentText } = input;

  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('enabled', true);

  if (!rules?.length) {
    return { matched: false };
  }

  for (const rule of rules) {
    if (
      rule.trigger_words?.length &&
      !rule.trigger_words.some((w: string) =>
        commentText.toLowerCase().includes(w.toLowerCase())
      )
    ) {
      continue;
    }

    const result = await executeRuleActionFull(supabase, rule, input);
    if (result.reply) {
      return { matched: true, reply: result.reply };
    }
  }

  return { matched: false };
}

async function executeDefaultFallback(
  supabase: any,
  input: AutomationInput
): Promise<{ reply: string }> {
  const { workspaceId, agentId, commentText, authorId, authorName, platform, pageAccessToken } = input;

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Generate AI response
  const result = await generateAgentResponseWithTracking(
    workspaceId,
    agent.id,
    undefined, // sessionId
    agent.system_prompt,
    `Customer message: "${commentText}"`,
    platform,
    {
      model: agent.model,
      temperature: agent.temperature,
      max_tokens: 200,
    }
  );

  const reply = result.content;

  // Persist bot reply to inbox
  const conv = await upsertConversation(supabase, {
    workspaceId,
    agentId: agent.id,
    platform: platform as 'facebook' | 'instagram' | 'whatsapp' | 'website',
    externalThreadId: undefined,
    customerId: authorId || authorName,
    customerName: authorName || authorId,
    text: null,
  });

  await insertMessage(supabase, {
    workspaceId,
    conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
    sender: 'bot',
    content: `[Default AI] ${reply}`,
    externalMessageId: null,
    platform: platform as 'facebook' | 'instagram' | 'whatsapp' | 'website',
  });

  // For website, return the reply
  if (platform === 'website') {
    return { reply };
  }

  // 🔒 Platform dispatch boundary — behavior must remain deterministic

  // For other platforms, dispatch the message
  await dispatchPlatformMessage(supabase, platform, {
    authorId: authorId || authorName,
    message: reply,
    pageAccessToken,
  });

  return { reply };
}

async function dispatchPlatformMessage(
  supabase: any,
  platform: string,
  payload: { authorId: string; message: string; pageAccessToken: string }
): Promise<void> {
  const { authorId, message, pageAccessToken } = payload;

  if (platform === 'facebook') {
    const result = await fbSendDM(authorId, message, pageAccessToken);
    if (!result.success) {
      console.error(`[Automation] Failed to send Facebook DM:`, result.error);
    }
  } else if (platform === 'instagram') {
    const result = await igSendDM(authorId, message, pageAccessToken);
    if (!result.success) {
      console.error(`[Automation] Failed to send Instagram DM:`, result.error);
    }
  } else if (platform === 'whatsapp') {
    const result = await waSendMessage(authorId, message, pageAccessToken);
    if (!result.success) {
      console.error(`[Automation] Failed to send WhatsApp message:`, result.error);
    }
  }
}

export async function executeAutomationRules(
  input: AutomationInput
): Promise<{ ok: boolean; reply?: string }> {
  const supabase = await createServerClient();

  if (env.useMockMode) {
    return { ok: true };
  }

  const { workspaceId, agentId, commentText, platform } = input;

  // Try workspace rules first
  const workspaceResult = await executeWorkspaceRules(supabase, input);
  if (workspaceResult.matched) {
    return { ok: true, reply: workspaceResult.reply };
  }

  // Fall back to default AI
  const defaultResult = await executeDefaultFallback(supabase, input);
  return { ok: true, reply: defaultResult.reply };
}

/* ============================================================================
   ACTION DISPATCHER
============================================================================ */

async function executeRuleActionFull(
  supabase: any,
  rule: any,
  input: AutomationInput
): Promise<{ reply?: string }> {
  const { agentId } = input;

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) {
    throw new Error('Agent not found');
  }

  switch (rule.action_type) {
    case 'send_dm':
      return await executeSendDmAction(supabase, rule, input, agent);

    case 'send_public_reply':
      return await executeSendPublicReplyAction(supabase, rule, input, agent);

    default:
      return {};
  }
}

/* ============================================================================
   DM ACTION
============================================================================ */

async function executeSendDmAction(
  supabase: any,
  rule: any,
  input: AutomationInput,
  agent: any
): Promise<{ reply?: string }> {
  const { workspaceId, commentText, authorId, authorName, platform, pageAccessToken } = input;

  if (!authorId && !authorName) return {};

  let message = rule.private_reply_template || 'Thank you for reaching out.';

  if (rule.use_ai) {
    await enforceAiUsageOrThrow(supabase, workspaceId);

    const result = await generateAgentResponseWithTracking(
      workspaceId,
      agent.id,
      undefined, // sessionId
      agent.system_prompt,
      `Customer message: "${commentText}"`,
      platform,
      {
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: 200,
      }
    );

    message = result.content;
  }

  // Persist bot reply to inbox
  const conv = await upsertConversation(supabase, {
    workspaceId,
    agentId: agent.id,
    platform: platform as 'facebook' | 'instagram' | 'whatsapp' | 'website',
    externalThreadId: undefined,
    customerId: authorId || authorName,
    customerName: authorName || authorId,
    text: null,
  });

  await insertMessage(supabase, {
    workspaceId,
    conversation: { id: conv.id, type: conv.type as 'dm' | 'comment' },
    sender: 'bot',
    content: message,
    externalMessageId: null,
    platform: platform as 'facebook' | 'instagram' | 'whatsapp' | 'website',
  });

  // For website, return the reply
  if (platform === 'website') {
    return { reply: message };
  }

  // 🔒 Platform dispatch boundary — behavior must remain deterministic

  // For other platforms, dispatch the message
  await dispatchPlatformMessage(supabase, platform, {
    authorId: authorId || authorName,
    message,
    pageAccessToken,
  });

  return {};
}

/* ============================================================================
   PUBLIC COMMENT REPLY ACTION  ✅ (THIS WAS MISSING)
============================================================================ */

async function executeSendPublicReplyAction(
  supabase: any,
  rule: any,
  input: AutomationInput,
  agent: any
): Promise<{ reply?: string }> {
  const {
    workspaceId,
    commentText,
    commentId,
    postId,
    platform,
    pageAccessToken,
  } = input;

  if (!commentId || !postId) return {};

  let replyText = rule.public_reply_template || 'Thank you for your comment.';

  if (rule.use_ai) {
    await enforceAiUsageOrThrow(supabase, workspaceId);

    const result = await generateAgentResponseWithTracking(
      workspaceId,
      agent.id,
      undefined, // sessionId
      agent.system_prompt,
      `Reply publicly to: "${commentText}"`,
      platform,
      {
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: 200,
      }
    );

    replyText = result.content;
  }

  // For website, persist and return reply
  if (platform === 'website') {
    await insertMessage(supabase, {
      workspaceId,
      conversation: { id: commentId, type: 'comment' },
      sender: 'bot',
      content: replyText,
      externalMessageId: null,
      platform,
    });
    return { reply: replyText };
  }

  // For Meta platforms, send public reply
  if (platform === 'facebook' || platform === 'instagram') {
    await insertMessage(supabase, {
      workspaceId,
      conversation: { id: commentId, type: 'comment' },
      sender: 'bot',
      content: replyText,
      externalMessageId: null,
      platform,
    });

    await sendCommentReply(
      platform,
      postId,
      commentId,
      replyText,
      pageAccessToken
    );
  } else {
    console.log(`[Automation] Skipping public reply for unsupported platform: ${platform}`);
  }

  return {};
}
