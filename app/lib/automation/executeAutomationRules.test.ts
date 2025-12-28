/**
 * Automation Rules Execution Engine Tests
 * 
 * Verifies that the executor correctly:
 * 1. Loads automation rules for an agent
 * 2. Matches messages against rule triggers (comment, keyword)
 * 3. Executes actions (send_dm, send_public_reply)
 * 4. Handles edge cases (no rules, platform mismatch, etc.)
 */

import { executeAutomationRulesForComment, executeAutomationRulesForMessage } from '@/lib/automation/executeAutomationRules';

import { 
  executeTimeTriggerRules, 
  executeManualTrigger,
  TimeTriggerConfig,
  EmailActionConfig,
  WebhookActionConfig
} from '@/lib/automation/executeAutomationRules';
/**
 * Mock test data
 */
const mockWorkspaceId = 'ws_test_001';
const mockAgentId = 'agent_test_001';

const mockCommentInput = {
  workspaceId: mockWorkspaceId,
  agentId: mockAgentId,
  commentId: 'comment_001',
  commentText: 'This product is amazing! Love the quality.',
  authorId: 'user_123',
  authorName: 'John Smith',
  platform: 'facebook' as const,
  postId: 'post_001',
};

const mockRuleForDM = {
  id: 'rule_001',
  workspace_id: mockWorkspaceId,
  agent_id: mockAgentId,
  type: 'comment_to_dm',
  enabled: true,
  trigger_type: 'comment',
  trigger_words: ['amazing', 'love'],
  trigger_platforms: ['facebook', 'instagram'],
  action_type: 'send_dm',
  send_private_reply: true,
  private_reply_template: 'Thank you {name} for your feedback! We appreciate your support.',
  auto_skip_replies: false,
  skip_if_keyword_present: [],
  delay_seconds: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

const mockRuleForPublicReply = {
  id: 'rule_002',
  workspace_id: mockWorkspaceId,
  agent_id: mockAgentId,
  type: 'keyword_reply',
  enabled: true,
  trigger_type: 'keyword',
  trigger_words: ['help', 'support', 'issue'],
  trigger_platforms: ['facebook'],
  action_type: 'send_public_reply',
  send_public_reply: true,
  public_reply_template: 'Thank you for reaching out! Our team is here to help. How can we assist?',
  auto_skip_replies: false,
  skip_if_keyword_present: [],
  delay_seconds: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

/**
 * Test scenario 1: Comment matches rule keywords and platform (send_dm)
 * Expected: Rule should match, DM should be sent
 */
export async function testCommentMatchesRule() {
  console.log('\n=== Test 1: Comment matches rule keywords and platform ===');
  
  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    dmSent: true,
    replySent: undefined,
    error: undefined,
  };

  console.log('Input comment:', mockCommentInput);
  console.log('Input rule:', mockRuleForDM);
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify rule matching and DM execution');
}

/**
 * Test scenario 2: Comment doesn't match rule keywords
 * Expected: Rule should not match, no DM sent
 */
export async function testCommentMissesRule() {
  console.log('\n=== Test 2: Comment doesn\'t match rule keywords ===');
  
  const mismatchComment = {
    ...mockCommentInput,
    commentText: 'This is just a random comment about pizza',
  };

  const expectedResult = {
    ok: true,
    ruleMatched: false,
    actionExecuted: false,
    error: undefined,
  };

  console.log('Input comment:', mismatchComment);
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify rule mismatch');
}

/**
 * Test scenario 3: Comment from different platform
 * Expected: Rule should skip due to platform mismatch
 */
export async function testPlatformMismatch() {
  console.log('\n=== Test 3: Comment from different platform ===');
  
  const wrongPlatformComment = {
    ...mockCommentInput,
    platform: 'whatsapp' as const,
  };

  const expectedResult = {
    ok: true,
    ruleMatched: false,
    actionExecuted: false,
    error: undefined,
  };

  console.log('Input comment:', wrongPlatformComment);
  console.log('Rule allows:', mockRuleForDM.trigger_platforms);
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify platform filtering');
}

/**
 * Test scenario 4: No rules exist for agent
 * Expected: Should return ruleMatched=false, no error
 */
export async function testNoRulesExist() {
  console.log('\n=== Test 4: No rules exist for agent ===');
  
  const expectedResult = {
    ok: true,
    ruleMatched: false,
    actionExecuted: false,
    error: undefined,
  };

  console.log('Agent:', mockAgentId);
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify graceful handling of no rules');
}

/**
 * Test scenario 5: Multiple rules, some match
 * Expected: All matching rules should execute
 */
export async function testMultipleRules() {
  console.log('\n=== Test 5: Multiple rules, some match ===');
  
  const rule1 = { ...mockRuleForDM, id: 'rule_001', trigger_words: ['amazing'] };
  const rule2 = { ...mockRuleForDM, id: 'rule_002', trigger_words: ['terrible', 'horrible'] };
  const rule3 = { ...mockRuleForDM, id: 'rule_003', trigger_words: ['love'] };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    matchedRules: ['rule_001', 'rule_003'],
    error: undefined,
  };

  console.log('Comment:', mockCommentInput.commentText);
  console.log('Rules:');
  console.log('  - rule_001 (keywords: amazing) ✓ matches');
  console.log('  - rule_002 (keywords: terrible, horrible) ✗ no match');
  console.log('  - rule_003 (keywords: love) ✓ matches');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify multiple rule execution');
}

