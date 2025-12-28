# Automation Rules Execution Engine - Complete Implementation

## Overview

This document summarizes the **Phase 4** completion: the automation rules execution engine that consumes the REST API (Phase 3) and executes automation rules when comments arrive.

---

## What Was Built

### Core Execution Engine
**File:** `/app/lib/automation/executeAutomationRules.ts` (288 lines)

The main entry point for automation rule execution. When a comment arrives:

1. **Load rules**: Fetches all enabled automation rules for the agent from database
2. **Match triggers**: Evaluates comments against rule conditions (keywords, platform)
3. **Execute actions**: Sends DM via `createDirectMessage()` if rule matches
4. **Return result**: Indicates success, whether rule matched, and whether action executed

**Key Functions:**
- `executeAutomationRulesForComment(input: AutomationCommentInput)` - Main executor
- `executeRuleAction(rule, input)` - Action executor (DM creation)
- `shouldSkipComment(rule)` - Skip condition checker

**Interfaces:**
```typescript
// Input to executor
AutomationCommentInput {
  workspaceId: string;
  agentId: string;
  commentId: string;
  commentText: string;
  authorId?: string;
  authorName?: string;
  platform: 'facebook' | 'instagram' | 'website' | 'whatsapp';
}

// Output from executor
ExecuteAutomationResult {
  ok: boolean;                // Operation succeeded
  ruleMatched: boolean;       // Rule found and matched
  actionExecuted: boolean;    // Action was executed
  dmSent?: boolean;           // DM was sent
  error?: string;             // Error message if ok=false
}
```

---

## Execution Flow

```
Comment Incoming (webhook)
  ↓
executeAutomationRulesForComment()
  ↓
  ├─ Load automation_rules for agent
  │  (WHERE enabled=true AND trigger_type='comment')
  │
  ├─ For each rule:
  │  ├─ Check platform matches (trigger_platforms)
  │  ├─ Check keywords match (trigger_words in comment)
  │  │
  │  └─ If match:
  │     └─ executeRuleAction()
  │        ├─ Check auto_skip_replies
  │        ├─ Apply delay_seconds if configured
  │        ├─ Load agent config
  │        ├─ Generate DM response
  │        │  ├─ Use private_reply_template
  │        │  └─ Or AI-generate if template has {placeholders}
  │        │
  │        └─ Call createDirectMessage() to store DM
  │
  └─ Return result { ok, ruleMatched, actionExecuted, dmSent }
```

---

## Database Integration

The executor queries/modifies these tables:

### Read Access
- **automation_rules** - All enabled rules for the agent
  - Indexed on: `workspace_id`, `agent_id`, `enabled`
- **agents** - Agent configuration for response generation
- **direct_messages** - Check for existing replies (auto_skip_replies)

### Write Access
- **direct_messages** - Insert new DM when rule matches

### RLS Policies (Migration 007)
- SELECT automation_rules: User in workspace_members
- INSERT direct_messages: User in workspace_members with admin role
- SELECT agents: User in workspace_members

---

## Features Implemented ✅

### Triggers
- ✅ Comment received (`trigger_type='comment'`)

### Actions
- ✅ Send direct message (`action_type='send_dm'`)

### Conditions
- ✅ Keyword matching (case-insensitive substring search)
- ✅ Platform filtering (facebook, instagram, website, whatsapp)
- ✅ Delay before sending (`delay_seconds`)
- ✅ Auto-skip existing replies (`auto_skip_replies`)

### Response Generation
- ✅ Template-based (`private_reply_template`)
- ✅ AI-generated (if template has `{placeholders}` and OpenAI API available)
- ✅ Fallback to template if AI fails

---

## Integration Patterns

### Pattern 1: Standalone Webhook Handler (Recommended)

```typescript
import { executeAutomationRulesForComment } from '@/lib/automation/executeAutomationRules';

async function handleCommentWebhook(comment) {
  const result = await executeAutomationRulesForComment({
    workspaceId: 'ws_001',
    agentId: 'agent_001',
    commentId: comment.id,
    commentText: comment.text,
    authorId: comment.author.id,
    authorName: comment.author.name,
    platform: 'facebook',
  });

  if (result.ok && result.actionExecuted) {
    console.log('✓ DM sent');
  }
}
```

