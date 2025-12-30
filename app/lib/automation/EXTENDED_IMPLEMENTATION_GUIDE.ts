// @ts-nocheck
/**
 * Extended Triggers & Actions: Implementation Guide
 * 
 * This guide shows how to use the new keyword triggers and public reply
 * actions in production without modifying endpoints or schemas.
 */

/**
 * ============================================================================
 * SETUP: Creating Rules via Existing REST API
 * ============================================================================
 */

/**
 * Create a rule with keyword trigger and public reply action
 * 
 * HTTP POST /api/automation-rules
 * 
 * Request body:
 */
const createKeywordRule = {
  "workspace_id": "ws_001",
  "agent_id": "agent_001",
  "name": "Support Request Auto-Reply",
  "description": "Detect help requests and send public + private replies",
  "type": "keyword_reply",
  "enabled": true,

  // Trigger: Match keywords in any message
  "trigger_type": "keyword",
  "trigger_words": ["help", "support", "urgent", "problem"],
  "trigger_platforms": ["facebook", "instagram", "website"],

  // Action: Send public reply
  "action_type": "send_public_reply",
  "send_public_reply": true,
  "public_reply_template": "Thank you for reaching out! Our team will assist you shortly. Check your DM for direct contact.",

  // Optional: Also send DM
  "send_private_reply": true,
  "private_reply_template": "Hi {name}, we received your request. Our support team will respond within 2 hours.",

  // Advanced options
  "auto_skip_replies": true,  // Don't reply if already replied
  "delay_seconds": 0,
  "skip_if_keyword_present": ["bot", "automated"],  // Don't reply to bot messages
};

/**
 * ============================================================================
 * USAGE: Calling the Extended Executor in Webhook Handler
 * ============================================================================
 */

/**
 * Example: Facebook Webhook Handler with Keyword & Public Reply Support
 */
async function handleFacebookCommentWebhook(req: any, res: any) {
  const body = req.body;

  // Extract comment from webhook
  const commentData = {
    id: body.entry[0].changes[0].value.comment_id,
    message: body.entry[0].changes[0].value.message,
    post_id: body.entry[0].changes[0].value.post_id,
    from: body.entry[0].changes[0].value.from, // { id, name }
  };

  // Look up workspace and agent for this page
  const workspace = await db.query('SELECT * FROM workspaces WHERE facebook_page_id = ?', [
    body.entry[0].id,
  ]);
  const agent = await db.query('SELECT * FROM agents WHERE workspace_id = ?', [
    workspace.id,
  ]);

  if (!workspace || !agent) {
    return res.status(400).json({ error: 'Workspace or agent not found' });
  }

  // Call extended executor with keyword & public reply support
  const result = await executeAutomationRulesForMessage({
    workspaceId: workspace.id,
    agentId: agent.id,
    commentId: commentData.id,
    commentText: commentData.message,
    authorId: commentData.from.id,
    authorName: commentData.from.name,
    platform: 'facebook',
    postId: commentData.post_id,  // Needed for public replies
    messageType: 'comment',         // Type of message
  });

  // Log execution
  if (result.ok) {
    if (result.ruleMatched) {
      if (result.dmSent) {
        console.log(`✓ DM sent to ${commentData.from.name}`);
      }
      if (result.replySent) {
        console.log(`✓ Public reply queued for post ${commentData.post_id}`);
      }
    } else {
      console.log('No matching rules');
    }
  } else {
    console.error('Automation error:', result.error);
  }

  return res.status(200).json({ received: true });
}

/**
 * ============================================================================
 * ADVANCED: Combining Keyword Triggers with Multiple Actions
 * ============================================================================
 */

/**
 * Create two rules: one for keyword trigger with public reply,
 * another for keyword trigger with DM
 * 
 * This allows different responses for the same keyword:
 * - Public reply for visibility
 * - Private DM for direct communication
 */
const twoRuleSetup = {
  rule1: {
    name: "Customer Issue - Public Acknowledgment",
    trigger_type: "keyword",
    trigger_words: ["broken", "damaged", "not working"],
    action_type: "send_public_reply",
    send_public_reply: true,
    public_reply_template: "We're sorry to hear about this issue. Our team will contact you shortly to make it right!",
    auto_skip_replies: false,
  },
  rule2: {
    name: "Customer Issue - Private Support",
    trigger_type: "keyword",
    trigger_words: ["broken", "damaged", "not working"],
    action_type: "send_dm",
    send_private_reply: true,
    private_reply_template: "Hi {name}, we received your report about a defective product. Our support team will resolve this within 24 hours.",
    delay_seconds: 2,  // Wait for public reply first
  },
};

/**
 * Execution flow:
 * 1. Comment arrives with keyword "broken"
 * 2. Rule 1 matches → Public reply posted
 * 3. Rule 2 matches → DM sent after 2 second delay
 * 4. Both actions complete, result: dmSent=true, replySent=true
 */

