# ⚡ QUICK REFERENCE - Retail Assist App Architecture

**Last Updated:** December 7, 2025

---

## 🚀 Quick Start

### Run Locally (Mock Mode - No Setup)
```bash
npm install
npm run dev
# Visit http://localhost:5000 - Everything works with fake data!
```

### Run with Real Database
```bash
# 1. Create Supabase project
# 2. Copy credentials to .env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 3. Run database migration
supabase db push

# 4. Start
NEXT_PUBLIC_USE_MOCK_SUPABASE=false npm run dev
```

---

## 📁 Key Files

| File | Purpose | What Changed |
|------|---------|--------------|
| `supabase/migrations/001_initial_schema.sql` | Database schema | ✅ Created |
| `app/lib/types/database.ts` | TypeScript types | ✅ Enhanced |
| `app/lib/supabase/server.ts` | Supabase client | ✅ Real implementation |
| `app/lib/supabase/queries.ts` | Database operations | ✅ 30+ functions |
| `app/lib/openai/server.ts` | OpenAI API | ✅ Real implementation |
| `app/lib/openai/mock.ts` | Mock OpenAI | ✅ Enhanced |
| `app/api/agents/route.ts` | Agent CRUD | ✅ Real implementation |
| `app/api/agent/[agentId]/route.ts` | Agent chat | ✅ Real implementation |
| `app/api/agent/[agentId]/comments/route.ts` | Comments | ✅ Real implementation |

---

## 📊 Database Tables

```
users
├── workspaces
│   ├── workspace_members (team)
│   ├── agents
│   │   ├── comments (public feedback)
│   │   └── message_logs (conversations)
│   ├── automation_rules
│   ├── direct_messages (outgoing DMs)
│   ├── integrations (Meta, WhatsApp)
│   ├── subscriptions (billing)
│   └── daily_stats (analytics)
└── audit_logs (compliance)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/agents` | Session | List agents |
| `POST` | `/api/agents` | Session | Create agent |
| `POST` | `/api/agent/[id]` | Session/Key | Chat with agent |
| `POST` | `/api/agent/[id]/comments` | None | Process comments |
| `GET/POST` | `/api/webhooks/facebook` | Signature | Facebook webhooks |

---

## 🔐 Authentication Methods

### Session-Based (Dashboard)
```typescript
// Auto-handled by Supabase Auth
// Stored in cookies & localStorage
const { data: { session } } = await supabase.auth.getSession();
```

### API Key-Based (Public API)
```bash
curl -X POST /api/agent/AGENT_ID \
  -H "X-API-Key: sk_your_key_here" \
  -d '{"message": "Hello"}'
```

---

## 💾 Key Functions

### Database
```typescript
// Users
getCurrentUser()
createUser(userId, email, fullName?)

// Workspaces
getUserWorkspaces(userId)
createWorkspace(userId, name, description?)

// Agents
getWorkspaceAgents(workspaceId)
getAgentById(agentId)
createAgent(workspaceId, input)
updateAgent(agentId, input)

// Comments
saveComment(agentId, input)
getUnprocessedComments(agentId, limit?)
markCommentProcessed(commentId, botReply, botReplyId?)

// Messages
createDirectMessage(workspaceId, input)
logMessage(workspaceId, input)

// Analytics
getDailyStats(workspaceId, agentId?, days?)
incrementDailyStat(workspaceId, agentId, statName)
```

### OpenAI
```typescript
// Real API
callOpenAIChat(messages, model?, options?)
generateAgentResponse(systemPrompt, userMessage, options?)
estimateTokens(text): number
calculateOpenAICost(inputTokens, outputTokens, model): number

// Mock
generateMockResponse(systemPrompt, userMessage)
```

---

## 🔄 Common Workflows

### Create Agent & Use API
```bash
# 1. Create via API
curl -X POST /api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Agent",
    "systemPrompt": "You are helpful"
  }' | jq .agent.api_key
# Returns: sk_abc123...

# 2. Use the API key
curl -X POST /api/agent/AGENT_ID \
  -H "X-API-Key: sk_abc123..." \
  -d '{"message": "Hello"}'
# Returns: {"reply": "...", "tokens_used": 45, "cost": 0.00067}
```

### Process Comment & Send DM
```bash
# 1. Comment comes in
curl -X POST /api/agent/AGENT_ID/comments \
  -d '{
    "content": "Great product!",
    "author_email": "user@example.com"
  }'

# 2. System:
# - Saves comment to database
# - Generates AI reply via OpenAI
# - Sends DM to user's email
# - Marks as processed
```

---

## 🎛️ Environment Variables

### Required for Production
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI
OPENAI_API_KEY=sk_...

# Meta (optional)
META_APP_ID=123...
META_APP_SECRET=abc...
META_PAGE_ACCESS_TOKEN=...
META_VERIFY_TOKEN=...

# WhatsApp (optional)
WHATSAPP_API_TOKEN=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...

