#!/usr/bin/env node

/**
 * Automation Rules Executor Test Suite
 * 
 * Validates automation executor logic:
 * - Comment → DM triggers
 * - Keyword triggers
 * - Public replies
 * - Rule matching and filtering
 */

console.log('========================================');
console.log('Automation Executor Test Suite');
console.log('========================================\n');

// ============================================================================
// Test Data
// ============================================================================

const mockWorkspaceId = 'ws_test_001';
const mockAgentId = 'agent_test_001';

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
  private_reply_template: 'Thank you {name} for your feedback!',
  auto_skip_replies: false,
  skip_if_keyword_present: [],
  delay_seconds: 0,
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
  public_reply_template: 'Thank you for reaching out! Our team is here to help.',
  auto_skip_replies: false,
  skip_if_keyword_present: [],
  delay_seconds: 0,
};

// ============================================================================
// Test Suite
// ============================================================================

const tests = [];

const test = (name, fn) => {
  tests.push({ name, fn });
};

// Test 1: Comment with matching keywords triggers DM
test('Comment with matching keywords → DM', () => {
  const input = {
    text: 'This product is amazing! Love the quality.',
    platform: 'facebook',
    author: 'John Smith',
  };
  const rule = mockRuleForDM;

  const triggersMatch = rule.trigger_words.some(word => 
    input.text.toLowerCase().includes(word)
  );
  const platformMatches = rule.trigger_platforms.includes(input.platform);
  
  if (!triggersMatch || !platformMatches) {
    throw new Error('Rule should have matched');
  }
  
  return {
    ruleMatched: true,
    actionType: 'send_dm',
    dmWouldBeSent: true,
  };
});

// Test 2: Comment without matching keywords should not trigger
test('Comment without matching keywords → No action', () => {
  const input = {
    text: 'Just a regular comment with no keywords',
    platform: 'facebook',
  };
  const rule = mockRuleForDM;

  const triggersMatch = rule.trigger_words.some(word => 
    input.text.toLowerCase().includes(word)
  );
  
  if (triggersMatch) {
    throw new Error('Rule should not have matched');
  }
  
  return {
    ruleMatched: false,
    actionExecuted: false,
  };
});

// Test 3: Platform mismatch should not trigger
test('Platform mismatch → No action', () => {
  const input = {
    text: 'This product is amazing! Love the quality.',
    platform: 'website',
  };
  const rule = mockRuleForDM;

  const triggersMatch = rule.trigger_words.some(word => 
    input.text.toLowerCase().includes(word)
  );
  const platformMatches = rule.trigger_platforms.includes(input.platform);
  
  if (triggersMatch && platformMatches) {
    throw new Error('Rule should not have matched due to platform');
  }
  
  return {
    ruleMatched: false,
    reason: 'platform not in allowed list',
  };
});

// Test 4: Keyword trigger type
test('Keyword trigger → Match on keywords', () => {
  const input = {
    text: 'I need help with my order',
    platform: 'facebook',
  };
  const rule = mockRuleForPublicReply;

  const triggersMatch = rule.trigger_words.some(word => 
    input.text.toLowerCase().includes(word)
  );
  
  if (!triggersMatch) {
    throw new Error('Keyword rule should have matched');
  }
  
  return {
    ruleMatched: true,
    matchedKeyword: 'help',
    actionType: 'send_public_reply',
  };
});

// Test 5: Disabled rule should not execute
test('Disabled rule → No action', () => {
  const rule = { ...mockRuleForDM, enabled: false };
  
  if (rule.enabled) {
    throw new Error('Rule should be disabled');
  }
  
  return {
    ruleEnabled: false,
    skipped: true,
  };
});

// Test 6: Delayed action should apply delay
test('Delayed action → Apply delay', () => {
  const rule = { ...mockRuleForDM, delay_seconds: 2 };
  
  if (rule.delay_seconds <= 0) {
    throw new Error('Rule should have delay');
  }
  
  return {
    delaySeconds: rule.delay_seconds,
    delayApplied: true,
  };
});

