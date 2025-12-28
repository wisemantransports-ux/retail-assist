/**
 * Extended Automation Executor: Keyword Triggers & Public Replies
 * 
 * This document describes the extended functionality added to the automation
 * rules executor without modifying existing endpoints or schemas.
 */

/**
 * ============================================================================
 * NEW TRIGGERS: Keyword Matching
 * ============================================================================
 * 
 * Trigger Type: 'keyword'
 * 
 * Description:
 *   Match rules based on keywords in any message, not just comments.
 *   Enables automation on support requests, general questions, or specific
 *   topics regardless of message type.
 * 
 * Configuration:
 *   - trigger_type: 'keyword'
 *   - trigger_words: ['help', 'support', 'issue', 'problem']
 *   - trigger_platforms: ['facebook', 'instagram', 'website', 'whatsapp']
 * 
 * Behavior:
 *   1. Check if rule is enabled and trigger_type='keyword'
 *   2. Check if any trigger_word appears in message text (case-insensitive)
 *   3. Check if message platform matches trigger_platforms
 *   4. If all match: execute rule action
 * 
 * Example Use Cases:
 * 
 *   Rule 1: Customer Support Detection
 *   - Trigger: Keywords ['help', 'support', 'urgent']
 *   - Action: Send DM with support form link
 *   
 *   Rule 2: Product Inquiry
 *   - Trigger: Keywords ['price', 'available', 'shipping']
 *   - Action: Send public reply with product info
 *   
 *   Rule 3: Complaint Detection
 *   - Trigger: Keywords ['broken', 'damaged', 'defective']
 *   - Action: Send DM escalating to support team
 * 
 * Implementation Details:
 *   - Function: checkTriggerMatch()
 *   - Case-insensitive substring matching (uses .toLowerCase().includes())
 *   - No regex (keeps logic simple)
 *   - Matches entire message, not just keywords
 * 
 * Notes:
 *   - Keyword matching is stateless (no context tracking)
 *   - All keywords are case-insensitive
 *   - Partial word matches are supported (e.g., 'help' matches 'helpful')
 *   - Can be combined with auto_skip_replies to avoid duplicate responses
 */

/**
 * ============================================================================
 * NEW ACTIONS: Public Replies on Posts/Comments
 * ============================================================================
 * 
 * Action Type: 'send_public_reply'
 * 
 * Description:
 *   Post a reply directly on the original comment or post, making the
 *   response visible to all platform users. Useful for:
 *   - Answering frequently asked questions
 *   - Addressing concerns publicly
 *   - Building community engagement
 * 
 * Configuration:
 *   - action_type: 'send_public_reply'
 *   - send_public_reply: true
 *   - public_reply_template: "Thank you! We appreciate your feedback..."
 * 
 * Behavior:
 *   1. Check if rule has action_type='send_public_reply'
 *   2. Check if send_public_reply=true
 *   3. Verify postId is available (required to know where to reply)
 *   4. Generate reply using template or AI
 *   5. Store reply metadata in comments table
 *   6. [Future] Call platform API to post the reply
 * 
 * Data Storage:
 *   - Replies are stored in the 'comments' table
 *   - Fields used:
 *     * content: The reply text
 *     * bot_reply: Copy of the reply content
 *     * bot_reply_id: Unique ID for tracking
 *     * post_id: ID of original post/comment
 *     * platform: facebook, instagram, website, etc.
 *     * processed: Marked as true (processed reply)
 * 
 * Template Placeholders:
 *   - {name}: Commenter's name
 *   - {product}: Product being discussed
 *   - {date}: Current date
 * 
 * Example Templates:
 * 
 *   Template 1: Grateful Response
 *   "Thank you so much {name}! We're thrilled you love our product! 🙏"
 *   
 *   Template 2: Question Answer
 *   "Great question {name}! You can find details here: [link]"
 *   
 *   Template 3: Support Escalation
 *   "We're sorry to hear about the issue. Please reach out to support@..."
 *   
 *   Template 4: AI-Generated (with placeholders)
 *   "Hi {name}, Thank you for your feedback about {product}! 
 *    [AI generates personalized response based on comment]"
 * 
 * Implementation Details:
 *   - Function: executeSendPublicReplyAction()
 *   - AI generation with lower temperature (0.5) for formal tone
 *   - Stores reply in comments table for tracking
 *   - Note: Actual API posting is handled separately in production
 * 
 * Production Implementation:
 *   When platform APIs are integrated, additional code would:
 *   - Call Facebook Graph API /comments/{id}/replies
 *   - Call Instagram Graph API comment.replies
 *   - Use platform-specific rate limiting
 *   - Store platform response IDs for tracking
 */

