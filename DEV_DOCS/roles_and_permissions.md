# Roles & Workspace Rules

## Roles
- **super_admin**: can manage all workspaces and employees
- **client_admin**: can manage employees in their workspace only
- **employee**: can never access admin dashboards

## Employee Invitations
- **Invited by super_admin** → `workspace_id = NULL`
- **Invited by client_admin** → `workspace_id` = inviter's workspace (must be set)
- Both frontend and DB enforce this rule (client and server validation + DB trigger)

## Dashboard Access
- Employees are redirected to `/unauthorized` if they attempt to access admin pages.
- **Deprecated:** `ProtectedRoute` and `AdminProtectedRoute` — do not add page-level guards that block rendering. Use the single authoritative gate in `app/dashboard/layout.tsx` and rely on `/api/auth/me` status for auth decisions.

## DB Migration / RLS
- Migration: `db/migrations/001_strict_employee_roles.sql`
  - Adds `enforce_employee_workspace_rules()` trigger to validate inserts
  - Prevents invalid states where a `client_admin`-invited employee has no `workspace_id`

## Frontend Guidance
- Prefer server-side API endpoints for employee invites (e.g., `POST /api/employees`) — the server infers workspace from the authenticated admin.
- If invoking Supabase directly from the client (platform admins), use the helper at `app/lib/employees/createEmployee.ts` which enforces the same inviter rules.

## RLS / Triggers
- `set_workspace_id_before_insert` (if present) should set `workspace_id` for client_admin invites when possible; otherwise the trigger above will enforce presence.
- RLS policies must prevent role escalation and unauthorized workspace access.

## Diagram (conceptual)
- super_admin → workspace_id = NULL → platform admin pages
- client_admin → workspace_id = <client workspace> → dashboard pages
- employee → workspace_id = <client workspace> → restricted from admin pages

---

If you want, I can add a short automated test and a small migration runner to apply `001_strict_employee_roles.sql` in development environments. Let me know which you'd like next.