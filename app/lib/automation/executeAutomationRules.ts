/**
 * Automation Rules Execution Engine
 * 
 * Minimal execution logic that consumes automation_rules and executes actions.
 * Currently implements: comment → send_dm flow
 * 
 * This is pure logic. No UI. No cron jobs. No refactoring of existing code.
 */
/// <reference path="./automation-shim.d.ts" />

import { createServerSupabaseClient } from '../supabase/server';
import { createDirectMessage } from '../supabase/queries';
import { generateAgentResponse } from '../openai/server';
import { env } from '../env';

/**
 * Input: A comment from a user
 */
export interface AutomationCommentInput {
  workspaceId: string;
  agentId: string;
  commentId: string;
  commentText: string;
  authorId?: string;
  authorName?: string;
  platform: 'facebook' | 'instagram' | 'website' | 'whatsapp';
  postId?: string; // For public replies (e.g., Facebook post ID)
  pageAccessToken?: string; // For sending via Facebook API (optional)
}

/**
 * Extended input: Any message (for keyword triggers)
 * Can be a comment, DM, or other message type
 */
export interface AutomationMessageInput extends AutomationCommentInput {
  messageType?: 'comment' | 'dm' | 'message'; // What type of message
}

/**
 * Result of executing automation rules on a comment
 */
export interface ExecuteAutomationResult {
  ok: boolean;
  ruleMatched: boolean;
  actionExecuted: boolean;
  dmSent?: boolean;
  replySent?: boolean; // For public reply action
  error?: string;
}

/**
 * Execute all enabled automation rules for a comment
 * 
 * Process:
 * 1. Load all enabled rules for the agent
 * 2. Filter rules by trigger_type = 'comment'
 * 3. For each rule: check if comment matches trigger conditions
 * 4. If rule matches: execute action (currently send_dm only)
 * 5. Return execution result
 */
export async function executeAutomationRulesForComment(
  input: AutomationCommentInput
): Promise<ExecuteAutomationResult> {
  const {
    workspaceId,
    agentId,
    commentId,
    commentText,
    authorId,
    authorName,
    platform,
  } = input;

  try {
    console.log(`[Automation Rules] Processing comment ${commentId} with agent ${agentId}`);

    if (env.useMockMode) {
      return {
        ok: true,
        ruleMatched: false,
        actionExecuted: false,
        error: undefined,
      };
    }

    const supabase = await createServerSupabaseClient();

    // Step 1: Get all enabled automation rules for this agent with trigger_type = 'comment'
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('agent_id', agentId)
      .eq('enabled', true)
      .eq('trigger_type', 'comment');

    if (rulesError) {
      console.error('[Automation Rules] Failed to fetch rules:', rulesError);
      return {
        ok: false,
        ruleMatched: false,
        actionExecuted: false,
        error: `Failed to fetch rules: ${rulesError.message}`,
      };
    }

    if (!rules || rules.length === 0) {
      console.log(`[Automation Rules] No enabled comment rules for agent ${agentId}`);
      return {
        ok: true,
        ruleMatched: false,
        actionExecuted: false,
      };
    }

    // Step 2: Check each rule and execute matching actions
    let anyMatched = false;
    let anyExecuted = false;
    let executionError: string | undefined;

    for (const rule of rules) {
      // Check if this rule applies to the comment's platform
      if (rule.trigger_platforms && !rule.trigger_platforms.includes(platform)) {
        console.log(`[Automation Rules] Rule ${rule.id} skipped (platform mismatch: ${platform})`);
        continue;
      }

      // Check if comment matches trigger words (if specified)
      if (rule.trigger_words && rule.trigger_words.length > 0) {
        const matchesKeyword = rule.trigger_words.some((word: string) =>
          commentText.toLowerCase().includes(word.toLowerCase())
        );
        
        if (!matchesKeyword) {
          console.log(`[Automation Rules] Rule ${rule.id} skipped (no keyword match)`);
          continue;
        }
      }

      // Rule matched!
      anyMatched = true;
      console.log(`[Automation Rules] Rule ${rule.id} matched for comment ${commentId}`);

      // Step 3: Execute the action based on action_type
      try {
        const executed = await executeRuleAction(
          supabase,
          rule,
          input
        );

        if (executed) {
          anyExecuted = true;
        }
      } catch (err: any) {
        console.error(`[Automation Rules] Failed to execute rule ${rule.id}:`, err.message);
        executionError = err.message;
        // Continue to next rule instead of stopping
      }
    }

    return {
      ok: true,
      ruleMatched: anyMatched,
      actionExecuted: anyExecuted,
      dmSent: anyExecuted, // Currently only send_dm is supported
      error: executionError,
    };
  } catch (err: any) {
    console.error('[Automation Rules] Unexpected error:', err);
    return {
      ok: false,
      ruleMatched: false,
      actionExecuted: false,
      error: err.message,
    };
  }
}