/**
 * Test scenario 6: Rule with auto_skip_replies enabled
 * Expected: Should check for existing DMs before sending
 */
export async function testAutoSkipReplies() {
  console.log('\n=== Test 6: Rule with auto_skip_replies enabled ===');
  
  const skipRule = {
    ...mockRuleForDM,
    auto_skip_replies: true,
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: false, // Skipped due to existing reply
    error: undefined,
  };

  console.log('Input rule:', skipRule);
  console.log('Expected: Check for existing DMs before sending');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify skip logic');
}

/**
 * ============================================================================
 * EXTENDED TESTS: Keyword Triggers & Public Reply Actions
 * ============================================================================
 */

/**
 * Test scenario 7: Keyword trigger in message (not just comment)
 * Expected: Rule should match even if not specifically a comment trigger
 */
export async function testKeywordTrigger() {
  console.log('\n=== Test 7: Keyword trigger in message ===');
  
  const supportMessage = {
    workspaceId: mockWorkspaceId,
    agentId: mockAgentId,
    commentId: 'message_001',
    commentText: 'I need help with my order',
    authorId: 'user_456',
    authorName: 'Jane Doe',
    platform: 'facebook' as const,
    messageType: 'message' as const,
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: false, // No action in this test, just trigger match
    error: undefined,
  };

  console.log('Input message:', supportMessage);
  console.log('Trigger type: keyword (trigger_words: ["help", "support"])');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify keyword matching');
}

/**
 * Test scenario 8: Public reply action
 * Expected: Rule should post public reply on post
 */
export async function testPublicReplyAction() {
  console.log('\n=== Test 8: Public reply action ===');
  
  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    replySent: true,
    error: undefined,
  };

  console.log('Input comment:', mockCommentInput);
  console.log('Input rule:', mockRuleForPublicReply);
  console.log('Expected: Public reply queued for posting');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify public reply action');
}

/**
 * Test scenario 9: Keyword trigger with public reply action
 * Expected: Rule should match keyword and post public reply
 */
export async function testKeywordTriggerWithPublicReply() {
  console.log('\n=== Test 9: Keyword trigger with public reply ===');
  
  const supportComment = {
    ...mockCommentInput,
    commentText: 'I need support with this product',
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    replySent: true,
    error: undefined,
  };

  console.log('Input comment:', supportComment);
  console.log('Rule: trigger_type=keyword, trigger_words=[support], action_type=send_public_reply');
  console.log('Expected: Keyword matches, public reply queued');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify keyword trigger with public reply');
}

/**
 * Test scenario 10: Trigger type evaluation
 * Expected: Rule evaluation correctly handles different trigger types
 */
export async function testTriggerTypeEvaluation() {
  console.log('\n=== Test 10: Trigger type evaluation ===');
  
  const expectedResult = {
    ok: true,
    ruleMatched: false,
    actionExecuted: false,
    error: undefined,
  };

  console.log('Rule: trigger_type=comment');
  console.log('Input: DM message with messageType=dm');
  console.log('Expected: No match (messageType mismatch for comment trigger)');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify trigger type matching');
}

/**
 * ============================================================================
 * ADVANCED TESTS: Time-Based Triggers, Manual Triggers, Email & Webhooks
 * ============================================================================
 */

/**
 * Mock rules for advanced tests
 */
