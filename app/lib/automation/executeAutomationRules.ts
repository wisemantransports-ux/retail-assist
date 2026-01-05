/**
 * Automation Rules Execution Engine
 * Enforced with AI usage limits (grace cut-off)
 */

import { createServerClient } from '../supabase/server';
import { createDirectMessage } from '../supabase/queries';
import { upsertConversation, insertMessage } from '@/lib/inbox/queries';
import { generateAgentResponse } from '../openai/server';
import { env } from '../env';
import { sendCommentReply } from '../automation';

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
  return executeAutomation(input);
}

export async function executeAutomationRulesForMessage(
  input: AutomationInput
) {
  return executeAutomation(input);
}

/* ============================================================================
   CORE EXECUTOR
============================================================================ */

async function executeAutomation(input: AutomationInput) {
  const supabase = await createServerClient();

  if (env.useMockMode) {
    return { ok: true };
  }

  const { workspaceId, agentId, commentText, platform } = input;

  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_id', agentId)
    .eq('enabled', true);

  if (!rules?.length) {
    return { ok: true };
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

    await executeRuleActionFull(supabase, rule, input);
  }

  return { ok: true };
}

/* ============================================================================
   ACTION DISPATCHER
============================================================================ */

async function executeRuleActionFull(
  supabase: any,
  rule: any,
  input: AutomationInput
): Promise<void> {
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
      await executeSendDmAction(supabase, rule, input, agent);
      break;

    case 'send_public_reply':
      await executeSendPublicReplyAction(supabase, rule, input, agent);
      break;
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
) {
  const { workspaceId, commentText, authorId, authorName } = input;

  if (!authorId && !authorName) return;

  let message = rule.private_reply_template || 'Thank you for reaching out.';

  if (rule.use_ai) {
    await enforceAiUsageOrThrow(supabase, workspaceId);

    message = await generateAgentResponse(
      agent.system_prompt,
      `Customer message: "${commentText}"`,
      {
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: 200,
      }
    );
  }

  // Persist bot reply to inbox before sending. Use the inbox helpers so we
  // consistently map to existing tables. This will throw on failure.
  const conv = await upsertConversation(supabase, {
    workspaceId,
    agentId: agent.id,
    platform: 'facebook',
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
    platform: 'facebook',
  });
}

/* ============================================================================
   PUBLIC COMMENT REPLY ACTION  ✅ (THIS WAS MISSING)
============================================================================ */

async function executeSendPublicReplyAction(
  supabase: any,
  rule: any,
  input: AutomationInput,
  agent: any
) {
  const {
    workspaceId,
    commentText,
    commentId,
    postId,
    platform,
    pageAccessToken,
  } = input;

  if (!commentId || !postId) return;

  let replyText = rule.public_reply_template || 'Thank you for your comment.';

  if (rule.use_ai) {
    await enforceAiUsageOrThrow(supabase, workspaceId);

    replyText = await generateAgentResponse(
      agent.system_prompt,
      `Reply publicly to: "${commentText}"`,
      {
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: 200,
      }
    );
  }

  // Only send public replies to supported platforms (Meta platforms)
  if (platform === 'facebook' || platform === 'instagram') {
    // Persist the bot public reply in our inbox before sending the platform reply.
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
}