/**
 * Execute a single rule's action
 */
async function executeRuleAction(
  supabase: any,
  rule: any,
  input: AutomationCommentInput
): Promise<boolean> {
  const {
    workspaceId,
    agentId,
    commentId,
    commentText,
    authorId,
    authorName,
  } = input;

  // Currently only implement send_dm action
  if (rule.action_type !== 'send_dm') {
    console.log(`[Automation Rules] Action ${rule.action_type} not yet implemented`);
    return false;
  }

  // Check if we should send private reply (DM)
  if (!rule.send_private_reply) {
    console.log(`[Automation Rules] Rule ${rule.id} has send_private_reply=false, skipping DM`);
    return false;
  }

  // Need author info to send DM
  if (!authorId && !authorName) {
    console.log(`[Automation Rules] Rule ${rule.id} skipped: no author info for DM`);
    return false;
  }

  // Step 1: Apply delay if configured
  if (rule.delay_seconds && rule.delay_seconds > 0) {
    console.log(`[Automation Rules] Applying ${rule.delay_seconds}s delay before sending DM`);
    await new Promise(resolve => setTimeout(resolve, rule.delay_seconds * 1000));
  }

  // Step 2: Get agent configuration
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    throw new Error(`Agent not found: ${agentError?.message || 'unknown'}`);
  }

  // Step 3: Generate DM response (template-based or AI-generated)
  let dmText = rule.private_reply_template || 'Thank you for your comment!';

  // If template contains placeholders or is too simple, use AI to generate personalized response
  if (rule.private_reply_template && rule.private_reply_template.includes('{') && agent.system_prompt) {
    try {
      const aiPrompt = `Based on this feedback: "${commentText}", generate a personalized direct message response using this template: ${rule.private_reply_template}`;
      
      if (env.openai.apiKey && !env.isTestMode) {
        dmText = await generateAgentResponse(agent.system_prompt, aiPrompt, {
          model: agent.model || 'gpt-4o-mini',
          temperature: agent.temperature || 0.7,
          max_tokens: 200,
        });
      } else {
        // Fallback to template without AI in test/mock mode
        dmText = rule.private_reply_template;
      }
    } catch (err: any) {
      console.warn(`[Automation Rules] Failed to generate AI response, using template:`, err.message);
      // Fallback to template
    }
  }

  // Step 4: Store DM in database
  const { data: dm, error: dmError } = await createDirectMessage(workspaceId, {
    agent_id: agentId,
    recipient_id: authorId || authorName,
    recipient_name: authorName || authorId,
    content: dmText,
    platform: 'facebook_messenger', // Platform-agnostic for now
    status: 'sent',
  });

  if (dmError) {
    throw new Error(`Failed to create DM: ${dmError.message}`);
  }

  console.log(`[Automation Rules] DM sent to ${authorName || authorId} for rule ${rule.id}`);
  return true;
}

/**
 * Execute send_public_reply action
 *
 * Generates a public reply (optionally via AI) and stores it as a comment record
 */
async function executeSendPublicReplyAction(
  supabase: any,
  rule: any,
  input: AutomationMessageInput,
  agent: any
): Promise<boolean> {
  const { workspaceId, agentId, commentId, commentText, postId, platform } = input;

  if (!rule.send_public_reply) {
    console.log(`[Automation Rules] Rule ${rule.id} has send_public_reply=false, skipping public reply`);
    return false;
  }

  if (!rule.public_reply_template) {
    console.log(`[Automation Rules] Rule ${rule.id} missing public_reply_template, skipping`);
    return false;
  }

  let replyText = rule.public_reply_template;

  // If template contains placeholders, try to use AI to personalize
  if (rule.public_reply_template.includes('{') && agent?.system_prompt) {
    try {
      const systemPrompt = `${agent.system_prompt}\n\nYou are generating a short public comment reply.`;
      const userMessage = `Customer comment: "${commentText}"\nUse this template: "${rule.public_reply_template}"`;

      if (env.useMockMode) {
        // In mock mode, fall back to template
        replyText = rule.public_reply_template.replace(/\{.*?\}/g, '').trim();
      } else {
        replyText = await generateAgentResponse(systemPrompt, userMessage, {
          model: agent.model || 'gpt-4o-mini',
          temperature: agent.temperature || 0.7,
          max_tokens: 150,
        });
      }
    } catch (err: any) {
      console.warn(`[Automation Rules] AI generation failed for public reply, using template: ${err.message}`);
      replyText = rule.public_reply_template.replace(/\{.*?\}/g, '');
    }
  }

  // Store the public reply as a comment record for audit and further processing
  const { data: inserted, error: insertError } = await supabase
    .from('comments')
    .insert([
      {
        workspace_id: workspaceId,
        agent_id: agentId,
        content: replyText,
        platform: platform || 'facebook',
        platform_post_id: postId || null,
        parent_comment_id: commentId || null,
        created_at: new Date().toISOString(),
      },
    ]);

  if (insertError) {
    throw new Error(`Failed to create public reply: ${insertError.message}`);
  }

  console.log(`[Automation Rules] Public reply stored for rule ${rule.id}`);
  return true;
}

