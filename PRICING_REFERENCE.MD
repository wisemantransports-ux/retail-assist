# Retail Assist Pricing Reference

**Purpose:**  
This document defines all pricing tiers, included features, AI token limits, and support levels for the Retail Assist SaaS platform.  
It is **read-only reference for the system**, ensuring frontend and backend enforcement can always align.

---

## Pricing Plans Overview

| Plan       | Price             | Channels & Inbox                          | Automation          | AI Auto-Replies | AI Token Limit / Month | Support           | Notes |
|------------|-----------------|-------------------------------------------|-------------------|----------------|----------------------|-----------------|-------|
| Starter    | BWP 25 / $350    | Facebook OR Instagram + Website Chat      | Basic Automation  | ✅              | 50,000               | Community Support | Single page per plan, preview mode until paid |
| Pro        | BWP 36 / $600    | Facebook + Instagram + Website Chat       | Advanced Automation | ✅             | 150,000              | Priority Support | Most popular plan, full workspace access |
| Advanced   | BWP 72 / $900    | Facebook + Instagram + Website Chat       | Full Automation   | ✅              | 500,000              | Priority Support | Unlimited workspaces, highest AI usage |
| Enterprise | Contact Sales    | All Channels                              | Custom Automation | ✅              | Custom               | Dedicated Support | White-labeled, enterprise-specific features |

---

## Feature Descriptions

### Channels & Inbox
- Unified inbox for all connected channels (Facebook, Instagram, Website Chat)
- WhatsApp support: Coming Soon (displayed but disabled until integration is ready)

### Automation
- Starter: Basic automation rules (limited triggers/responses)
- Pro: Advanced automation rules (multi-step logic)
- Advanced: Full automation (unlimited rules, triggers, AI-driven)
- Enterprise: Custom automation setup per client needs

### AI Auto-Replies
- Enabled for all plans (Starter through Enterprise)
- Handles customer messages automatically using connected channels
- AI token limits define usage allowance per month (see table above)

### AI Token Limits & Usage Notification
- Starter: 50,000 tokens/month
- Pro: 150,000 tokens/month
- Advanced: 500,000 tokens/month
- Enterprise: Custom (negotiated per client)
- **Usage Warning:** Users will be notified when **80% of monthly AI tokens** are consumed.  
  - **Important:** Enforcement of token limits and warning notifications is handled **securely at the backend via SQL**.  
  - Frontend displays plan info and warnings, but cannot override or bypass usage limits.

### Support
- Starter: Community-based support
- Pro & Advanced: Priority support (faster response times)
- Enterprise: Dedicated support with account manager

---

## Key Notes & Rules

1. **Free Users / Unpaid Accounts:**  
   - Can view all plans and features in read-only mode  
   - Cannot connect channels, create agents, or use automation  

2. **Plan-Based Feature Gating:**  
   - Actual access to features is determined by subscription plan  
   - Frontend shows badges/tooltips for locked features  
   - Backend enforces plan limitations securely via API and SQL

3. **WhatsApp Integration:**  
   - Displayed as "Coming Soon" until full integration is available  

4. **Pricing Currency:**  
   - Displayed both in BWP and approximate USD for clarity  

---

**Document Authoritative Status:**  
- This Markdown file is the **single source of truth** for all pricing, plan limits, and AI usage.  
- Any updates to plans, features, or token limits must be reflected here first before updating the frontend or backend enforcement logic.  
- Copilot and future AI collaborators must reference this file before making changes to plan-related code.