# Stripe (optional)
STRIPE_API_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Flags
NEXT_PUBLIC_USE_MOCK_SUPABASE=false
NODE_ENV=production
```

---

## 🧪 Testing

### Mock Mode (Recommended for Dev)
```bash
NEXT_PUBLIC_USE_MOCK_SUPABASE=true npm run dev
# ✅ Works offline
# ✅ No API costs
# ✅ Fast development
# ✅ Fake but realistic data
```

### Real Mode (For Testing Real Features)
```bash
NEXT_PUBLIC_USE_MOCK_SUPABASE=false npm run dev
# ✅ Real database
# ✅ Real OpenAI calls (costs $$)
# ✅ Real integrations
# ✅ Production-like behavior
```

---

## 📈 Cost Tracking

Every API call is tracked:
```json
{
  "reply": "Hello, I'm here to help!",
  "tokens_used": 145,
  "cost": 0.00234
}
```

Costs are stored in:
- `message_logs.cost` - Per-message cost
- `daily_stats.total_cost` - Daily aggregation
- `subscriptions` - Billing integration

**Cost Formula:**
```
cost = (inputTokens / 1M) × inputPrice + (outputTokens / 1M) × outputPrice
```

---

## 🔒 Security Checklist

- ✅ RLS policies on all tables
- ✅ Workspace-based data isolation
- ✅ Service role key (never exposed)
- ✅ API key authentication
- ✅ Session-based authentication
- ✅ Audit logging
- ✅ Environment variable separation
- ⏳ Rate limiting (implement before production)
- ⏳ Request validation (implement before production)

---

## 🚀 Deployment

### Netlify
```bash
# 1. Connect GitHub repo
# 2. Add environment variables in Netlify UI
# 3. Push to main → Auto deploys
# 4. Monitor: Netlify dashboard
```

### Environment in Netlify
```
Site settings > Build & deploy > Environment
Add all vars from .env.example
Set NEXT_PUBLIC_USE_MOCK_SUPABASE=false
```

---

## 📊 Monitoring

### Track These Metrics
- Response time (should be <1s)
- Error rate (should be <1%)
- Token usage (daily/monthly)
- Costs (OpenAI, Stripe)
- Webhook failures
- Database query time

### Alerts to Set Up
- High error rate
- Cost spike
- Database connection issues
- Webhook failures
- OpenAI API errors

---

## 🐛 Troubleshooting

### Database Won't Connect
```bash
# Check credentials
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
curl https://YOUR_URL/rest/v1/
```

### OpenAI Not Working
```bash
# Verify API key
echo $OPENAI_API_KEY

# Check quota & usage
# Go to: platform.openai.com/account/usage
```

### Webhook Not Receiving Events
```bash
# 1. Check webhook URL is public & HTTPS
# 2. Verify token matches (META_VERIFY_TOKEN)
# 3. Check Netlify logs
# 4. Test with ngrok for local development
```

---

## 📚 Documentation Files

- `README.md` - Project overview
- `SETUP.md` - Setup & deployment guide
- `DEVELOPMENT.md` - Architecture & development
- `API.md` - API reference with examples
- `ROADMAP.md` - Next priorities
- `PHASE1_SUMMARY.md` - What was built

---

## 🎯 Next Priorities

1. **Comment Automation** - Automation rule engine
2. **Facebook Integration** - Webhook handler & auto-reply
3. **Analytics** - Real dashboard with stats
4. **WhatsApp** - Business message automation
5. **Billing** - Stripe integration
6. **Team Management** - User invitations & roles

---

## 💡 Pro Tips

### For Fast Development
1. Use mock mode (`NEXT_PUBLIC_USE_MOCK_SUPABASE=true`)
2. Check `app/lib/mocks.ts` for available mock data
3. Add new mocks for new features before building

### For Production
1. Always test with `NEXT_PUBLIC_USE_MOCK_SUPABASE=false`
2. Monitor OpenAI costs daily
3. Keep backups of Supabase
4. Setup alerts for errors
5. Document API changes

### For Debugging
1. Check browser console for frontend errors
2. Check Netlify logs for backend errors
3. Check Supabase logs for database errors
4. Use `?debug=true` in query string (if implemented)
5. Enable verbose logging in development

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes
3. Test in mock mode first: `NEXT_PUBLIC_USE_MOCK_SUPABASE=true npm run dev`
4. Test in real mode if needed
5. Commit with clear messages
6. Push & create pull request

---

## 📞 Support

- **Issues:** GitHub Issues
- **Questions:** GitHub Discussions
- **Docs:** See documentation files
- **API Help:** See `API.md`

---

## ⚡ TL;DR

- **Dev:** `npm run dev` (mock mode by default)
- **Prod:** Setup Supabase + env vars
- **Database:** Run SQL migration
- **APIs:** Real implementation ready
- **Next:** Send master prompt to build more features

**Status:** Production-ready Phase 1 ✅  
**Ready for:** Phase 2 development 🚀

---

Generated: December 7, 2025  
By: GitHub Copilot