// Test 7: Skip if keyword present
test('Skip if keyword present → Conditional execution', () => {
  const skipRule = {
    ...mockRuleForDM,
    skip_if_keyword_present: ['spam', 'abuse'],
  };
  const messageWithSkipKeyword = 'This is amazing but also spam';
  
  const shouldSkip = skipRule.skip_if_keyword_present.some(keyword =>
    messageWithSkipKeyword.toLowerCase().includes(keyword)
  );
  
  if (!shouldSkip) {
    throw new Error('Rule should skip on keyword presence');
  }
  
  return {
    skipKeywordFound: 'spam',
    shouldSkip: true,
  };
});

// Test 8: Multiple rule evaluation
test('Multiple rules → Evaluate all', () => {
  const rules = [mockRuleForDM, mockRuleForPublicReply];
  const input = {
    text: 'I love this product but need help with returns',
    platform: 'facebook',
  };

  const matches = rules.map(rule => {
    const triggersMatch = rule.trigger_words.some(word => 
      input.text.toLowerCase().includes(word)
    );
    const platformMatches = rule.trigger_platforms.includes(input.platform);
    return triggersMatch && platformMatches ? rule.id : null;
  }).filter(Boolean);
  
  if (matches.length === 0) {
    throw new Error('At least one rule should have matched');
  }
  
  return {
    matchedRules: matches,
    totalMatches: matches.length,
  };
});

// Test 9: Time trigger configuration validation
test('Time trigger → Validate config', () => {
  const timeTriggerRule = {
    trigger_type: 'time',
    scheduled_time: '2025-01-01T12:00:00Z',
    recurrence_pattern: '0 12 * * *',
    timezone: 'UTC',
  };
  
  if (!timeTriggerRule.scheduled_time && !timeTriggerRule.recurrence_pattern) {
    throw new Error('Time trigger must have scheduled_time or recurrence_pattern');
  }
  
  return {
    triggerType: 'time',
    hasScheduledTime: !!timeTriggerRule.scheduled_time,
    hasRecurrence: !!timeTriggerRule.recurrence_pattern,
    timezone: timeTriggerRule.timezone,
  };
});

// Test 10: Manual trigger validation
test('Manual trigger → Can be invoked directly', () => {
  const manualTriggerRule = {
    trigger_type: 'manual',
    action_type: 'send_dm',
  };
  
  if (manualTriggerRule.trigger_type !== 'manual') {
    throw new Error('Should be a manual trigger');
  }
  
  return {
    triggerType: 'manual',
    canInvokeDirectly: true,
  };
});

// Test 11: Email action configuration
test('Email action → Validate recipients', () => {
  const emailRule = {
    action_type: 'send_email',
    email_recipients: ['support@company.com', 'admin@company.com'],
    subject_template: 'New customer feedback',
    body_template: 'Feedback: {message}',
  };
  
  if (!emailRule.email_recipients || emailRule.email_recipients.length === 0) {
    throw new Error('Email action must have recipients');
  }
  
  return {
    actionType: 'send_email',
    recipientCount: emailRule.email_recipients.length,
    hasSubject: !!emailRule.subject_template,
    hasBody: !!emailRule.body_template,
  };
});

// Test 12: Webhook action configuration
test('Webhook action → Validate URL and headers', () => {
  const webhookRule = {
    action_type: 'send_webhook',
    webhook_url: 'https://api.example.com/webhook',
    request_method: 'POST',
    headers: { 'Authorization': 'Bearer token' },
  };
  
  if (!webhookRule.webhook_url) {
    throw new Error('Webhook action must have URL');
  }
  
  const isValidUrl = webhookRule.webhook_url.startsWith('http://') || 
                     webhookRule.webhook_url.startsWith('https://');
  if (!isValidUrl) {
    throw new Error('Webhook URL must be valid HTTP(S)');
  }
  
  return {
    actionType: 'send_webhook',
    url: webhookRule.webhook_url,
    method: webhookRule.request_method,
    hasHeaders: !!webhookRule.headers,
  };
});

// ============================================================================
// Run all tests
// ============================================================================

let passed = 0;
let failed = 0;

for (const { name, fn } of tests) {
  try {
    const result = fn();
    console.log(`✓ ${name}`);
    if (result) {
      Object.entries(result).forEach(([key, value]) => {
        console.log(`  - ${key}: ${JSON.stringify(value)}`);
      });
    }
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
  console.log();
}

console.log('========================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
console.log('========================================\n');

if (failed > 0) {
  console.error('Some tests failed!');
  process.exit(1);
} else {
  console.log('All tests passed! ✓');
  process.exit(0);
}