/**
 * ============================================================================
 * ARCHITECTURE: No Breaking Changes
 * ============================================================================
 * 
 * The extended executor maintains 100% backward compatibility:
 * 
 * 1. Original Endpoint: executeAutomationRulesForComment()
 *    - Still exists with original signature
 *    - Still works for comment → send_dm workflows
 *    - No changes to return type (backward compatible)
 * 
 * 2. New Endpoint: executeAutomationRulesForMessage()
 *    - Extended input with optional fields (postId, pageAccessToken, messageType)
 *    - Backward compatible input (AutomationCommentInput extends into AutomationMessageInput)
 *    - Returns extended result (includes replySent field)
 * 
 * 3. Shared Internal Functions:
 *    - checkTriggerMatch(): Evaluates triggers (comment, keyword, time, manual)
 *    - executeRuleActionExtended(): Dispatches to action handlers
 *    - executeSendDmAction(): Original DM logic (unchanged)
 *    - executeSendPublicReplyAction(): New public reply handler
 * 
 * 4. Database Schema:
 *    - No changes required (automation_rules table already has all fields)
 *    - No new tables needed
 *    - Works with existing RLS policies
 *    - Subscription gating enforced at executor level
 * 
 * 5. API Endpoints:
 *    - No changes to /api/automation-rules
 *    - No changes to /api/automation-rules/[id]
 *    - Existing REST API continues to work
 *    - New triggers/actions can be configured via existing endpoints
 */

/**
 * ============================================================================
 * SECURITY: RLS & Workspace Isolation
 * ============================================================================
 * 
 * All new features respect existing security:
 * 
 * 1. RLS Policies (from migration 007):
 *    - automation_rules SELECT: User must be in workspace_members
 *    - comments INSERT: User must be in workspace_members (for public replies)
 *    - agents SELECT: User must be in workspace_members
 * 
 * 2. Workspace Isolation:
 *    - All queries filtered by workspace_id
 *    - Cross-workspace access prevented at database level
 *    - Agent access restricted to agent's workspace
 * 
 * 3. Subscription Gating:
 *    - Enforced via checkWorkspaceActive() at API layer
 *    - Workspace must have subscription_status='active'
 *    - Applies to all actions (send_dm, send_public_reply, future actions)
 * 
 * 4. Role-Based Access:
 *    - Comments INSERT requires admin or owner role
 *    - automation_rules SELECT allows member/admin/owner
 *    - RLS policies enforce at database level
 * 
 * Example Security Flow:
 *   User submits rule → API validates subscription → Executor loads rules
 *   Executor checks workspace membership → Database RLS enforces access
 *   Comment arrives → Executor validates workspace → Applies rule
 *   Action executes → Database RLS enforces write permission
 */

/**
 * ============================================================================
 * USAGE: Integration Patterns
 * ============================================================================
 * 
 * Pattern 1: Original Comment → Send_DM (Unchanged)
 * 
 *   const result = await executeAutomationRulesForComment({
 *     workspaceId: 'ws_001',
 *     agentId: 'agent_001',
 *     commentId: 'fb_comment_123',
 *     commentText: 'Great product!',
 *     authorId: 'user_456',
 *     authorName: 'John',
 *     platform: 'facebook',
 *   });
 * 
 *   if (result.dmSent) console.log('✓ DM sent');
 * 
 * 
 * Pattern 2: Extended Message → Multiple Actions
 * 
 *   const result = await executeAutomationRulesForMessage({
 *     workspaceId: 'ws_001',
 *     agentId: 'agent_001',
 *     commentId: 'fb_comment_123',
 *     commentText: 'I need help with my order',
 *     authorId: 'user_456',
 *     authorName: 'Jane',
 *     platform: 'facebook',
 *     postId: 'post_789',              // For public replies
 *     messageType: 'comment',           // Type of message
 *   });
 * 
 *   if (result.dmSent) console.log('✓ DM sent');
 *   if (result.replySent) console.log('✓ Public reply queued');
 * 
 * 
 * Pattern 3: Webhook Handler (Keywords + Public Replies)
 * 
 *   async function handleCommentWebhook(comment) {
 *     const result = await executeAutomationRulesForMessage({
 *       workspaceId: comment.workspace_id,
 *       agentId: comment.agent_id,
 *       commentId: comment.id,
 *       commentText: comment.content,
 *       authorId: comment.author_id,
 *       authorName: comment.author_name,
 *       platform: 'facebook',
 *       postId: comment.post_id,
 *       messageType: 'comment',
 *     });
 * 
 *     return {
 *       success: result.ok,
 *       ruleMatched: result.ruleMatched,
 *       dmSent: result.dmSent,
 *       replySent: result.replySent,
 *       error: result.error,
 *     };
 *   }
 */

