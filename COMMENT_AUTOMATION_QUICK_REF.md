# Comment Automation - Quick Reference

## What Was Built
✅ Complete comment automation system for Priority 4
- Comment detection (mock + real webhooks)
- AI-powered reply generation
- DM automation
- Event logging
- Dashboard testing UI

## Key Files

| File | Purpose |
|------|---------|
| `/app/api/automation/comment-handler/route.ts` | Main API endpoint |
| `/app/lib/automation/comment/runCommentAutomation.ts` | Automation logic |
| `/app/lib/meta/comment.ts` | Comment detection |
| `/app/dashboard/inbox-automation/page.tsx` | Dashboard UI |
| `/app/api/webhooks/facebook/route.ts` | Updated for new flow |

## API Endpoint
```
POST /api/automation/comment-handler
GET /api/automation/comment-handler (health check)
```

## Test It Now
```bash
# Server must be running
npm run dev

# Test endpoint (mock mode)
curl -X POST http://localhost:5000/api/automation/comment-handler \
  -H "Content-Type: application/json" \
  -d '{"mock":true,"workspaceId":"ws-1","agentId":"ag-1","comment":{"id":"c1","postId":"p1","content":"Test","authorId":"u1","authorName":"User"}}'
```

## Database Tables Used
- `comments` - Store incoming comments
- `automation_rules` - Rule configuration
- `direct_messages` - Store DM responses
- `audit_logs` - Event tracking

## How It Works

1. **Receive** - Comment event via webhook or mock
2. **Detect** - Parse and validate (detectCommentEvent)
3. **Find** - Locate workspace, agent, rules
4. **Store** - Save comment to DB
5. **Generate** - Create public reply + DM (if enabled)
6. **Send** - Store DM, prepare public reply
7. **Mark** - Set processed flag
8. **Log** - Record event in audit trail

## Integration Checklist

### For Real Webhooks
- [ ] Set Facebook webhook URL to `/api/webhooks/facebook`
- [ ] Verify token in env: `META_VERIFY_TOKEN`
- [ ] Add page access token: `META_PAGE_ACCESS_TOKEN`
- [ ] Test webhook delivery

### For Database
- [ ] Comments table created
- [ ] Automation rules configured
- [ ] Direct messages table ready
- [ ] Audit logs enabled

### For AI Replies
- [ ] OpenAI API key set
- [ ] Agent system prompt configured
- [ ] Model and parameters set
- [ ] Fallback templates provided

## Environment Variables
```
# Required for webhooks
META_VERIFY_TOKEN=your_verify_token
META_PAGE_ACCESS_TOKEN=your_page_token

# Required for AI
OPENAI_API_KEY=your_api_key

# Supabase
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key

# Dev
USE_MOCK_MODE=true  # Set false for production
```

## Error Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| "Workspace not found" | Page ID not linked | Link Facebook page in workspace settings |
| "No agent configured" | Missing agentId | Set agent in automation rule |
| "No automation rules" | Rule not enabled | Create and enable automation rule |
| "supabaseUrl is required" | Missing env var | Set SUPABASE_URL |

## Testing the Flow

### Unit Test
```bash
# Mock request via cURL (see API Endpoint above)
```

### Integration Test
1. Open dashboard: `/dashboard/inbox-automation`
2. Click "Test with Mock Comment"
3. Check result notification
4. Verify comment logged in audit trail

### End-to-End Test
1. Configure real Facebook page
2. Post a comment on your page
3. Monitor server logs
4. Verify comment appears in dashboard inbox
5. Check DM was sent
6. Confirm public reply posted

## Debugging

### Check Logs
```bash
# Server logs show [Comment Handler] prefix
# Look for: Received webhook, Detected comment, Automation complete
```

### Database Query
```sql
-- Check comments stored
SELECT * FROM comments ORDER BY created_at DESC LIMIT 5;

-- Check automation events
SELECT * FROM audit_logs WHERE resource_type = 'comment' LIMIT 10;

-- Check DMs sent
SELECT * FROM direct_messages ORDER BY created_at DESC LIMIT 5;
```

### Test Endpoints
```bash
# Health check
curl http://localhost:5000/api/automation/comment-handler

# Mock comment
curl -X POST http://localhost:5000/api/automation/comment-handler \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Next Priority (5)
**Facebook Webhook** - Real webhook handling
- Implement token validation
- Add proper error responses
- Test with live Facebook events
- Monitor delivery

## Code Patterns

### New Comment Handler
```typescript
const result = await runCommentAutomation({
  workspaceId,
  agentId,
  comment: { id, content, authorId, ... },
  rule,
  agent,
});
```

### Detect Comment
```typescript
const { isComment, platform, data } = detectCommentEvent(webhookBody);
```

### Log Event
```typescript
await createAuditLog(workspaceId, userId, 'processed', 'comment', commentId, {...});
```

## Performance Considerations
- Comment storage: ~50ms (DB insert)
- AI reply generation: ~1-3s (OpenAI call)
- DM creation: ~100ms (DB insert)
- Total flow: ~2-4 seconds
- Recommendation: Use async queue for multiple comments

## Security Notes
- API key validation: Done via auth/apiKey header
- Workspace isolation: RLS filters by workspace_id
- Token validation: Facebook token in env vars
- Audit trail: All actions logged

## Troubleshooting Checklist

- [ ] Server running: `npm run dev`
- [ ] Mock mode enabled in .env: `USE_MOCK_MODE=true`
- [ ] Dependencies installed: `npm install`
- [ ] No TypeScript errors: `npm run build`
- [ ] Endpoint responds: `curl http://localhost:5000/api/automation/comment-handler`
- [ ] Mock comment processed: Check logs for `[Comment Handler]` prefix
- [ ] Database connection: Check Supabase env vars or mock mode
- [ ] AI integration: Set OPENAI_API_KEY or use mock responses