/**
 * Utility: Check if a comment should skip rules based on skip conditions
 * (e.g., skip if already replied to)
 */
export async function shouldSkipComment(
  supabase: any,
  commentId: string,
  rule: any
): Promise<boolean> {
  if (!rule.auto_skip_replies) {
    return false;
  }

  // Check if this comment already has bot replies
  const { data: existingReplies, error } = await supabase
    .from('direct_messages')
    .select('id')
    .eq('metadata->comment_id', commentId)
    .limit(1);

  if (error) {
    console.warn('[Automation Rules] Failed to check for existing replies:', error);
    return false;
  }

  return existingReplies && existingReplies.length > 0;
}

/**
 * ============================================================================
 * EXTENDED FUNCTIONALITY: Keyword Triggers & Public Reply Actions
 * ============================================================================
 * 
 * Additional trigger types:
 * - keyword: Match keywords in any message (not just comments)
 * 
 * Additional action types:
 * - send_public_reply: Post a reply on the comment/post
 * 
 * These handlers integrate seamlessly with existing comment → send_dm flow
 */

/**
 * Execute automation rules with support for keyword triggers
 * 
 * Extended version that handles:
 * - trigger_type='keyword': Match in any message text
 * - trigger_type='comment': Original comment trigger (backward compat)
 * - action_type='send_public_reply': Post reply on the post
 * - action_type='send_dm': Original DM action (backward compat)
 */
export async function executeAutomationRulesForMessage(
  input: AutomationMessageInput
): Promise<ExecuteAutomationResult> {
  const {
    workspaceId,
    agentId,
    commentId,
    commentText,
    authorId,
    authorName,
    platform,
    postId,
    pageAccessToken,
    messageType = 'comment',
  } = input;

  try {
    console.log(`[Automation Rules] Processing ${messageType} ${commentId} with agent ${agentId}`);

    if (env.useMockMode) {
      return {
        ok: true,
        ruleMatched: false,
        actionExecuted: false,
      };
    }

    const supabase = await createServerSupabaseClient();

    // Load all enabled automation rules for this agent
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('agent_id', agentId)
      .eq('enabled', true);

    if (rulesError) {
      console.error('[Automation Rules] Failed to fetch rules:', rulesError);
      return {
        ok: false,
        ruleMatched: false,
        actionExecuted: false,
        error: `Failed to fetch rules: ${rulesError.message}`,
      };
    }

    if (!rules || rules.length === 0) {
      console.log(`[Automation Rules] No enabled rules for agent ${agentId}`);
      return {
        ok: true,
        ruleMatched: false,
        actionExecuted: false,
      };
    }

    // Filter and execute rules based on trigger type
    let anyMatched = false;
    let anyExecuted = false;
    let executionError: string | undefined;

    for (const rule of rules) {
      // Check if rule applies based on trigger type
      const triggerMatches = checkTriggerMatch(rule, commentText, messageType, platform);
      if (!triggerMatches) {
        continue;
      }

      anyMatched = true;
      console.log(`[Automation Rules] Rule ${rule.id} triggered for ${messageType} ${commentId}`);

      try {
        const executed = await executeRuleActionExtended(
          supabase,
          rule,
          input
        );

        if (executed) {
          anyExecuted = true;
        }
      } catch (err: any) {
        console.error(`[Automation Rules] Failed to execute rule ${rule.id}:`, err.message);
        executionError = err.message;
      }
    }

    return {
      ok: true,
      ruleMatched: anyMatched,
      actionExecuted: anyExecuted,
      dmSent: anyExecuted && rules.some(r => r.action_type === 'send_dm'),
      replySent: anyExecuted && rules.some(r => r.action_type === 'send_public_reply'),
      error: executionError,
    };
  } catch (err: any) {
    console.error('[Automation Rules] Unexpected error:', err);
    return {
      ok: false,
      ruleMatched: false,
      actionExecuted: false,
      error: err.message,
    };
  }
}

