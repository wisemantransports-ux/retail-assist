# V1 Design: Optional Workspace_ID for Platform-Level Invites

## Overview

In **Retail-Assist v1**, `workspace_id` is **optional** at invite creation time. This is an intentional design decision, not a bug.

## Why?

### Platform-Level Users (v1)
- **super_admin**: Never belongs to a workspace. Platform owner role.
- **platform_staff**: May be invited before workspace assignment. Can work across multiple workspaces.
- **platform_employees**: May be invited at the platform level, then assigned to workspaces later.

### Invite Flow (v1)
1. Admin/staff creates invite without requiring workspace assignment
2. User accepts invite with email, name, password only
3. User can access `/` and `/admin` routes without a workspace
4. Workspace assignment happens via separate admin action (post-signup or post-login)

### This is Correct
- Users are not forced into a workspace at signup
- Platform-level roles (super_admin) never have a workspace
- Flexible assignment enables better onboarding

## Technical Details

### API Response
`POST /api/employees/accept-invite?token=XYZ` returns:
```json
{
  "success": true,
  "user_id": "...",
  "workspace_id": null,  // ← Valid in v1
  "role": "super_admin",
  "message": "Invite accepted successfully"
}
```

### Frontend Handling
The invite form **does not require** `workspace_id`:
- If present: Redirect to workspace dashboard
- If null: Redirect to `/` or appropriate role-based route
- No error or blocking occurs

### Middleware Behavior
The middleware (lines 6-10, `middleware.ts`) allows authenticated users without `workspace_id` to access:
- `/`
- `/invite`
- `/onboarding`
- `/admin/platform-staff` (super_admin only)

This unblocks the complete onboarding flow.

## Future: V2 Facade Pattern

In **v2**, a **Facade pattern** will enforce workspace assignment:
- All users will be assigned to a workspace before gaining access to features
- Platform-level roles will manage this assignment
- The API layer will hide workspace null checks behind a facade
- Clients will not see null workspace_ids

For now in v1, this is deferred to keep the system simple and flexible.

## Code References

- **Backend**: [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts) — Accepts invites regardless of workspace_id
- **Frontend**: [app/invite/invite-form.tsx](app/invite/invite-form.tsx) — Handles null workspace_id gracefully
- **Middleware**: [middleware.ts](middleware.ts) — Allows routes without workspace requirement

## Related Issues

- ✅ Employee invite accept flow unblocked
- ✅ Super_admin invites now work
- ✅ Platform-level users can be invited before workspace assignment
- ✅ No breaking changes to existing code

## Summary

| Aspect | V1 | V2 |
|--------|----|----|
| workspace_id required? | No | Yes (via Facade) |
| Platform-level invites | Supported | Same |
| Workspace assignment | Optional, manual | Enforced, automatic |
| API surface | Simple, direct | Facade-wrapped |

This is working as designed.