/**
 * ============================================================================
 * EXAMPLE: Real-World Scenario
 * ============================================================================
 */

/**
 * Scenario: E-commerce company gets customer comment
 * 
 * Comment: "Just received my order but the item is broken 😞"
 * 
 * Active Rules:
 * 1. Keyword "broken" → Public reply acknowledging issue
 * 2. Keyword "broken" → DM with support form
 * 3. Comment contains "😞" or "sad" emoji → Send discount code
 * 
 * Execution:
 * 
 *   Comment arrives
 *   ↓
 *   Load all enabled rules for workspace
 *   ↓
 *   Rule 1: trigger_type='keyword', trigger_words=['broken']
 *   ├─ Keyword found in comment ✓
 *   ├─ Platform is facebook ✓
 *   └─ Execute: send_public_reply
 *      → Post public reply: "We're sorry about this! Check your DM for next steps."
 *      → Queued successfully
 *   ↓
 *   Rule 2: trigger_type='keyword', trigger_words=['broken']
 *   ├─ Keyword found in comment ✓
 *   ├─ Platform is facebook ✓
 *   ├─ delay_seconds=2, wait...
 *   └─ Execute: send_dm
 *      → Generate DM: "Hi Sarah, we're sending you a replacement item immediately."
 *      → Sent successfully
 *   ↓
 *   Rule 3: trigger_type='keyword', trigger_words=['sad', 'emoji:😞']
 *   ├─ No matching implementation for emoji (future enhancement)
 *   └─ Skipped
 *   ↓
 *   Result:
 *   {
 *     ok: true,
 *     ruleMatched: true,      // Rules 1 & 2 matched
 *     actionExecuted: true,   // Both actions executed
 *     dmSent: true,
 *     replySent: true,
 *   }
 */

/**
 * ============================================================================
 * TESTING: Validation Checklist
 * ============================================================================
 */

/**
 * Before deploying keyword/public reply rules to production:
 * 
 * Functionality Tests:
 *   ☐ Keyword matching works (case-insensitive)
 *   ☐ Platform filtering works
 *   ☐ Public reply template renders correctly
 *   ☐ DM template renders correctly
 *   ☐ Multiple matching rules execute in order
 *   ☐ Delays are applied correctly
 *   ☐ auto_skip_replies prevents duplicate replies
 * 
 * Security Tests:
 *   ☐ Cannot access rules from different workspace
 *   ☐ Cannot create rule without subscription
 *   ☐ RLS policies enforced on all queries
 *   ☐ Agent access restricted to agent's workspace
 *   ☐ No data leakage between workspaces
 * 
 * Error Handling Tests:
 *   ☐ Missing postId doesn't crash (logs warning, continues)
 *   ☐ AI generation failure falls back to template
 *   ☐ Database error doesn't cause webhook retry
 *   ☐ Invalid trigger_type is skipped
 *   ☐ Invalid action_type is skipped
 * 
 * Performance Tests:
 *   ☐ Single comment processing < 500ms
 *   ☐ Database queries are indexed (workspace_id, agent_id)
 *   ☐ No N+1 queries
 *   ☐ Multiple rules don't cause exponential slowdown
 *   ☐ Keyword matching performs well (simple substring)
 */

/**
 * ============================================================================
 * MONITORING & LOGGING
 * ============================================================================
 */

/**
 * Key logs to monitor execution:
 * 
 * Debug logs (console.log):
 *   [Automation Rules] Processing comment/message
 *   [Automation Rules] Failed to fetch rules
 *   [Automation Rules] No enabled rules for agent
 *   [Automation Rules] Rule X triggered for comment Y
 *   [Automation Rules] Rule X skipped (platform mismatch)
 *   [Automation Rules] DM sent to user Z
 *   [Automation Rules] Public reply queued for post X
 * 
 * Error logs (console.error):
 *   [Automation Rules] Failed to fetch rules: {error}
 *   [Automation Rules] Failed to execute rule X: {error}
 *   [Automation Rules] Agent not found: {error}
 *   [Automation Rules] Failed to create DM: {error}
 *   [Automation Rules] Failed to store public reply: {error}
 * 
 * Warning logs (console.warn):
 *   [Automation Rules] Rule X has trigger_type=keyword but no trigger_words
 *   [Automation Rules] Rule X has send_public_reply=false, skipping reply
 *   [Automation Rules] Rule X skipped: no author info for DM
 *   [Automation Rules] Failed to generate AI response, using template
 *   [Automation Rules] Failed to check for existing replies
 */

/**
 * ============================================================================
 * COMMON PATTERNS
 * ============================================================================
 */

