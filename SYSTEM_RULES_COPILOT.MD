SYSTEM RULES – RETAIL ASSIST

Copilot must treat the following as invariant:

1. AUTH FREEZE
- No changes to /api/auth/*
- No session, cookie, trigger, or RLS modifications

2. SUBSCRIPTION MODEL
- Users can sign up for free
- Free users have READ-ONLY dashboard access
- All operational features are locked until a paid plan
- Feature access is controlled by subscription/plan fields
- Backend API must enforce access (403)

3. PLATFORM OWNERSHIP
- Platform owner manages all APIs (OpenAI, Meta, Instagram, WhatsApp)
- Businesses never provide API keys
- Businesses only connect their pages/accounts

4. CURRENT TASK MODE
- SQL migrations are authoritative
- Copilot may ANALYZE migrations
- Copilot may NOT modify migrations unless explicitly instructed
- Findings must be reported, not implemented

Violation of these rules is considered an error.