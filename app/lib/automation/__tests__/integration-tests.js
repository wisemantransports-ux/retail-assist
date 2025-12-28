#!/usr/bin/env node

/**
 * Automation Executor Integration Tests
 * 
 * Validates that trigger matching and action execution flows work correctly.
 * Uses simple mock logic instead of actual Supabase/OpenAI calls.
 */

console.log('========================================');
console.log('Automation Executor Integration Tests');
console.log('========================================\n');

// ============================================================================
// Mock implementations (simulating executor behavior)
// ============================================================================

/**
 * Mock trigger matching function
 */
function checkTriggerMatch(rule, input) {
  switch (rule.trigger_type) {
    case 'comment':
      // Match if platform is in allowed list
      if (!rule.trigger_platforms.includes(input.platform)) {
        return false;
      }
      // Match if any trigger word appears in comment text
      if (!rule.trigger_words.some(word => 
        input.commentText.toLowerCase().includes(word)
      )) {
        return false;
      }
      return true;

    case 'keyword':
      // Match if any trigger word appears in message
      return rule.trigger_words.some(word => 
        input.commentText.toLowerCase().includes(word)
      );

    case 'time':
      // For this test, just check if time trigger is configured
      return !!(rule.scheduled_time || rule.recurrence_pattern);

    case 'manual':
      // Manual triggers always match when invoked
      return true;

    default:
      return false;
  }
}

/**
 * Mock action execution function
 */
async function executeRuleAction(rule, input) {
  switch (rule.action_type) {
    case 'send_dm':
      if (!rule.send_private_reply) {
        return { executed: false, reason: 'send_private_reply disabled' };
      }
      // Simulate DM creation
      return {
        executed: true,
        action: 'send_dm',
        dmId: `dm_${Date.now()}`,
        recipient: input.authorId,
      };

    case 'send_public_reply':
      if (!rule.send_public_reply) {
        return { executed: false, reason: 'send_public_reply disabled' };
      }
      // Simulate public reply
      return {
        executed: true,
        action: 'send_public_reply',
        replyId: `reply_${Date.now()}`,
        platform: input.platform,
      };

    case 'send_email':
      if (!rule.email_recipients || rule.email_recipients.length === 0) {
        return { executed: false, reason: 'No email recipients' };
      }
      // Simulate email queuing
      return {
        executed: true,
        action: 'send_email',
        emailId: `email_${Date.now()}`,
        recipients: rule.email_recipients,
      };

    case 'send_webhook':
      if (!rule.webhook_url) {
        return { executed: false, reason: 'No webhook URL' };
      }
      // Simulate webhook logging
      return {
        executed: true,
        action: 'send_webhook',
        webhookId: `webhook_${Date.now()}`,
        url: rule.webhook_url,
      };

    default:
      return { executed: false, reason: 'Unknown action type' };
  }
}

// ============================================================================
// Integration Test Scenarios
// ============================================================================

const integrationTests = [];

const integrationTest = (name, fn) => {
  integrationTests.push({ name, fn });
};

// Scenario 1: Full flow - comment triggers DM
integrationTest('Full flow: Comment triggers DM action', async () => {
  const rule = {
    id: 'rule_1',
    enabled: true,
    trigger_type: 'comment',
    trigger_words: ['amazing', 'love'],
    trigger_platforms: ['facebook'],
    action_type: 'send_dm',
    send_private_reply: true,
  };

  const input = {
    commentText: 'This product is amazing!',
    platform: 'facebook',
    authorId: 'user_123',
    authorName: 'John',
  };

  // Check if rule matches
  const matches = checkTriggerMatch(rule, input);
  if (!matches) throw new Error('Rule should match');

  // Execute action
  const result = await executeRuleAction(rule, input);
  if (!result.executed) throw new Error('Action should execute');
  if (result.action !== 'send_dm') throw new Error('Should execute send_dm');

  return {
    stage: 'complete',
    triggerMatched: matches,
    actionExecuted: result.executed,
    actionType: result.action,
    dmId: result.dmId,
  };
});

// Scenario 2: Full flow - keyword triggers public reply
integrationTest('Full flow: Keyword triggers public reply', async () => {
  const rule = {
    id: 'rule_2',
    enabled: true,
    trigger_type: 'keyword',
    trigger_words: ['help', 'support'],
    action_type: 'send_public_reply',
    send_public_reply: true,
  };

  const input = {
    commentText: 'I need help with my order',
    platform: 'facebook',
    authorId: 'user_456',
  };

  // Check if rule matches
  const matches = checkTriggerMatch(rule, input);
  if (!matches) throw new Error('Rule should match on keyword');

  // Execute action
  const result = await executeRuleAction(rule, input);
  if (!result.executed) throw new Error('Action should execute');
  if (result.action !== 'send_public_reply') throw new Error('Should execute send_public_reply');

  return {
    stage: 'complete',
    triggerMatched: matches,
    matchedKeyword: 'help',
    actionExecuted: result.executed,
    replyId: result.replyId,
  };
});

// Scenario 3: Platform filter prevents match
integrationTest('Platform filter: Wrong platform prevents rule match', async () => {
  const rule = {
    id: 'rule_3',
    enabled: true,
    trigger_type: 'comment',
    trigger_words: ['amazing'],
    trigger_platforms: ['facebook'], // Only Facebook
    action_type: 'send_dm',
    send_private_reply: true,
  };

  const input = {
    commentText: 'This product is amazing!',
    platform: 'instagram', // Instagram comment
    authorId: 'user_789',
  };

  // Check if rule matches
  const matches = checkTriggerMatch(rule, input);
  if (matches) throw new Error('Rule should not match different platform');

  return {
    stage: 'rejected',
    reason: 'platform not in rule allowed list',
    triggerMatched: matches,
  };
});

