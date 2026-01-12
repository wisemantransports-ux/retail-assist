Internal user ID contract
=========================

Summary
-------
- The canonical user identifier for application data is the Postgres `public.users.id` column ("internal user id").
- The Supabase Auth UID (auth.users.id) must NOT be used directly as the FK for application tables unless it has been deterministically resolved to the internal id.

Rules and guidance
------------------
- Always resolve or ensure an internal user id before writing or querying application tables that reference `users.id` (examples: `sessions`, `workspace_members`, `tokens`, `payments`, etc.).
- Use the existing helpers:
  - `ensureInternalUser(candidateId)` — attempts to create/resolve a deterministic internal `users.id` (tries insert with `id = candidateId`, falls back to upsert/select by `auth_uid`). Returns `{ id }`.
  - `resolveUserId(candidateId, createIfMissing = true)` — resolves either an internal id or auth UID to the internal `users.id` and optionally creates a lightweight user.

Why this matters
-----------------
- DB foreign keys and RLS policies expect `sessions.user_id`, `workspace_members.user_id`, etc. to reference `public.users.id`.
- Writing auth UIDs directly into those FK columns can cause mismatches, FK errors, and inconsistent behavior between dev and production.

Session contract
----------------
- `sessions.user_id` MUST reference `public.users.id` (the internal id). The `sessionManager.create(...)` helper enforces this by calling `ensureInternalUser(...)` before persisting sessions.

Developer checklist
-------------------
1. When a route receives a Supabase Auth user object (`user.id`), call `ensureInternalUser(user.id)` and use the returned `id` for downstream DB operations and session creation.
2. When receiving a candidate id value (owner_id, invited_by, etc.), prefer `resolveUserId(candidateId)` to convert it to the canonical internal id.
3. Keep dev/mock fallback behavior intact, but prefer deterministic `id = auth uid` insertion during provisioning so migrations and scripts remain consistent.

Location of helpers
-------------------
- `app/lib/supabase/queries.ts` — contains `ensureInternalUser` and `resolveUserId`.
- `app/lib/session/index.ts` — session manager that writes `sessions.user_id` and now ensures internal id before insert.

If you have questions or want this enforced via linting/tests, we can add a small rule or unit-tests to validate endpoints call `resolveUserId` / `ensureInternalUser` where appropriate.