/**
 * Pattern 1: Public Reply Only (No DM)
 * 
 * Use when: You want public visibility but don't need private communication
 * 
 * Configuration:
 *   trigger_type: 'keyword'
 *   trigger_words: ['question', 'inquiry']
 *   action_type: 'send_public_reply'
 *   send_public_reply: true
 *   send_private_reply: false
 * 
 * Result: Only public reply is sent
 */

/**
 * Pattern 2: Keyword Detection + Multiple Actions
 * 
 * Use when: Complex workflows with multiple notification channels
 * 
 * Configuration:
 *   Rule 1: keyword → send_public_reply (public acknowledgment)
 *   Rule 2: keyword → send_dm (private details)
 *   Rule 3: keyword → [future] send_email (team notification)
 * 
 * Result: All three actions execute in sequence
 */

/**
 * Pattern 3: Comment-Only Trigger (Backward Compatible)
 * 
 * Use when: Original comment → DM workflow still needed
 * 
 * Configuration:
 *   trigger_type: 'comment'
 *   trigger_words: ['great', 'amazing']
 *   action_type: 'send_dm'
 *   send_private_reply: true
 * 
 * Result: Works exactly like original implementation
 */

/**
 * Pattern 4: Escalation Workflow
 * 
 * Use when: Different actions based on severity
 * 
 * Configuration:
 *   Rule 1: keyword=['help'] → send_public_reply (immediate)
 *   Rule 2: keyword=['help'] → send_dm (support form link)
 *   Rule 3: keyword=['urgent'] → [future] create_ticket (high priority)
 * 
 * Result: Progressive response escalation
 */

/**
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 */

/**
 * Issue: Rules not matching
 * 
 * Causes:
 * - Keywords are case-sensitive check: use .toLowerCase()
 * - Platform mismatch: verify trigger_platforms includes message platform
 * - Rule not enabled: check enabled=true in database
 * - Partial word match: "help" matches "helpful" (intended behavior)
 * 
 * Debug:
 * - Check logs: "[Automation Rules] Rule X skipped (platform mismatch)"
 * - Verify rule: SELECT * FROM automation_rules WHERE id='rule_id'
 * - Test manually: Use test endpoint to simulate comment
 * 
 * 
 * Issue: Actions not executing
 * 
 * Causes:
 * - send_public_reply=false: public replies not enabled for rule
 * - send_private_reply=false: DMs not enabled for rule
 * - Missing postId: public replies need post ID
 * - Missing authorId: DMs need recipient info
 * 
 * Debug:
 * - Check logs: "[Automation Rules] Rule X has send_public_reply=false"
 * - Verify action is enabled: check send_public_reply or send_private_reply
 * - Check required fields: postId for public, authorId for DM
 * 
 * 
 * Issue: Template rendering incorrect
 * 
 * Causes:
 * - Placeholder syntax wrong: use {name} not {name:format}
 * - Missing agent system_prompt: AI generation fails, falls back to template
 * - OpenAI API error: check OPENAI_API_KEY environment variable
 * 
 * Debug:
 * - Check logs: "[Automation Rules] Failed to generate AI response"
 * - Verify placeholders: {name}, {product} only (others are ignored)
 * - Test template manually: render with sample data
 * 
 * 
 * Issue: Performance slowdown
 * 
 * Causes:
 * - Too many rules: loading all rules for agent
 * - Many keywords: keyword matching is O(n)
 * - AI generation: slower with higher max_tokens
 * - Database indexes: missing on workspace_id, agent_id
 * 
 * Optimization:
 * - Cache rules for 5-10 minutes
 * - Limit trigger_words to 10 per rule
 * - Reduce AI max_tokens to 150
 * - Verify indexes exist on automation_rules table
 */

/**
 * ============================================================================
 * MIGRATION: Moving from Comment-Only to Extended Rules
 * ============================================================================
 */

/**
 * Step 1: Create new keyword-based rules
 * 
 * POST /api/automation-rules
 * {
 *   "trigger_type": "keyword",
 *   "action_type": "send_public_reply",
 *   // ... other fields
 * }
 * 
 * 
 * Step 2: Test new rules in staging environment
 * 
 * - Verify rules trigger correctly
 * - Verify actions execute
 * - Check performance (should be < 500ms per comment)
 * 
 * 
 * Step 3: Enable rules for subset of users
 * 
 * - Create rules for specific workspace
 * - Monitor execution logs
 * - Collect feedback from users
 * 
 * 
 * Step 4: Roll out to all users
 * 
 * - Enable keyword rules for all active workspaces
 * - Keep original comment rules active
 * - Both can coexist without conflict
 * 
 * 
 * Step 5: Deprecate original rules (optional)
 * 
 * - Original comment → send_dm still works
 * - Can be left as-is
 * - Or gradually migrate to keyword triggers
 */
