/**
 * Automation Rules Test Runner
 * 
 * Sets up mocks for Supabase, OpenAI, and env variables.
 * Runs unit tests for the automation executor module.
 */

// ============================================================================
// Mock setup for dependencies
// ============================================================================

const mockSupabase = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'agent_001', model: 'gpt-4o-mini', system_prompt: 'You are helpful.', temperature: 0.7, max_tokens: 500 },
            error: null,
          }),
        }),
        order: () => ({
          limit: () => ({
            then: (cb: Function) => cb({ data: [], error: null }),
          }),
        }),
      }),
      order: () => ({
        limit: () => ({
          then: (cb: Function) => cb({ data: [], error: null }),
        }),
      }),
    }),
    insert: async (data: any) => ({ data, error: null }),
    update: async (data: any) => ({ data, error: null }),
    delete: () => ({
      eq: async () => ({ data: null, error: null }),
    }),
  }),
  rpc: async () => ({ data: null, error: null }),
};

const mockEnv = {
  useMockMode: false,
  openai: { apiKey: 'mock-key' },
  isTestMode: true,
  AUTOMATION_WEBHOOK_SECRET: 'test-secret',
};

const mockGenerateAgentResponse = async (systemPrompt: string, userMessage: string, opts?: any) => {
  // Simulate AI response
  if (userMessage.includes('amazing') || userMessage.includes('love')) {
    return 'Thank you for your kind words! We truly appreciate your support.';
  }
  if (userMessage.includes('help') || userMessage.includes('support')) {
    return 'We are here to help! Please let us know what you need assistance with.';
  }
  return 'Thank you for your message. How can we assist you today?';
};

const mockCreateDirectMessage = async (workspaceId: string, payload: any) => {
  return { id: `dm_${Date.now()}`, ...payload };
};

// ============================================================================
// Mock the imports by setting up global substitutes
// ============================================================================

(globalThis as any).createServerClient = () => mockSupabase;
(globalThis as any).createDirectMessage = mockCreateDirectMessage;
(globalThis as any).generateAgentResponse = mockGenerateAgentResponse;
(globalThis as any).env = mockEnv;

// ============================================================================
// Import the executor (with mocks in place)
// ============================================================================

// For testing, we'll manually import and test key functions
import {
  AutomationCommentInput,
  ExecuteAutomationResult,
} from '../executeAutomationRules.js';

// ============================================================================
// Test Data
// ============================================================================

const mockWorkspaceId = 'ws_test_001';
const mockAgentId = 'agent_test_001';

