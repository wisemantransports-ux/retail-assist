# Migration checklist: Retail Assist → Retail Pro

Summary: replaced remaining human-facing occurrences of the brand and added read-only UX guards that surface an upsell modal for gated actions.

Files changed
- app/components/UpsellModal.tsx — New: simple modal used for upsell prompts.
- app/components/AgentForm.tsx — Added read-only guard to prevent agent creation and show upsell modal.
- app/dashboard/inbox-automation/new/page.tsx — Added read-only guard to prevent creating automation rules and show upsell modal.
- app/dashboard/integrations/page.tsx — Added read-only guard on "Connect Facebook" (which also gates Instagram) and show upsell modal.
- app/marketing/components/CTA.tsx — Removed "free trial" wording and updated CTA to "Get Started" to avoid confusion.
- app/config/branding.ts, app/config/branding.client.ts — Updated default brand name to `Retail Pro`.
- app/layout.tsx — Updated metadata title/description.
- supabase/migrations/001_initial_schema.sql, supabase/migrations/002_complete_schema.sql — Updated default `sender_display` to `Retail Pro Bot`.
- README.md, API.md, QUICK_REFERENCE.md, SETUP.md, ROADMAP.md, PHASE1_SUMMARY.md, replit.md — Updated top-level headings to reflect Retail Pro.

Recommended follow-ups
1. Run a global search for remaining occurrences: `Retail Assist`, `Retail-Assist`, `retail-assist` (code/filenames vs. human-facing strings). Replace only human-facing strings and leave internal package names if desired.
2. Verify PayPal / billing integrations: the application uses `brand_name` when creating PayPal flows — confirm the displayed brand is correct in sandbox and production.
3. Manual QA: run the app locally and confirm:
   - Attempt to create an Agent as a read-only (non-active subscription) user: the upsell modal appears and blocks the action.
   - Attempt to create an automation rule as read-only: blocked and shows modal.
   - Attempt to connect Facebook/Instagram as read-only: blocked and shows modal.
4. Update marketing pages and any external docs (hosted site, Netlify CMS, marketing copy) to match "Retail Pro".
5. Optional: add automated tests covering read-only UX flow (button clicks show modal), and add a simple e2e smoke test for the signup → dashboard flow.

Notes
- I avoided renaming internal repo names (package.json name, folder names) to prevent breaking CI or deployment automation.
- If you want any additional brand-change sweeps (including CHANGELOG, CI configs, netlify titles), tell me and I will search/replace those next.