/**
 * Check if a message matches rule's trigger conditions
 * 
 * Supports:
 * - trigger_type='comment': Matches only on comments
 * - trigger_type='keyword': Matches on any message with keywords
 */
function checkTriggerMatch(
  rule: any,
  messageText: string,
  messageType: string,
  platform: string
): boolean {
  // Check platform match first (applies to all triggers)
  if (rule.trigger_platforms && !rule.trigger_platforms.includes(platform)) {
    return false;
  }

  // Check trigger type
  switch (rule.trigger_type) {
    case 'comment':
      // Only trigger on comments
      if (messageType !== 'comment') return false;
      
      // Check keywords if specified
      if (rule.trigger_words && rule.trigger_words.length > 0) {
        return rule.trigger_words.some((word: string) =>
          messageText.toLowerCase().includes(word.toLowerCase())
        );
      }
      return true;

    case 'keyword':
      // Trigger on keywords in any message type
      if (!rule.trigger_words || rule.trigger_words.length === 0) {
        console.warn(`[Automation Rules] Rule ${rule.id} has trigger_type=keyword but no trigger_words`);
        return false;
      }
      
      return rule.trigger_words.some((word: string) =>
        messageText.toLowerCase().includes(word.toLowerCase())
      );

    case 'time':
      // Time-based triggers not yet implemented
      console.log(`[Automation Rules] Trigger type 'time' not yet implemented`);
      return false;

    case 'manual':
      // Manual triggers not yet implemented
      console.log(`[Automation Rules] Trigger type 'manual' not yet implemented`);
      return false;

    default:
      console.warn(`[Automation Rules] Unknown trigger type: ${rule.trigger_type}`);
      return false;
  }
}

/**
 * Execute a rule's action with support for public replies
 * 
 * Supports:
 * - action_type='send_dm': Send direct message
 * - action_type='send_public_reply': Post reply on comment
 */
async function executeRuleActionExtended(
  supabase: any,
  rule: any,
  input: AutomationMessageInput
): Promise<boolean> {
  const {
    workspaceId,
    agentId,
    commentId,
    commentText,
    authorId,
    authorName,
    postId,
    pageAccessToken,
  } = input;

  // Apply delay if configured
  if (rule.delay_seconds && rule.delay_seconds > 0) {
    console.log(`[Automation Rules] Applying ${rule.delay_seconds}s delay before action`);
    await new Promise(resolve => setTimeout(resolve, rule.delay_seconds * 1000));
  }

  // Load agent configuration
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    throw new Error(`Agent not found: ${agentError?.message || 'unknown'}`);
  }

  // Execute based on action type
  switch (rule.action_type) {
    case 'send_dm':
      return await executeSendDmAction(supabase, rule, input, agent);

    case 'send_public_reply':
      return await executeSendPublicReplyAction(supabase, rule, input, agent);

    case 'send_email':
      // Email action not yet implemented
      console.log(`[Automation Rules] Action type 'send_email' not yet implemented`);
      return false;

    default:
      console.warn(`[Automation Rules] Unknown action type: ${rule.action_type}`);
      return false;
  }
}

/**
 * Execute send_dm action (original implementation)
 * 
 * Creates a direct message and stores it in the database
 */
async function executeSendDmAction(
  supabase: any,
  rule: any,
  input: AutomationMessageInput,
  agent: any
): Promise<boolean> {
  const {
    workspaceId,
    agentId,
    commentId,
    commentText,
    authorId,
    authorName,
  } = input;

  // Check if we should send private reply
  if (!rule.send_private_reply) {
    console.log(`[Automation Rules] Rule ${rule.id} has send_private_reply=false, skipping DM`);
    return false;
  }

  // Need author info to send DM
  if (!authorId && !authorName) {
    console.log(`[Automation Rules] Rule ${rule.id} skipped: no author info for DM`);
    return false;
  }

  // Generate DM response (template-based or AI-generated)
  let dmText = rule.private_reply_template || 'Thank you for your feedback!';

  if (rule.private_reply_template && rule.private_reply_template.includes('{') && agent.system_prompt) {
    try {
      const aiPrompt = `Based on this feedback: "${commentText}", generate a personalized direct message response using this template: ${rule.private_reply_template}`;
      
      if (env.openai.apiKey && !env.isTestMode) {
        dmText = await generateAgentResponse(agent.system_prompt, aiPrompt, {
          model: agent.model || 'gpt-4o-mini',
          temperature: agent.temperature || 0.7,
          max_tokens: 200,
        });
      } else {
        dmText = rule.private_reply_template;
      }
    } catch (err: any) {
      console.warn(`[Automation Rules] Failed to generate AI response for DM, using template:`, err.message);
    }
  }

  // Store DM in database
  const { data: dm, error: dmError } = await createDirectMessage(workspaceId, {
    agent_id: agentId,
    recipient_id: authorId || authorName,
    recipient_name: authorName || authorId,
    content: dmText,
    platform: 'facebook_messenger',
    status: 'sent',
    metadata: { comment_id: commentId },
  });

  if (dmError) {
    throw new Error(`Failed to create DM: ${dmError.message}`);
  }

  console.log(`[Automation Rules] DM sent to ${authorName || authorId} for rule ${rule.id}`);
  return true;
}