### Pattern 2: Backward Compatibility

Keep existing `runCommentAutomation()` and use executor as fallback:

```typescript
const result = await executeAutomationRulesForComment(input);
if (!result.ruleMatched) {
  // Fall back to old system
  await runCommentAutomation({ ... });
}
```

---

## Supported Automation Rules

### Rule Structure (from automation_rules table)

```sql
automation_rules {
  id: uuid,                          -- Rule ID
  workspace_id: uuid,                -- Workspace owner
  agent_id: uuid,                    -- Agent this applies to
  type: 'comment_to_dm',             -- Rule type
  enabled: boolean,                  -- Is rule active?
  name: varchar,                     -- Display name
  description: text,                 -- Rule description
  
  -- Trigger configuration
  trigger_type: 'comment',           -- When rule fires
  trigger_words: text[],             -- Keywords to match
  trigger_platforms: text[],         -- Which platforms (facebook, instagram)
  
  -- Action configuration
  action_type: 'send_dm',            -- What to do
  send_private_reply: boolean,       -- Send DM?
  private_reply_template: text,      -- DM content/template
  
  -- Conditions
  auto_skip_replies: boolean,        -- Skip if already replied?
  skip_if_keyword_present: text[],   -- Additional skip keywords
  delay_seconds: integer,            -- Delay before sending (0 = immediate)
  
  created_at, updated_at, deleted_at
}
```

### Example Rules

**Rule 1: Positive Feedback → Auto-Reply DM**
```json
{
  "type": "comment_to_dm",
  "trigger_words": ["amazing", "love", "great", "excellent"],
  "trigger_platforms": ["facebook", "instagram"],
  "action_type": "send_dm",
  "send_private_reply": true,
  "private_reply_template": "Thank you so much for the kind words! 🙏",
  "auto_skip_replies": true,
  "delay_seconds": 0
}
```

**Rule 2: Support Request → Delayed Response**
```json
{
  "type": "comment_to_dm",
  "trigger_words": ["help", "support", "problem", "issue"],
  "trigger_platforms": ["facebook"],
  "action_type": "send_dm",
  "send_private_reply": true,
  "private_reply_template": "Thank you for reaching out! We're here to help. What specific issue can we assist with?",
  "auto_skip_replies": false,
  "delay_seconds": 5
}
```

---

## Testing & Validation

Test file: `/app/lib/automation/executeAutomationRules.test.ts` (198 lines)

Scenario coverage:
1. ✓ Comment matches keywords + platform → DM sent
2. ✓ Comment misses keywords → No DM
3. ✓ Comment from different platform → Skipped
4. ✓ No rules configured → Graceful handling
5. ✓ Multiple rules → All matching rules execute
6. ✓ auto_skip_replies enabled → Existing reply check

---

## Performance Characteristics

### Single Comment Processing

Database queries:
- 1x SELECT automation_rules (indexed, ~50ms)
- 1-N x SELECT agent (for each matching rule, ~30ms each)
- 1-N x INSERT direct_message (for each match, ~50ms each)
- [Optional] SELECT direct_messages for skip check

In-memory operations:
- Keyword matching: O(n) where n = trigger_words length
- Platform filtering: O(m) where m = trigger_platforms length

**Total time estimates:**
- No matches: ~50-100ms (single SELECT)
- One match: ~100-300ms (SELECT + CREATE + optional AI)
- Multiple matches: ~300-1000ms (scales with matching rules)

---

## Security & RLS

The executor respects all existing RLS policies from migration 007:

1. **SELECT automation_rules** 
   - User must be in workspace_members for the rule's workspace
   - Role must be admin/member/owner

2. **INSERT direct_messages**
   - User must be in workspace_members
   - Role must be admin or owner (current schema requirement)

3. **SELECT agents**
   - User must be in workspace_members

No service-role bypasses are used. All queries respect workspace isolation.

---

## Error Handling

Graceful fallbacks for failures:

