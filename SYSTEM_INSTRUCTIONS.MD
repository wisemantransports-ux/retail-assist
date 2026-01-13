# Retail Assist – System Instructions (AUTHORITATIVE)

This document defines **non-negotiable system rules** for all human and AI contributors.

Any AI assistant (Copilot, Claude, GPT, etc.) must read and comply with this file
before making changes.

---

## 🔒 AUTHENTICATION FREEZE (ABSOLUTE)

The authentication system is FROZEN and MUST NOT be modified.

DO NOT:
- Modify /api/auth/* routes
- Modify signup or login logic
- Modify session creation or validation
- Modify session cookies
- Modify Supabase auth triggers
- Modify RLS policies
- Modify user provisioning logic
- Change how `/api/auth/me` authenticates users

Auth-related code is production-stable and shared across the system.
Any task requiring auth changes must be escalated and stopped.

---

## 💳 BUSINESS MODEL – SUBSCRIPTION GATED SAAS

### Signup Rules
- Businesses can sign up for FREE
- Free users can access the dashboard UI in **preview mode**
- Free users CANNOT use any operational feature

### Locked Until Paid (Starter or higher)
- Facebook Messenger
- Instagram DM
- Website Chat
- WhatsApp (Coming Soon)
- Inbox replies
- AI agents
- Automation rules
- Message sending
- AI usage
- Page connections

Free users may:
- Navigate dashboard
- View features
- See locked states
- See upgrade prompts

Paid users unlock features based on:
- `subscription_status`
- `payment_status`
- `plan_type`
- `plan_limits`

---

## 🧠 PLATFORM RESPONSIBILITY MODEL

- The PLATFORM OWNER handles:
  - OpenAI API integration
  - Meta verification
  - Facebook, Instagram, WhatsApp setup
  - Website chat infrastructure

- BUSINESSES:
  - Do NOT provide APIs
  - Do NOT handle Meta verification
  - ONLY connect their pages
  - ONLY configure custom agents and rules

The system must remain NON-TECHNICAL for business owners.

---

## 🧩 SAFE AREAS FOR CHANGES

Allowed:
- Dashboard UI (/app/dashboard/*)
- Non-auth APIs (agents, inbox, analytics, automation, meta)
- Feature gating logic
- UX improvements (loading, empty, locked states)
- Workspace-scoped data fetching
- Plan-based feature enforcement
- WhatsApp marked as “Coming Soon” only

---

## 🚫 PROHIBITED ACTIONS

- Do NOT hide features — lock them visually
- Do NOT block signup
- Do NOT auto-connect channels
- Do NOT introduce technical onboarding steps for businesses
- Do NOT bypass plan checks

---

## ✅ CHANGE PRINCIPLES

- All changes must be ADDITIVE
- No breaking changes
- Defensive checks everywhere
- Clear upgrade prompts
- Respect existing schema and migrations

---

## 📌 ENFORCEMENT

If any AI assistant proposes a change that violates this document:
- STOP immediately
- Escalate to the project owner
- Do NOT implement

This document is the highest authority after the database schema.