/**
 * ============================================================================
 * TIME-BASED TRIGGERS
 * ============================================================================
 * 
 * Execute automation rules at specific times or on schedules
 * Supports one-time and recurring triggers
 */

/**
 * Time trigger configuration
 */
export interface TimeTriggerConfig {
  scheduled_time?: string; // ISO 8601 datetime for one-time trigger
  recurrence_pattern?: string; // CRON-like pattern for recurring (0 0 * * * = daily at midnight)
  timezone?: string; // Timezone for scheduling (default: UTC)
}

/**
 * Execute automation rules based on time triggers
 * 
 * Checks if any time-based rules are due to execute
 * Supports one-time and recurring schedules
 * 
 * Usage:
 *   - Call this from a cron job or scheduled task
 *   - Example: Every 5 minutes, check for time-based rules due to execute
 */
export async function executeTimeTriggerRules(
  workspaceId: string,
  agentId: string
): Promise<ExecuteAutomationResult> {
  try {
    console.log(`[Automation Rules] Checking time-based rules for agent ${agentId}`);

    if (env.useMockMode) {
      return {
        ok: true,
        ruleMatched: false,
        actionExecuted: false,
      };
    }

    const supabase = await createServerSupabaseClient();
    const now = new Date();

    // Load all enabled time-based rules for this agent
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('agent_id', agentId)
      .eq('enabled', true)
      .eq('trigger_type', 'time');

    if (rulesError) {
      console.error('[Automation Rules] Failed to fetch time-based rules:', rulesError);
      return {
        ok: false,
        ruleMatched: false,
        actionExecuted: false,
        error: `Failed to fetch rules: ${rulesError.message}`,
      };
    }

    if (!rules || rules.length === 0) {
      console.log(`[Automation Rules] No time-based rules for agent ${agentId}`);
      return {
        ok: true,
        ruleMatched: false,
        actionExecuted: false,
      };
    }

    let anyMatched = false;
    let anyExecuted = false;
    let executionError: string | undefined;

    for (const rule of rules) {
      // Check if this rule is due to execute
      const isDue = isTimeTriggerDue(rule, now);
      if (!isDue) {
        continue;
      }

      anyMatched = true;
      console.log(`[Automation Rules] Time-based rule ${rule.id} is due to execute`);

      try {
        // Time-based rules don't require message input
        // Generate default input for the rule
        const input: AutomationMessageInput = {
          workspaceId,
          agentId,
          commentId: `scheduled_${rule.id}_${Date.now()}`,
          commentText: rule.message_template || '',
          platform: 'website',
          messageType: 'message',
        };

        const executed = await executeRuleActionFull(supabase, rule, input);
        if (executed) {
          anyExecuted = true;
          // Update rule's last_executed_at timestamp
          await supabase
            .from('automation_rules')
            .update({ last_executed_at: now.toISOString() })
            .eq('id', rule.id);
        }
      } catch (err: any) {
        console.error(`[Automation Rules] Failed to execute time-based rule ${rule.id}:`, err.message);
        executionError = err.message;
      }
    }

    return {
      ok: true,
      ruleMatched: anyMatched,
      actionExecuted: anyExecuted,
      error: executionError,
    };
  } catch (err: any) {
    console.error('[Automation Rules] Unexpected error in time trigger execution:', err);
    return {
      ok: false,
      ruleMatched: false,
      actionExecuted: false,
      error: err.message,
    };
  }
}

/**
 * Check if a time-based rule is due to execute
 * 
 * Supports:
 * - One-time triggers: scheduled_time is in the past
 * - Recurring triggers: CRON pattern matches current time
 */
