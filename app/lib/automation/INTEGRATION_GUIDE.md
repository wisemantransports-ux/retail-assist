/**
 * Integration Guide: Automation Rules Executor
 * 
 * How to use the new automation rules execution engine with the existing system
 * 
 * The executor can be integrated in two ways:
 * 1. As a standalone handler for comment webhooks
 * 2. Within the existing runCommentAutomation flow for backward compatibility
 */

import { executeAutomationRulesForComment } from '@/lib/automation/executeAutomationRules';
import type { AutomationCommentInput } from '@/lib/automation/executeAutomationRules';

/**
 * PATTERN 1: Standalone Webhook Handler (Recommended for new integrations)
 * 
 * When a comment comes in from Facebook/Instagram webhook:
 * 1. Extract comment data
 * 2. Call executeAutomationRulesForComment
 * 3. Log result
 * 
 * Example integration in /app/api/webhooks/facebook/route.ts:
 */
export async function exampleStandaloneHandler() {
  const incomingComment = {
    commentId: 'fb_comment_12345',
    content: 'This product is amazing!',
    authorId: 'user_789',
    authorName: 'Jane Doe',
    createdTime: new Date().toISOString(),
  };

  const automationInput: AutomationCommentInput = {
    workspaceId: 'ws_001',
    agentId: 'agent_001',
    commentId: incomingComment.commentId,
    commentText: incomingComment.content,
    authorId: incomingComment.authorId,
    authorName: incomingComment.authorName,
    platform: 'facebook',
  };

  const result = await executeAutomationRulesForComment(automationInput);

  if (result.ok) {
    if (result.ruleMatched && result.actionExecuted) {
      console.log('[Webhook] Automation rule executed successfully');
      console.log(`  DM Sent: ${result.dmSent}`);
    } else if (result.ruleMatched) {
      console.log('[Webhook] Rule matched but action not executed');
    } else {
      console.log('[Webhook] No matching automation rules');
    }
  } else {
    console.error('[Webhook] Automation execution failed:', result.error);
  }

  return result;
}

/**
 * PATTERN 2: Within Existing runCommentAutomation (Backward Compatibility)
 * 
 * To integrate into the existing flow without breaking changes:
 * - Call executeAutomationRulesForComment BEFORE runCommentAutomation
 * - Use the result to decide whether to proceed with the old flow
 * - This allows gradual migration
 * 
 * Example:
 */
export async function exampleMigrationPath() {
  // New code: Try the executor first
  const executorInput: AutomationCommentInput = {
    workspaceId: 'ws_001',
    agentId: 'agent_001',
    commentId: 'comment_123',
    commentText: 'I love this!',
    authorId: 'user_456',
    authorName: 'John Doe',
    platform: 'facebook',
  };

  const executorResult = await executeAutomationRulesForComment(executorInput);

  if (executorResult.ok && executorResult.actionExecuted) {
    // New executor handled it - done!
    console.log('✓ Automation executed via new executor');
    return executorResult;
  }

  // Fall back to old system if needed
  console.log('Executor did not handle, falling back to runCommentAutomation...');
  // const oldResult = await runCommentAutomation({ ... });
  // return oldResult;
}

/**
 * DATABASE INTEGRATION
 * 
 * The executor queries these tables directly:
 * 
 * 1. automation_rules (via SELECT where enabled=true, trigger_type='comment')
 *    Fields used:
 *    - id, enabled, trigger_type
 *    - trigger_words[], trigger_platforms[]
 *    - action_type, send_private_reply, private_reply_template
 *    - auto_skip_replies, delay_seconds
 *    - agent_id, workspace_id
 * 
 * 2. agents (via getAgentById)
 *    Fields used:
 *    - system_prompt, model, temperature
 * 
 * 3. direct_messages (via createDirectMessage)
 *    Creates DM records with:
 *    - agent_id, recipient_id, recipient_name
 *    - content, platform, status='sent'
 * 
 * 4. audit_logs (optional, for logging)
 *    Tracks execution history
 */

/**
 * RLS POLICY REQUIREMENTS
 * 
 * The executor requires these RLS policies to work:
 * 
 * 1. SELECT automation_rules:
 *    - User must be in workspace_members for the rule's workspace
 *    - Policy: workspace_members join via workspace_id
 * 
 * 2. INSERT direct_messages:
 *    - User must be in workspace_members for the DM's workspace
 *    - Policy: workspace_members join via workspace_id
 * 
 * 3. SELECT agents:
 *    - User must be in workspace_members for the agent's workspace
 *    - Policy: workspace_members join via workspace_id
 * 
 * ✓ All policies already exist in migration 007
 */

