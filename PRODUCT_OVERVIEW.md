# Product Overview — Retail Assist

## What this product does ✅
Retail Assist is a lightweight, rules-driven inbox automation product for small businesses that helps teams manage customer comments, messages, and website form submissions in one place — automating common replies and routing based on configurable rules and optional AI-assisted suggestions. The product turns incoming interactions into actionable items and triggers automation rules so teams can respond faster and scale support with fewer manual steps.

## Included channels (v1) 📡
- **Facebook** (Page comments & Messenger) — supported and included
- **Instagram** (Comments & DMs) — supported and included
- **Website Forms** (HMAC-signed POST submissions) — supported and included

> **WhatsApp** — Coming Soon 🚧 (present in the codebase as a handler but not enabled or marketed in v1)

## Key features ✨
- Rule-based automations: define triggers (keywords, platforms, form sources) and actions (post-reply, create ticket, assign to agent)
- Comment → DM workflows (convert public comments into private follow-ups) for Facebook & Instagram
- Website form parsing and routing to agents/workspaces
- AI-assisted reply suggestions (opt-in): suggested replies are surfaced to agents; automated sending can be enabled per workspace and per rule
- Security: webhook signature verification and platform challenge handling are included to ensure secure integrations

## How onboarding works (no client APIs) 🚀
This product is a self-serve SaaS experience — no client API is required to use or onboard:

1. Sign up and create a workspace in the dashboard.
2. Connect your Facebook Page and Instagram account via the UI (OAuth flows) — the dashboard handles subscription and token management.
3. (Website Forms) Configure your site to POST form submissions to the provided webhook endpoint and set a shared secret (HMAC-SHA256) for signing requests.
4. Configure one or more Agents in the dashboard and attach automation rules (triggers + actions).
5. Test with the dashboard's webhook testing tools and enable auto-reply or manual approval workflows.

> Notes:
> - The integration handles platform verification challenges automatically and validates incoming signatures before processing.
> - WhatsApp is not part of the v1 go-to-market plan and will be available as an add-on (“Coming Soon”).

## Operational boundaries & privacy 💡
- AI features are opt-in and usage is meter-based (rate-limited by plan). AI outputs should be reviewed where required by compliance needs.
- PII should be redacted or handled according to your workspace's privacy policy — the product includes logging and redaction guidance, but administrators must configure retention policies.

## What’s not included in v1 🚫
- Native WhatsApp production support (Coming Soon)
- Out-of-the-box billing integration for all local payment providers (we support common options and add region-specific methods on request)

---

If you'd like, I can also add a short onboarding checklist or a single-page quick-start guide (paused for now per your freeze request).