// Scenario 4: Disabled action prevents execution
integrationTest('Disabled action: send_private_reply=false prevents DM', async () => {
  const rule = {
    id: 'rule_4',
    enabled: true,
    trigger_type: 'comment',
    trigger_words: ['test'],
    trigger_platforms: ['facebook'],
    action_type: 'send_dm',
    send_private_reply: false, // Disabled
  };

  const input = {
    commentText: 'This is a test',
    platform: 'facebook',
    authorId: 'user_999',
  };

  // Check if rule matches
  const matches = checkTriggerMatch(rule, input);
  if (!matches) throw new Error('Rule should match');

  // Try to execute action (should be blocked)
  const result = await executeRuleAction(rule, input);
  if (result.executed) throw new Error('Action should not execute');

  return {
    stage: 'rejected',
    reason: result.reason,
    triggerMatched: matches,
    actionExecuted: result.executed,
  };
});

// Scenario 5: Email action with recipients
integrationTest('Email action: Validate and queue email', async () => {
  const rule = {
    id: 'rule_5',
    enabled: true,
    trigger_type: 'keyword',
    trigger_words: ['urgent'],
    action_type: 'send_email',
    email_recipients: ['support@company.com', 'admin@company.com'],
    subject_template: 'Urgent message received',
    body_template: 'Message: {text}',
  };

  const input = {
    commentText: 'This is urgent!',
    platform: 'website',
    authorId: 'user_urgent',
  };

  // Check if rule matches
  const matches = checkTriggerMatch(rule, input);
  if (!matches) throw new Error('Rule should match');

  // Execute action
  const result = await executeRuleAction(rule, input);
  if (!result.executed) throw new Error('Action should execute');
  if (result.action !== 'send_email') throw new Error('Should execute send_email');
  if (result.recipients.length !== 2) throw new Error('Should have 2 recipients');

  return {
    stage: 'complete',
    triggerMatched: matches,
    actionExecuted: result.executed,
    actionType: result.action,
    recipientCount: result.recipients.length,
  };
});

// Scenario 6: Webhook action validation
integrationTest('Webhook action: Validate URL and queue webhook', async () => {
  const rule = {
    id: 'rule_6',
    enabled: true,
    trigger_type: 'keyword',
    trigger_words: ['payment', 'invoice'],
    action_type: 'send_webhook',
    webhook_url: 'https://api.example.com/webhooks/orders',
    request_method: 'POST',
    headers: { 'Authorization': 'Bearer token' },
  };

  const input = {
    commentText: 'Payment completed for invoice #123',
    platform: 'website',
    authorId: 'user_payment',
  };

  // Check if rule matches
  const matches = checkTriggerMatch(rule, input);
  if (!matches) throw new Error('Rule should match');

  // Execute action
  const result = await executeRuleAction(rule, input);
  if (!result.executed) throw new Error('Action should execute');
  if (result.action !== 'send_webhook') throw new Error('Should execute send_webhook');

  return {
    stage: 'complete',
    triggerMatched: matches,
    actionExecuted: result.executed,
    webhookUrl: result.url,
  };
});

// Scenario 7: Time trigger validation
integrationTest('Time trigger: Validate scheduled config', async () => {
  const rule = {
    id: 'rule_7',
    enabled: true,
    trigger_type: 'time',
    scheduled_time: '2025-01-01T12:00:00Z',
    recurrence_pattern: '0 12 * * *',
    action_type: 'send_dm',
  };

  const input = {
    commentText: '', // Time triggers don't need message
    platform: 'scheduled',
  };

  // Check if rule matches (time-based)
  const matches = checkTriggerMatch(rule, input);
  if (!matches) throw new Error('Time rule should match when configured');

  return {
    stage: 'complete',
    triggerType: 'time',
    triggerMatched: matches,
    hasSchedule: !!rule.scheduled_time,
    hasRecurrence: !!rule.recurrence_pattern,
  };
});

// Scenario 8: Manual trigger
integrationTest('Manual trigger: Can be invoked directly', async () => {
  const rule = {
    id: 'rule_8',
    enabled: true,
    trigger_type: 'manual',
    action_type: 'send_dm',
    send_private_reply: true,
  };

  const input = {
    commentText: 'User manually triggered rule',
    platform: 'manual',
    authorId: 'user_manual',
  };

  // Check if rule matches (manual always matches when invoked)
  const matches = checkTriggerMatch(rule, input);
  if (!matches) throw new Error('Manual rule should match');

  // Execute action
  const result = await executeRuleAction(rule, input);
  if (!result.executed) throw new Error('Action should execute');

  return {
    stage: 'complete',
    triggerType: 'manual',
    triggerMatched: matches,
    actionExecuted: result.executed,
  };
});

// ============================================================================
// Run integration tests
// ============================================================================

let passed = 0;
let failed = 0;

(async () => {
  for (const { name, fn } of integrationTests) {
    try {
      const result = await fn();
      console.log(`✓ ${name}`);
      Object.entries(result).forEach(([key, value]) => {
        if (typeof value === 'object') {
          console.log(`  - ${key}: ${JSON.stringify(value)}`);
        } else {
          console.log(`  - ${key}: ${value}`);
        }
      });
      passed++;
    } catch (err) {
      console.error(`✗ ${name}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
    console.log();
  }

  console.log('========================================');
  console.log(`Results: ${passed} passed, ${failed} failed out of ${integrationTests.length} tests`);
  console.log('========================================\n');

  if (failed > 0) {
    console.error('Some integration tests failed!');
    process.exit(1);
  } else {
    console.log('All integration tests passed! ✓');
    process.exit(0);
  }
})();