/**
 * ============================================================================
 * TESTING: Validation & Edge Cases
 * ============================================================================
 * 
 * Test Coverage (10 scenarios):
 * 
 *   1. Comment matches keywords → DM sent
 *   2. Comment misses keywords → No action
 *   3. Platform mismatch → Rule skipped
 *   4. No rules exist → Graceful return
 *   5. Multiple rules → All matching rules execute
 *   6. auto_skip_replies → Existing reply check
 *   7. Keyword trigger → Matches in any message
 *   8. Public reply action → Queued for posting
 *   9. Keyword + public reply → Both trigger and action work
 *   10. Trigger type evaluation → Correct message type handling
 * 
 * Error Handling:
 * 
 *   Agent not found:
 *   - Logs error, throws exception
 *   - Rule execution halts gracefully
 *   - Returns error in response
 * 
 *   Missing postId for public reply:
 *   - Logs warning, skips that action
 *   - Continues to next rule
 *   - Returns ruleMatched=true, actionExecuted=false
 * 
 *   AI generation fails:
 *   - Falls back to template content
 *   - Logs warning, doesn't crash
 *   - Sends reply with template or default text
 * 
 *   Database error:
 *   - If mock mode: returns mock result
 *   - If real DB: returns error in response
 *   - Webhook returns 200 (doesn't retry)
 */

/**
 * ============================================================================
 * FLOW DIAGRAMS
 * ============================================================================
 * 
 * Comment with Keywords → Multiple Rules → Mixed Actions
 * 
 *   Comment: "I need help with your product"
 *   ↓
 *   Load all enabled rules for agent
 *   ├─ Rule 1: trigger_type='comment', trigger_words=['amazing'], action='send_dm'
 *   ├─ Rule 2: trigger_type='keyword', trigger_words=['help'], action='send_public_reply'
 *   └─ Rule 3: trigger_type='keyword', trigger_words=['defective'], action='send_dm'
 *   ↓
 *   Evaluate Rule 1: keyword 'amazing' not found → Skip
 *   Evaluate Rule 2: keyword 'help' found ✓ → Execute public reply action
 *   Evaluate Rule 3: keyword 'defective' not found → Skip
 *   ↓
 *   Result:
 *   {
 *     ok: true,
 *     ruleMatched: true,        // Rule 2 matched
 *     actionExecuted: true,     // Public reply action executed
 *     dmSent: false,            // No DM sent
 *     replySent: true,          // Public reply queued
 *   }
 * 
 * 
 * Trigger Type Evaluation
 * 
 *   Message arrives
 *   ├─ trigger_type='comment'
 *   │  └─ Only trigger on comments
 *   │     ├─ If messageType='comment' → Check keywords
 *   │     └─ If messageType='dm' → Skip
 *   │
 *   ├─ trigger_type='keyword'
 *   │  └─ Trigger on any message with keywords
 *   │     ├─ If keywords match → Trigger
 *   │     └─ If no keywords → Skip
 *   │
 *   ├─ trigger_type='time'
 *   │  └─ [Not yet implemented]
 *   │
 *   └─ trigger_type='manual'
 *      └─ [Not yet implemented]
 * 
 * 
 * Action Execution
 * 
 *   Rule matched
 *   ├─ action_type='send_dm'
 *   │  └─ Generate response (template or AI)
 *   │     └─ Call createDirectMessage()
 *   │        └─ Insert into direct_messages table
 *   │
 *   ├─ action_type='send_public_reply'
 *   │  └─ Generate response (template or AI)
 *   │     └─ Store in comments table as bot_reply
 *   │     └─ [Future] Call platform API to post
 *   │
 *   ├─ action_type='send_email'
 *   │  └─ [Not yet implemented]
 *   │
 *   └─ action_type='send_webhook'
 *      └─ [Not yet implemented]
 */

/**
 * ============================================================================
 * CONFIGURATION EXAMPLES
 * ============================================================================
 */

/**
 * Example 1: Support Request Auto-Reply
 * 
 * Trigger: Customer asks for help
 * Action: Send public reply with support form link + DM with direct contact
 * 
 * Rules:
 * [
 *   {
 *     name: "Support Request Detection",
 *     trigger_type: "keyword",
 *     trigger_words: ["help", "support", "problem", "issue"],
 *     trigger_platforms: ["facebook", "instagram", "website"],
 *     action_type: "send_public_reply",
 *     send_public_reply: true,
 *     public_reply_template: "Thanks for reaching out! Our team is ready to help. 
 *                             Please check your DM for direct assistance.",
 *     delay_seconds: 0,
 *     auto_skip_replies: true,
 *   },
 *   {
 *     name: "Send Support Form Link via DM",
 *     trigger_type: "keyword",
 *     trigger_words: ["help", "support", "problem", "issue"],
 *     trigger_platforms: ["facebook", "instagram", "website"],
 *     action_type: "send_dm",
 *     send_private_reply: true,
 *     private_reply_template: "Hi {name}, thanks for reaching out! 
 *                              Please fill out this form so we can help you faster: [link]",
 *     delay_seconds: 2,  // Wait for public reply first
 *     auto_skip_replies: true,
 *   }
 * ]
 */