/**
 * ENVIRONMENT CONFIGURATION
 * 
 * The executor respects these env settings:
 * 
 * - env.useMockMode: Skip database calls, use mock responses
 * - env.openai.apiKey: Use AI for response generation
 * - env.isTestMode: Disable actual OpenAI calls
 * 
 * For development/testing:
 *   export NEXT_PUBLIC_MOCK_MODE=true
 *   → Executor will skip database, return mock results
 */

/**
 * EXECUTION FLOW DIAGRAM
 * 
 * Comment Incoming (webhook)
 *   │
 *   └─> executeAutomationRulesForComment()
 *       │
 *       ├─> Load automation_rules for agent
 *       │   (WHERE enabled=true AND trigger_type='comment')
 *       │
 *       ├─> For each rule:
 *       │   ├─> Check platform matches (trigger_platforms)
 *       │   ├─> Check keywords match (trigger_words)
 *       │   │
 *       │   └─> If match:
 *       │       ├─> executeRuleAction()
 *       │       │
 *       │       └─> Generate DM response
 *       │           ├─> Use private_reply_template
 *       │           └─> Or AI-generate if template has {placeholders}
 *       │
 *       └─> Return ExecuteAutomationResult {
 *           ok: true/false,
 *           ruleMatched: boolean,
 *           actionExecuted: boolean,
 *           dmSent: boolean,
 *           error?: string
 *       }
 */

/**
 * TESTING
 * 
 * Run test scenarios:
 *   npx ts-node app/lib/automation/executeAutomationRules.test.ts
 * 
 * Test cases cover:
 *   1. Comment matches rule keywords and platform → DM sent
 *   2. Comment misses rule keywords → No DM
 *   3. Comment from wrong platform → Skipped
 *   4. No rules exist for agent → Graceful handling
 *   5. Multiple rules, some match → All matching rules execute
 *   6. auto_skip_replies enabled → Check for existing DM first
 */

/**
 * SUPPORTED ACTIONS (Currently)
 * 
 * ✓ send_dm - Send direct message to comment author
 * 
 * Planned (not yet implemented):
 * ○ send_public_reply - Comment reply on post
 * ○ send_email - Email to admin
 * ○ assign_ticket - Create support ticket
 * ○ call_webhook - Trigger external webhook
 */

/**
 * SUPPORTED TRIGGERS (Currently)
 * 
 * ✓ comment - When a comment is received
 * 
 * Planned (not yet implemented):
 * ○ keyword - Specific keywords in any message
 * ○ time - Scheduled messages
 * ○ manual - User-triggered via UI
 */

/**
 * PERFORMANCE NOTES
 * 
 * - Single database query to load all rules (indexed on workspace_id + agent_id)
 * - For each rule: keyword matching is in-memory (no DB)
 * - One INSERT query per rule that matches (createDirectMessage)
 * - No N+1 queries (rules loaded in single query)
 * 
 * Optimization opportunities:
 * - Cache rules for 1-5 minutes per agent
 * - Batch multiple comments into single rule evaluation
 * - Use Redis for keyword trie instead of array search
 */

/**
 * EXAMPLES
 * 
 * Example 1: Simple comment → DM
 * ─────────────────────────────
 * Rule: type='comment_to_dm', trigger_words=['amazing'], send_private_reply=true
 * Comment: "Your product is amazing!"
 * Result: DM sent to comment author
 * 
 * Example 2: Platform-specific rule
 * ──────────────────────────────────
 * Rule: type='comment_to_dm', trigger_platforms=['facebook'], send_private_reply=true
 * Comment: "Great work!" (on Instagram)
 * Result: No DM sent (platform mismatch)
 * 
 * Example 3: Template with placeholders
 * ─────────────────────────────────────
 * Rule: private_reply_template="Thank you {name} for your feedback!"
 * Comment: "Love it!" by "Sarah"
 * Result: DM sent with personalized content
 * 
 * Example 4: Auto-skip replies
 * ────────────────────────────
 * Rule: auto_skip_replies=true
 * Comment: Already has a bot reply
 * Result: No new DM sent (already replied)
 */