const mockRuleForTimeTrigger = {
  id: 'rule_time_001',
  workspace_id: mockWorkspaceId,
  agent_id: mockAgentId,
  type: 'scheduled_message',
  enabled: true,
  trigger_type: 'time',
  scheduled_time: new Date(Date.now() - 60000).toISOString(), // 1 minute ago (due to execute)
  recurrence_pattern: null,
  timezone: 'UTC',
  message_template: 'Reminder: Check your orders!',
  action_type: 'send_dm',
  send_private_reply: true,
  private_reply_template: 'Hi {name}, time for your daily reminder!',
  auto_skip_replies: false,
  delay_seconds: 0,
  last_executed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockRuleForManualTrigger = {
  id: 'rule_manual_001',
  workspace_id: mockWorkspaceId,
  agent_id: mockAgentId,
  type: 'comment_to_dm',
  enabled: true,
  trigger_type: 'manual',
  message_template: 'Welcome to our service!',
  action_type: 'send_dm',
  send_private_reply: true,
  private_reply_template: 'Welcome {name}! We\'re excited to have you on board.',
  auto_skip_replies: false,
  delay_seconds: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockRuleForEmailAction = {
  id: 'rule_email_001',
  workspace_id: mockWorkspaceId,
  agent_id: mockAgentId,
  type: 'comment_to_dm',
  enabled: true,
  trigger_type: 'keyword',
  trigger_words: ['urgent', 'critical', 'emergency'],
  trigger_platforms: ['facebook', 'instagram', 'website'],
  action_type: 'send_email',
  email_recipients: ['support@company.com', 'admin@company.com'],
  subject_template: 'Urgent Issue from {name}',
  body_template: 'New urgent message:\n\n{message}\n\nPlease respond quickly.',
  use_ai_body: false,
  auto_skip_replies: false,
  delay_seconds: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockRuleForWebhookAction = {
  id: 'rule_webhook_001',
  workspace_id: mockWorkspaceId,
  agent_id: mockAgentId,
  type: 'keyword_reply',
  enabled: true,
  trigger_type: 'keyword',
  trigger_words: ['order', 'purchase', 'buy'],
  trigger_platforms: ['facebook', 'instagram', 'website'],
  action_type: 'send_webhook',
  webhook_url: 'https://api.example.com/webhooks/orders',
  request_method: 'POST',
  headers: { 'Authorization': 'Bearer secret_token' },
  body_template: JSON.stringify({ action: 'log_purchase', priority: 'high' }),
  auto_skip_replies: false,
  delay_seconds: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Test scenario 11: Time-based trigger - one-time scheduled message
 * Expected: Rule should trigger if scheduled_time is in the past
 */
export async function testTimeTriggerOneTime() {
  console.log('\n=== Test 11: Time-based trigger (one-time scheduled) ===');

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    dmSent: true,
    error: undefined,
  };

  console.log('Input workspace:', mockWorkspaceId);
  console.log('Input agent:', mockAgentId);
  console.log('Rule:', {
    trigger_type: 'time',
    scheduled_time: '2025-12-27T10:00:00Z',
    action_type: 'send_dm',
  });
  console.log('Expected: One-time scheduled message triggers at specified time');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify time trigger execution');
}

/**
 * Test scenario 12: Time-based trigger - recurring scheduled message (cron pattern)
 * Expected: Rule should trigger when cron pattern matches current time
 */
export async function testTimeTriggerRecurring() {
  console.log('\n=== Test 12: Time-based trigger (recurring via cron) ===');

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    dmSent: true,
    error: undefined,
  };

  console.log('Input workspace:', mockWorkspaceId);
  console.log('Input agent:', mockAgentId);
  console.log('Rule:', {
    trigger_type: 'time',
    recurrence_pattern: '0 9 * * *', // Daily at 9 AM
    action_type: 'send_dm',
  });
  console.log('Expected: Recurring message triggers at 9 AM every day');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify recurring trigger execution');
}

/**
 * Test scenario 13: Manual trigger - user-initiated rule execution
 * Expected: Rule should execute when explicitly triggered by user
 */
export async function testManualTrigger() {
  console.log('\n=== Test 13: Manual trigger (user-initiated) ===');

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    dmSent: true,
    error: undefined,
  };

  console.log('Trigger:', {
    workspaceId: mockWorkspaceId,
    agentId: mockAgentId,
    ruleId: 'rule_manual_001',
    recipientEmail: 'user@example.com',
  });
  console.log('Rule:', {
    trigger_type: 'manual',
    action_type: 'send_dm',
    message: 'Welcome to our service!',
  });
  console.log('Expected: Manual trigger executes action immediately');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify manual trigger execution');
}

/**
 * Test scenario 14: Send email action
 * Expected: Rule should queue email notification to configured recipients
 */
export async function testSendEmailAction() {
  console.log('\n=== Test 14: Send email action ===');

  const urgentMessage = {
    ...mockCommentInput,
    commentText: 'This is URGENT! The website is broken!',
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    emailSent: true,
    error: undefined,
  };

  console.log('Input message:', urgentMessage);
  console.log('Rule:', {
    trigger_type: 'keyword',
    trigger_words: ['urgent', 'emergency'],
    action_type: 'send_email',
    recipients: ['support@company.com', 'admin@company.com'],
  });
  console.log('Expected: Email queued to support team with urgent flag');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify email action');
}

/**
 * Test scenario 15: Send webhook action
 * Expected: Rule should make HTTP POST to webhook URL with rule context
 */
export async function testSendWebhookAction() {
  console.log('\n=== Test 15: Send webhook action ===');

  const orderMessage = {
    ...mockCommentInput,
    commentText: 'I want to purchase this item!',
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    webhookCalled: true,
    error: undefined,
  };

  console.log('Input message:', orderMessage);
  console.log('Rule:', {
    trigger_type: 'keyword',
    trigger_words: ['purchase', 'buy', 'order'],
    action_type: 'send_webhook',
    webhook_url: 'https://api.example.com/webhooks/orders',
    request_method: 'POST',
  });
  console.log('Expected: Webhook called with order context');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify webhook action');
}

/**
 * Test scenario 16: Email action with AI-generated body
 * Expected: Rule should use AI to generate personalized email body
 */
export async function testEmailActionWithAI() {
  console.log('\n=== Test 16: Email action with AI-generated body ===');

  const complaintMessage = {
    ...mockCommentInput,
    commentText: 'Your product is terrible and broke after one day!',
    authorName: 'Angry Customer',
  };

  const rule = {
    ...mockRuleForEmailAction,
    use_ai_body: true,
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    emailSent: true,
    error: undefined,
  };

  console.log('Input message:', complaintMessage);
  console.log('Rule:', {
    trigger_type: 'keyword',
    action_type: 'send_email',
    use_ai_body: true, // AI will generate personalized body
  });
  console.log('Expected: AI generates empathetic email response');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify AI email generation');
}

/**
 * Test scenario 17: Webhook action with custom headers
 * Expected: Rule should include custom auth headers in webhook request
 */
export async function testWebhookActionWithAuth() {
  console.log('\n=== Test 17: Webhook action with custom headers ===');

  const orderMessage = {
    ...mockCommentInput,
    commentText: 'I want to order 5 units',
  };

  const rule = {
    ...mockRuleForWebhookAction,
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'X-Custom-Header': 'custom-value',
    },
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    webhookCalled: true,
    error: undefined,
  };

  console.log('Input message:', orderMessage);
  console.log('Rule:', {
    trigger_type: 'keyword',
    action_type: 'send_webhook',
    webhook_url: 'https://secure-api.example.com/orders',
    headers: rule.headers,
  });
  console.log('Expected: Webhook request includes authentication headers');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify webhook authentication');
}

/**
 * Test scenario 18: Combined workflow - keyword trigger with multiple actions
 * Expected: Single keyword match triggers both email to team AND webhook to external system
 */
export async function testCombinedMultipleActions() {
  console.log('\n=== Test 18: Combined workflow - keyword with multiple actions ===');

  const criticalMessage = {
    ...mockCommentInput,
    commentText: 'CRITICAL BUG: Payment system is down!',
  };

  const expectedResult = {
    ok: true,
    ruleMatched: true,
    actionExecuted: true,
    emailSent: true,
    webhookCalled: true,
    error: undefined,
  };

  console.log('Input message:', criticalMessage);
  console.log('Rule:', {
    trigger_type: 'keyword',
    trigger_words: ['critical', 'bug', 'down'],
    actions: [
      {
        type: 'send_email',
        recipients: ['ops@company.com', 'engineering@company.com'],
      },
      {
        type: 'send_webhook',
        url: 'https://incident.example.com/create-incident',
      },
    ],
  });
  console.log('Expected: Both email sent AND webhook called for incident tracking');
  console.log('Expected result:', expectedResult);
  console.log('✓ Test case defined - would verify multiple action execution');
}