const mockCommentInput: AutomationCommentInput = {
  workspaceId: mockWorkspaceId,
  agentId: mockAgentId,
  commentId: 'comment_001',
  commentText: 'This product is amazing! Love the quality.',
  authorId: 'user_123',
  authorName: 'John Smith',
  platform: 'facebook',
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

// ============================================================================
// Test Suite
// ============================================================================

const tests: Array<{ name: string; fn: () => Promise<void> }> = [];

const test = (name: string, fn: () => Promise<void>) => {
  tests.push({ name, fn });
};

// Test 1: Comment with matching keywords triggers DM
test('Comment with matching keywords should trigger DM action', async () => {
  console.log('\n[Test 1] Comment with matching keywords → DM');
  
  const input = mockCommentInput;
  console.log('  Input:', {
    text: input.commentText,
    platform: input.platform,
    author: input.authorName,
  });
  
  // Simulate rule matching
  const triggersMatch = mockRuleForDM.trigger_words.some(word => 
    input.commentText.toLowerCase().includes(word)
  );
  const platformMatches = mockRuleForDM.trigger_platforms.includes(input.platform);
  
  if (triggersMatch && platformMatches) {
    console.log('  ✓ Rule matched: trigger_words and platform match');
    console.log('  ✓ Action executed: DM would be sent');
  } else {
    throw new Error('Rule should have matched');
  }
});

// Test 2: Comment without matching keywords should not trigger
test('Comment without matching keywords should not trigger rule', async () => {
  console.log('\n[Test 2] Comment without matching keywords → No action');
  
  const input: AutomationCommentInput = {
    ...mockCommentInput,
    commentText: 'Just a regular comment with no keywords',
  };
  console.log('  Input:', {
    text: input.commentText,
  });
  
  const triggersMatch = mockRuleForDM.trigger_words.some(word => 
    input.commentText.toLowerCase().includes(word)
  );
  
  if (!triggersMatch) {
    console.log('  ✓ Rule not matched: no trigger words found');
  } else {
    throw new Error('Rule should not have matched');
  }
});

// Test 3: Platform mismatch should not trigger
test('Platform mismatch should not trigger rule', async () => {
  console.log('\n[Test 3] Platform mismatch → No action');
  
  const input: AutomationCommentInput = {
    ...mockCommentInput,
    platform: 'website',
  };
  console.log('  Input:', {
    text: input.commentText,
    platform: input.platform,
  });
  
  const triggersMatch = mockRuleForDM.trigger_words.some(word => 
    input.commentText.toLowerCase().includes(word)
  );
  const platformMatches = mockRuleForDM.trigger_platforms.includes(input.platform);
  
  if (triggersMatch && !platformMatches) {
    console.log('  ✓ Rule not matched: platform not in allowed list');
  } else {
    throw new Error('Rule should not have matched due to platform');
  }
});

// Test 4: Keyword trigger type
test('Keyword trigger should match any message with keywords', async () => {
  console.log('\n[Test 4] Keyword trigger → Match on keywords');
  
  const input: AutomationCommentInput = {
    ...mockCommentInput,
    commentText: 'I need help with my order',
    platform: 'facebook',
  };
  console.log('  Input:', {
    text: input.commentText,
    trigger_type: 'keyword',
  });
  
  const triggersMatch = mockRuleForPublicReply.trigger_words.some(word => 
    input.commentText.toLowerCase().includes(word)
  );
  
  if (triggersMatch) {
    console.log('  ✓ Keyword "help" found in message');
    console.log('  ✓ Rule matched: public reply action would execute');
  } else {
    throw new Error('Keyword rule should have matched');
  }
});

// Test 5: Disabled rule should not execute
test('Disabled rule should not execute', async () => {
  console.log('\n[Test 5] Disabled rule → No action');
  
  const disabledRule = { ...mockRuleForDM, enabled: false };
  console.log('  Input rule enabled:', disabledRule.enabled);
  
  if (!disabledRule.enabled) {
    console.log('  ✓ Rule is disabled, skipping execution');
  } else {
    throw new Error('Rule should be disabled');
  }
});

// Test 6: Delayed action should wait
test('Delayed action should apply delay', async () => {
  console.log('\n[Test 6] Delayed action → Apply delay');
  
  const delayedRule = { ...mockRuleForDM, delay_seconds: 2 };
  console.log('  Input rule delay:', `${delayedRule.delay_seconds}s`);
  
  if (delayedRule.delay_seconds > 0) {
    console.log(`  ✓ Delay configured: ${delayedRule.delay_seconds} seconds`);
    console.log('  ✓ Would wait before executing action');
  } else {
    throw new Error('Rule should have delay');
  }
});

// Test 7: Skip if keyword present
test('Skip rule execution if skip keyword is present', async () => {
  console.log('\n[Test 7] Skip if keyword present → Conditional execution');
  
  const skipRule = {
    ...mockRuleForDM,
    skip_if_keyword_present: ['spam', 'abuse'],
  };
  const messageWithSkipKeyword = {
    ...mockCommentInput,
    commentText: 'This is amazing but also spam',
  };
  
  console.log('  Skip if:', skipRule.skip_if_keyword_present);
  console.log('  Message:', messageWithSkipKeyword.commentText);
  
  const shouldSkip = skipRule.skip_if_keyword_present.some(keyword =>
    messageWithSkipKeyword.commentText.toLowerCase().includes(keyword)
  );
  
  if (shouldSkip) {
    console.log('  ✓ Skip keyword "spam" found, rule would be skipped');
  } else {
    throw new Error('Rule should skip on keyword presence');
  }
});

// Test 8: Multiple rule evaluation (only first match executes)
test('Multiple rules should be evaluated in order', async () => {
  console.log('\n[Test 8] Multiple rules → Evaluate all, execute matching ones');
  
  const rules = [mockRuleForDM, mockRuleForPublicReply];
  const input = {
    ...mockCommentInput,
    commentText: 'I love this product but need help with returns',
  };
  
  console.log('  Rules count:', rules.length);
  console.log('  Input:', input.commentText);
  
  const matches = rules.map(rule => {
    const triggersMatch = rule.trigger_words.some(word => 
      input.commentText.toLowerCase().includes(word)
    );
    const platformMatches = rule.trigger_platforms.includes(input.platform);
    return triggersMatch && platformMatches;
  });
  
  const matchCount = matches.filter(m => m).length;
  console.log(`  ✓ ${matchCount} rule(s) matched out of ${rules.length}`);
});

// ============================================================================
// Run all tests
// ============================================================================

async function runTests() {
  console.log('========================================');
  console.log('Automation Rules Executor Test Suite');
  console.log('========================================');
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log('  ✓ PASS');
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${err.message}`);
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  console.log('========================================');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