| Failure | Response |
|---------|----------|
| Failed to load rules | `ok=true, ruleMatched=false` (no crash) |
| Agent not found | Skip that rule, continue to next |
| Failed to generate AI response | Fall back to template |
| Failed to create DM | Log error, return `actionExecuted=false` |
| Database connection error | If mock mode enabled, return mock result |

---

## Files Created

```
/app/lib/automation/
├─ executeAutomationRules.ts          [288 lines] Core engine
├─ executeAutomationRules.test.ts    [198 lines] Test scenarios
├─ INTEGRATION_GUIDE.md               Integration patterns
├─ WEBHOOK_EXAMPLE.ts                 Reference webhook
└─ EXECUTOR_SUMMARY.md                This file
```

**Total new code:** ~500 lines + documentation
**Files modified:** None (backward compatible)

---

## What's NOT Implemented (Future Work)

### Triggers (Planned)
- ○ Keyword on any message (not just comments)
- ○ Time-based scheduling
- ○ Manual trigger from UI

### Actions (Planned)
- ○ Public reply on comment
- ○ Email notification
- ○ External webhook
- ○ Create support ticket

### Features (Planned)
- ○ Cron jobs for scheduling
- ○ Regex pattern matching
- ○ Conditional logic (if/else)
- ○ Multi-step workflows
- ○ A/B testing templates
- ○ Rule priorities/ordering

---

## Environment Configuration

The executor respects these environment variables:

```bash
# Use mock mode (skip database, return mock results)
NEXT_PUBLIC_MOCK_MODE=true

# OpenAI API for AI-generated responses
OPENAI_API_KEY=sk_test_...

# Test mode (disable actual OpenAI calls)
NEXT_PUBLIC_TEST_MODE=true
```

---

## Deployment Checklist

Before production:

- [ ] RLS policies active (migration 007 applied)
- [ ] automation_rules REST API deployed (/api/automation-rules)
- [ ] Webhook handler configured (see WEBHOOK_EXAMPLE.ts)
- [ ] Environment variables set:
  - [ ] FACEBOOK_WEBHOOK_VERIFY_TOKEN
  - [ ] FACEBOOK_PAGE_ACCESS_TOKEN
  - [ ] OPENAI_API_KEY (if using AI generation)
- [ ] Error logging configured
- [ ] Webhook signature validation enabled
- [ ] Database connection pooling configured
- [ ] Mock mode disabled in production
- [ ] Rate limiting on webhook handler
- [ ] Monitoring/alerting on execution failures
- [ ] Test with real comment from Facebook/Instagram

---

## Code Examples

### Basic Integration

```typescript
import { executeAutomationRulesForComment } from '@/lib/automation/executeAutomationRules';

// When comment arrives
const result = await executeAutomationRulesForComment({
  workspaceId: 'ws_12345',
  agentId: 'agent_abc',
  commentId: 'fb_comment_789',
  commentText: 'This product is amazing!',
  authorId: 'user_456',
  authorName: 'Jane Smith',
  platform: 'facebook',
});

// Handle result
if (result.ok) {
  if (result.actionExecuted) {
    console.log('✓ DM sent automatically');
  } else if (result.ruleMatched) {
    console.log('✓ Rule matched but action not executed');
  } else {
    console.log('✓ No matching rules');
  }
} else {
  console.error('✗ Error:', result.error);
}
```

### With Webhook Handler

See [WEBHOOK_EXAMPLE.ts](./WEBHOOK_EXAMPLE.ts) for complete Facebook webhook integration.

---

## Related Files

From previous phases that this executor consumes:

- `/app/api/automation-rules/route.ts` - REST API (Phase 3)
- `/app/api/automation-rules/[id]/route.ts` - REST API (Phase 3)
- `/app/lib/automation/validation.ts` - Type definitions (Phase 3)
- `/supabase/migrations/007_automation_rules_rls.sql` - RLS policies (Phase 3)

---

## Contact & Support

For questions about the executor:
1. Check [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for integration patterns
2. Review [WEBHOOK_EXAMPLE.ts](./WEBHOOK_EXAMPLE.ts) for webhook implementation
3. Check test scenarios in [executeAutomationRules.test.ts](./executeAutomationRules.test.ts)

---

**End of Phase 4: Automation Rules Execution Engine**