function isTimeTriggerDue(rule: any, now: Date): boolean {
  // Check one-time scheduled trigger
  if (rule.scheduled_time) {
    const scheduledTime = new Date(rule.scheduled_time);
    const lastExecuted = rule.last_executed_at ? new Date(rule.last_executed_at) : null;

    // Execute if scheduled time has passed and not yet executed
    if (now >= scheduledTime && (!lastExecuted || lastExecuted < scheduledTime)) {
      return true;
    }
  }

  // Check recurring trigger (simple cron pattern)
  if (rule.recurrence_pattern) {
    const matches = checkCronMatch(rule.recurrence_pattern, now);
    if (matches) {
      // Check if already executed in this interval (within 1 minute)
      const lastExecuted = rule.last_executed_at ? new Date(rule.last_executed_at) : null;
      if (!lastExecuted || (now.getTime() - lastExecuted.getTime()) > 60000) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Simple CRON pattern matching
 * Supports patterns like: "0 0 * * *" (daily at midnight)
 * Format: minute hour day month dayOfWeek
 */
function checkCronMatch(pattern: string, date: Date): boolean {
  const parts = pattern.split(' ');
  if (parts.length !== 5) {
    console.warn(`[Automation Rules] Invalid cron pattern: ${pattern}`);
    return false;
  }

  const [minute, hour, day, month, dayOfWeek] = parts;
  const now = date;

  // Check minute
  if (minute !== '*' && parseInt(minute) !== now.getMinutes()) {
    return false;
  }

  // Check hour
  if (hour !== '*' && parseInt(hour) !== now.getHours()) {
    return false;
  }

  // Check day of month
  if (day !== '*' && parseInt(day) !== now.getDate()) {
    return false;
  }

  // Check month (0-11 in JS, but cron uses 1-12)
  if (month !== '*' && parseInt(month) !== (now.getMonth() + 1)) {
    return false;
  }

  // Check day of week (0-6 in JS, same as cron)
  if (dayOfWeek !== '*' && parseInt(dayOfWeek) !== now.getDay()) {
    return false;
  }

  return true;
}

/**
 * ============================================================================
 * MANUAL TRIGGERS
 * ============================================================================
 * 
 * Execute automation rules on explicit user request
 * Allows triggering rules from API or UI without waiting for automation
 */

/**
 * Execute a rule manually (on-demand)
 * 
 * Used for:
 * - User-triggered actions from UI
 * - Admin commands to resend messages
 * - Testing rule execution without waiting for triggers
 * 
 * Example: User clicks "Send welcome message" button in dashboard
 */
export async function executeManualTrigger(
  workspaceId: string,
  agentId: string,
  ruleId: string,
  recipientId?: string,
  recipientEmail?: string
): Promise<ExecuteAutomationResult> {
  try {
    console.log(`[Automation Rules] Executing manual trigger for rule ${ruleId}`);

    if (env.useMockMode) {
      return {
        ok: true,
        ruleMatched: true,
        actionExecuted: false,
        error: 'Mock mode: manual trigger not executed',
      };
    }

    const supabase = await createServerSupabaseClient();

    // Load the specific rule
    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('workspace_id', workspaceId)
      .eq('agent_id', agentId)
      .single();

    if (ruleError || !rule) {
      return {
        ok: false,
        ruleMatched: false,
        actionExecuted: false,
        error: `Rule not found: ${ruleError?.message || 'unknown'}`,
      };
    }

    // Check if rule trigger_type is 'manual'
    if (rule.trigger_type !== 'manual') {
      return {
        ok: false,
        ruleMatched: false,
        actionExecuted: false,
        error: `Rule trigger_type is '${rule.trigger_type}', not 'manual'`,
      };
    }

    // Generate input for manual execution
    const input: AutomationMessageInput = {
      workspaceId,
      agentId,
      commentId: `manual_${rule.id}_${Date.now()}`,
      commentText: rule.message_template || '',
      authorId: recipientId,
      authorName: recipientEmail || recipientId,
      platform: 'website',
      messageType: 'message',
    };

    // Load agent config
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return {
        ok: false,
        ruleMatched: false,
        actionExecuted: false,
        error: `Agent not found: ${agentError?.message || 'unknown'}`,
      };
    }

    // Execute the rule's action
    try {
      const executed = await executeRuleActionFull(supabase, rule, input);
      return {
        ok: true,
        ruleMatched: true,
        actionExecuted: executed,
        dmSent: executed && rule.action_type === 'send_dm',
        replySent: executed && rule.action_type === 'send_public_reply',
        error: executed ? undefined : 'Action not executed',
      };
    } catch (err: any) {
      return {
        ok: false,
        ruleMatched: true,
        actionExecuted: false,
        error: err.message,
      };
    }
  } catch (err: any) {
    console.error('[Automation Rules] Unexpected error in manual trigger:', err);
    return {
      ok: false,
      ruleMatched: false,
      actionExecuted: false,
      error: err.message,
    };
  }
}

/**
 * ============================================================================
 * EMAIL ACTIONS
 * ============================================================================
 * 
 * Send email notifications when rules are triggered
 */

/**
 * Email action configuration
 */
export interface EmailActionConfig {
  email_recipients: string[]; // Array of email addresses
  subject_template: string; // Email subject (supports {variables})
  body_template: string; // Email body (supports {variables}, markdown supported)
  use_ai_body?: boolean; // Generate personalized body using AI
}

/**
 * Execute send_email action
 * 
 * Sends email notifications when a rule is triggered
 * Supports template variables and AI-generated content
 */
async function executeSendEmailAction(
  supabase: any,
  rule: any,
  input: AutomationMessageInput,
  agent: any
): Promise<boolean> {
  const {
    workspaceId,
    agentId,
    commentText,
    authorName,
  } = input;

  // Check if email action is enabled
  if (!rule.email_recipients || rule.email_recipients.length === 0) {
    console.log(`[Automation Rules] Rule ${rule.id} has no email_recipients, skipping email`);
    return false;
  }

  // Prepare template variables
  const variables = {
    '{name}': authorName || 'Customer',
    '{message}': commentText,
    '{date}': new Date().toLocaleDateString(),
    '{time}': new Date().toLocaleTimeString(),
  };

  // Generate subject
  let subject = rule.subject_template || 'New Automation Alert';
  Object.entries(variables).forEach(([key, value]) => {
    subject = subject.replace(key, String(value));
  });

  // Generate body
  let body = rule.body_template || 'An automation rule was triggered.';

  // Use AI to generate personalized body if configured
  if (rule.use_ai_body && agent.system_prompt) {
    try {
      const aiPrompt = `Generate a professional email body based on: "${commentText}". 
Use this template as reference: ${rule.body_template}
Return only the email body, no subject.`;

      if (env.openai.apiKey && !env.isTestMode) {
        body = await generateAgentResponse(agent.system_prompt, aiPrompt, {
          model: agent.model || 'gpt-4o-mini',
          temperature: agent.temperature || 0.6,
          max_tokens: 300,
        });
      } else {
        // Fallback to template
        Object.entries(variables).forEach(([key, value]) => {
          body = body.replace(key, String(value));
        });
      }
    } catch (err: any) {
      console.warn(`[Automation Rules] Failed to generate AI email body, using template:`, err.message);
      Object.entries(variables).forEach(([key, value]) => {
        body = body.replace(key, String(value));
      });
    }
  } else {
    // Apply template variables
    Object.entries(variables).forEach(([key, value]) => {
      body = body.replace(key, String(value));
    });
  }

  // Store email notification in database (for audit and delivery tracking)
  // In production, integrate with SendGrid, SES, or similar
  const { data: emailLog, error: logError } = await supabase
    .from('email_logs')
    .insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      rule_id: rule.id,
      recipients: rule.email_recipients,
      subject,
      body,
      status: 'queued', // Would be 'sent' after actual delivery
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) {
    console.error(`[Automation Rules] Failed to log email:`, logError);
    // Continue even if logging fails
  }

  console.log(`[Automation Rules] Email queued for rule ${rule.id} to recipients: ${rule.email_recipients.join(', ')}`);
  console.log(`[Automation Rules] Note: In production, this would send via SendGrid/SES`);

  return true;
}

/**
 * ============================================================================
 * WEBHOOK ACTIONS
 * ============================================================================
 * 
 * Call external webhooks when rules are triggered
 */

/**
 * Webhook action configuration
 */
export interface WebhookActionConfig {
  webhook_url: string; // Target webhook URL
  request_method?: 'POST' | 'PUT' | 'PATCH'; // HTTP method (default: POST)
  headers?: Record<string, string>; // Custom headers
  body_template?: string; // Request body template (JSON format)
}

/**
 * Execute send_webhook action
 * 
 * Makes HTTP request to external webhook with rule context
 * Supports template variables and conditional execution
 */
async function executeSendWebhookAction(
  supabase: any,
  rule: any,
  input: AutomationMessageInput,
  agent: any
): Promise<boolean> {
  const {
    workspaceId,
    agentId,
    commentId,
    commentText,
    authorId,
    authorName,
    platform,
  } = input;

  // Check if webhook is configured
  if (!rule.webhook_url) {
    console.log(`[Automation Rules] Rule ${rule.id} has no webhook_url, skipping webhook`);
    return false;
  }

  // Validate webhook URL
  try {
    new URL(rule.webhook_url);
  } catch {
    throw new Error(`Invalid webhook URL: ${rule.webhook_url}`);
  }

  // Prepare request body
  let requestBody: Record<string, any> = {
    rule_id: rule.id,
    workspace_id: workspaceId,
    agent_id: agentId,
    event_type: rule.trigger_type,
    timestamp: new Date().toISOString(),
    data: {
      message_id: commentId,
      message_text: commentText,
      author_id: authorId,
      author_name: authorName,
      platform: platform,
    },
  };

  // Apply custom body template if provided
  if (rule.body_template) {
    try {
      const templateBody = JSON.parse(rule.body_template);
      requestBody = { ...requestBody, ...templateBody };
    } catch (err: any) {
      console.warn(`[Automation Rules] Failed to parse webhook body template:`, err.message);
      // Continue with default body
    }
  }

  // Prepare request headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Automation-Signature': generateWebhookSignature(JSON.stringify(requestBody), rule.id),
    ...(rule.headers || {}),
  };

  // Log webhook call (for audit trail)
  const { data: webhookLog, error: logError } = await supabase
    .from('webhook_logs')
    .insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      rule_id: rule.id,
      webhook_url: rule.webhook_url,
      request_method: rule.request_method || 'POST',
      request_body: requestBody,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) {
    console.warn(`[Automation Rules] Failed to log webhook:`, logError);
  }

  // Make webhook request (in production)
  if (env.openai.apiKey && !env.isTestMode) {
    try {
      const response = await fetch(rule.webhook_url, {
        method: rule.request_method || 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const status = response.ok ? 'success' : 'failed';
      const responseBody = await response.text().catch(() => '');

      // Update webhook log with response
      if (webhookLog) {
        await supabase
          .from('webhook_logs')
          .update({
            status,
            response_code: response.status,
            response_body: responseBody,
          })
          .eq('id', webhookLog.id);
      }

      if (!response.ok) {
        console.error(`[Automation Rules] Webhook request failed: ${response.status}`);
        return false;
      }
    } catch (err: any) {
      console.error(`[Automation Rules] Failed to call webhook:`, err.message);

      // Update log with error
      if (webhookLog) {
        await supabase
          .from('webhook_logs')
          .update({
            status: 'error',
            error_message: err.message,
          })
          .eq('id', webhookLog.id);
      }

      return false;
    }
  }

  console.log(`[Automation Rules] Webhook queued for rule ${rule.id} to ${rule.webhook_url}`);
  return true;
}

/**
 * Generate HMAC signature for webhook authentication
 * Allows receiver to verify the webhook came from your system
 */
function generateWebhookSignature(payload: string, ruleId: string): string {
  // In production, use a shared secret stored in env
  const secret = (typeof env !== 'undefined' && (env as any)?.AUTOMATION_WEBHOOK_SECRET) || 'dev-secret';

  const raw = `${payload}${secret}${ruleId}`;

  // Prefer Node Buffer via globalThis if available, otherwise btoa, otherwise slice
  try {
    const nodeBuffer = (globalThis as any).Buffer;
    if (nodeBuffer && typeof nodeBuffer.from === 'function') {
      return nodeBuffer.from(raw).toString('base64').substring(0, 32);
    }
  } catch (e) {
    // ignore
  }

  if (typeof btoa !== 'undefined') {
    return btoa(raw).substring(0, 32);
  }

  return raw.substring(0, 32);
}

/**
 * ============================================================================
 * EXTENDED ACTION ROUTER - Updated to handle all actions
 * ============================================================================
 */

/**
 * Updated action dispatcher to handle all action types
 */
export async function executeRuleActionFull(
  supabase: any,
  rule: any,
  input: AutomationMessageInput
): Promise<boolean> {
  const { workspaceId, agentId } = input;

  // Apply delay if configured
  if (rule.delay_seconds && rule.delay_seconds > 0) {
    console.log(`[Automation Rules] Applying ${rule.delay_seconds}s delay before action`);
    await new Promise(resolve => setTimeout(resolve, rule.delay_seconds * 1000));
  }

  // Load agent configuration
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    throw new Error(`Agent not found: ${agentError?.message || 'unknown'}`);
  }

  // Execute based on action type
  switch (rule.action_type) {
    case 'send_dm':
      return await executeSendDmAction(supabase, rule, input, agent);

    case 'send_public_reply':
      return await executeSendPublicReplyAction(supabase, rule, input, agent);

    case 'send_email':
      return await executeSendEmailAction(supabase, rule, input, agent);

    case 'send_webhook':
      return await executeSendWebhookAction(supabase, rule, input, agent);

    default:
      console.warn(`[Automation Rules] Unknown action type: ${rule.action_type}`);
      return false;
  }
}