/**
 * Example 2: Product Appreciation Recognition
 * 
 * Trigger: Customer leaves positive comment
 * Action: Send public reply thanking them + DM with exclusive offer
 * 
 * Rules:
 * [
 *   {
 *     name: "Public Appreciation Response",
 *     trigger_type: "comment",
 *     trigger_words: ["love", "amazing", "great", "excellent", "perfect"],
 *     trigger_platforms: ["facebook", "instagram"],
 *     action_type: "send_public_reply",
 *     send_public_reply: true,
 *     public_reply_template: "Thank you so much {name}! We love hearing this! 💙 
 *                             Your support means everything to our team.",
 *     auto_skip_replies: true,
 *   },
 *   {
 *     name: "Send VIP Thank You",
 *     trigger_type: "comment",
 *     trigger_words: ["love", "amazing", "great", "excellent", "perfect"],
 *     trigger_platforms: ["facebook", "instagram"],
 *     action_type: "send_dm",
 *     send_private_reply: true,
 *     private_reply_template: "Hi {name}! As our VIP customer, enjoy 15% off your next order. 
 *                              Use code: THANK-YOU-15",
 *     delay_seconds: 3,
 *   }
 * ]
 */

/**
 * Example 3: Complaint Escalation
 * 
 * Trigger: Customer mentions defect or damage
 * Action: Send supportive public reply + High-priority DM to support
 * 
 * Rules:
 * [
 *   {
 *     name: "Complaint Public Response",
 *     trigger_type: "keyword",
 *     trigger_words: ["broken", "damaged", "defective", "not working"],
 *     trigger_platforms: ["facebook", "instagram"],
 *     action_type: "send_public_reply",
 *     send_public_reply: true,
 *     public_reply_template: "We're sorry to hear about this issue. 
 *                             Please check your DM - our team will make it right!",
 *     auto_skip_replies: false,
 *   },
 *   {
 *     name: "Escalate to Support Team",
 *     trigger_type: "keyword",
 *     trigger_words: ["broken", "damaged", "defective", "not working"],
 *     trigger_platforms: ["facebook", "instagram"],
 *     action_type: "send_dm",
 *     send_private_reply: true,
 *     private_reply_template: "Hi {name}, we've received your report about a {product} issue. 
 *                              Our support team is prioritizing your case. 
 *                              Expected resolution: within 24 hours.",
 *     delay_seconds: 1,
 *   }
 * ]
 */

/**
 * ============================================================================
 * LIMITATIONS & FUTURE WORK
 * ============================================================================
 * 
 * Current Limitations:
 * 
 *   1. Keyword matching is simple substring search
 *      - No regex support
 *      - No context awareness
 *      - May match partial words
 *      - No negation (exclude keywords)
 * 
 *   2. Public replies require post ID
 *      - Can't detect orphaned comments
 *      - Platform API not integrated yet
 *      - Replies stored locally, not sent to platform
 * 
 *   3. Template variables are limited
 *      - Only {name} and {product} supported
 *      - No computed fields
 *      - No conditional logic
 * 
 *   4. Time-based triggers not implemented
 *      - Can't schedule message sends
 *      - Can't trigger on specific times/dates
 * 
 *   5. Manual triggers not implemented
 *      - Can't trigger from UI
 *      - Can't trigger via webhook
 * 
 * Future Enhancements:
 * 
 *   Phase 5.1: Advanced Matching
 *   - Regex pattern support
 *   - Negative keywords (NOT broken AND NOT defective)
 *   - Sentiment analysis (positive, negative, neutral)
 *   - Language detection
 * 
 *   Phase 5.2: Platform Integration
 *   - Facebook Graph API for posting replies
 *   - Instagram API for comment replies
 *   - WhatsApp Business API
 *   - Email delivery via SendGrid/SES
 * 
 *   Phase 5.3: Advanced Actions
 *   - Create support tickets
 *   - Send email to internal team
 *   - Call external webhooks
 *   - Assign to user queue
 * 
 *   Phase 5.4: Complex Workflows
 *   - Multi-step automation
 *   - Conditional logic (if/else)
 *   - Branching based on keywords
 *   - Rule priorities/ordering
 * 
 *   Phase 5.5: Scheduling
 *   - Time-based triggers
 *   - Recurring messages
 *   - Holiday rules
 *   - Timezone support
 * 
 *   Phase 5.6: Analytics
 *   - Execution stats
 *   - A/B test templates
 *   - Performance metrics
 *   - Sentiment trends
 */
