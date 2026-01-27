# V1 Auth Flow: Invite → Login → Dashboard Resolution

## Overview
This document explains how user authentication and role resolution works in Retail-Assist v1, specifically the flow from invite acceptance through login to dashboard redirection.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INVITE ACCEPTANCE FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User clicks /invite?token=XYZ                                    │
│ 2. Frontend calls POST /api/employees/accept-invite?token=XYZ       │
│ 3. Backend creates:                                                 │
│    - Supabase Auth user (auth.users)                               │
│    - Internal user row (public.users) with:                        │
│      • auth_uid = supabase_auth_id                                 │
│      • role = 'employee' (or 'super_admin', 'platform_staff')     │
│      • workspace_id = null (or assigned workspace)                │
│    - Marks invite as accepted                                      │
│ 4. Frontend receives role and workspace_id                         │
│ 5. Frontend redirects to appropriate dashboard                     │
└─────────────────────────────────────────────────────────────────────┘
        ↓ (later, in a new session)
┌─────────────────────────────────────────────────────────────────────┐
│                     LOGIN AUTHENTICATION FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User visits /auth/login and enters email + password              │
│ 2. Backend calls POST /api/auth/login                               │
│ 3. Supabase authenticates via auth.signInWithPassword()            │
│    ✓ Success: Returns auth user with ID                            │
│    ✗ Fail: Returns 401 Unauthorized                                │
│ 4. On success, backend calls ensureInternalUser(auth_uid)          │
│    - Finds existing internal user row (created during invite)      │
│    - Returns user.id (the internal ID, not auth ID)                │
│ 5. Backend calls RPC rpc_get_user_access()                         │
│    - Resolves role from public.users.role                          │
│    - Resolves workspace_id from public.users.workspace_id          │
│ 6. Returns { role, workspace_id, user.id, user.email }            │
│ 7. Frontend uses role to redirect:                                 │
│    • super_admin → /admin                                          │
│    • platform_staff → /admin/support                               │
│    • admin → /dashboard                                            │
│    • employee → /employees/dashboard                               │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTHORIZED DASHBOARD ACCESS                      │
├─────────────────────────────────────────────────────────────────────┤
│ 1. User visits role-specific dashboard                             │
│ 2. Middleware verifies authenticated (via auth.getUser())          │
│ 3. Middleware calls RPC rpc_get_user_access() again               │
│ 4. Enforces route access by role:                                 │
│    • /admin → super_admin only                                     │
│    • /admin/support → platform_staff only                          │
│    • /dashboard → admin only (+ workspace_id != null)             │
│    • /employees/dashboard → employee only (+ workspace_id != null)│
│ 5. If workspace_id is null and route requires it:                 │
│    → Allows access to /invite, /onboarding, /                    │
│    → Blocks access to workspace dashboards                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Database Schema (Minimal)
- **auth.users** (Supabase): Email, password, auth_uid
- **public.users** (internal): id, auth_uid (FK), email, role, workspace_id, ...

### Role Types (v1)
| Role | Workspace Required | Uses |
|------|-------------------|------|
| `super_admin` | No | Platform owner, can access /admin |
| `platform_staff` | No | Retail-Assist staff, can access /admin/support |
| `admin` | Yes | Client workspace owner, can access /dashboard |
| `employee` | Yes | Client workspace staff, can access /employees/dashboard |

### Critical Functions

#### 1. `POST /api/employees/accept-invite`
**File**: [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts)

Creates invited user:
1. Validates invite token
2. Creates Supabase auth user (auth.signInWithPassword sets password)
3. Creates internal user row with `role='employee'` (or other role from invite)
4. **CRITICAL**: Sets `auth_uid` field to link to Supabase auth user
5. Marks invite as accepted
6. Returns `{ success: true, role, workspace_id }`

**Important Fix**: When handling duplicate constraints, queries by `auth_uid` (not email) to ensure the correct user is found and updated.

#### 2. `POST /api/auth/login`
**File**: [app/api/auth/login/route.ts](app/api/auth/login/route.ts)

1. Calls `supabase.auth.signInWithPassword()`
2. On success, calls `ensureInternalUser(auth_uid)` to verify/create internal row
3. Calls RPC `rpc_get_user_access()` to resolve role
4. Creates session via sessionManager
5. Returns role and workspace_id for client-side routing

#### 3. `ensureInternalUser(candidateId)`
**File**: [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts)

Finds or creates internal user row:
1. First checks if user exists by internal `id`
2. Then checks if user exists by `auth_uid` (most common path during login)
3. Waits 500ms if auth trigger hasn't fired yet
4. **CRITICAL**: If creating via upsert (on conflict), only updates non-role fields
   - This preserves the role set during invite acceptance
   - Does NOT overwrite role='employee' with role='user'

#### 4. `rpc_get_user_access()`
**File**: Database RPC function

Returns:
```sql
SELECT id, role, workspace_id FROM public.users WHERE auth_uid = current_user_id LIMIT 1
```

Must be called with authenticated user context (Supabase JWT).

## Data Flow Example

### Scenario: Employee Invited, Then Logs In

**Invite Acceptance (T=0s)**
```
POST /api/employees/accept-invite?token=abc123
→ Create auth user: email='alice@corp.com', password='...'
→ Get auth_uid: 'uuid-abc-123'
→ Insert public.users:
   {
     id: GENERATED_UUID,
     auth_uid: 'uuid-abc-123',
     email: 'alice@corp.com',
     role: 'employee',
     workspace_id: 'workspace-1',
     ...
   }
→ Return { success: true, role: 'employee', workspace_id: 'workspace-1' }
→ Frontend redirects to /employees/dashboard
```

**Login (T=1 hour later)**
```
POST /api/auth/login { email: 'alice@corp.com', password: '...' }
→ supabase.auth.signInWithPassword()
  ✓ Success, returns auth_uid: 'uuid-abc-123'
→ ensureInternalUser('uuid-abc-123')
  → Query: SELECT id FROM public.users WHERE auth_uid='uuid-abc-123'
  ✓ Found: id='gen-uuid-456'
→ RPC rpc_get_user_access()
  ✓ Returns { role: 'employee', workspace_id: 'workspace-1' }
→ Return { success: true, user: { id: 'gen-uuid-456', email: 'alice@corp.com', role: 'employee' }, workspaceId: 'workspace-1' }
→ Frontend redirects to /employees/dashboard
```

## Common Issues & Fixes

### Issue: "User role not found" after accept invite → login

**Root Causes**:
1. `auth_uid` not set correctly in public.users row
2. `ensureInternalUser` creates new row with default role='user' instead of preserving 'employee'
3. RPC queries by wrong field (should use auth_uid)

**Fix**:
- [x] Accept-invite queries duplicate users by `auth_uid` (not email)
- [x] ensureInternalUser upserts only non-role fields to preserve invited role
- [x] Explicit logging of auth_uid in both endpoints

### Issue: User redirects to wrong dashboard

**Root Cause**: Frontend doesn't implement role-based routing

**Fix**: Frontend's invite form and login handler must check role and redirect accordingly

### Issue: Middleware redirects user away from dashboard

**Root Cause**: Middleware requires workspace_id for all authenticated routes

**Fix**: Middleware allows null workspace_id for `/`, `/invite`, `/onboarding`, `/admin/platform-staff`

## Testing Checklist

- [ ] Create invite for super_admin (workspace_id = null)
- [ ] Accept invite → redirects to /admin
- [ ] Logout → Login → redirects to /admin
- [ ] Create invite for employee (workspace_id = workspace-1)
- [ ] Accept invite → redirects to /employees/dashboard
- [ ] Logout → Login → redirects to /employees/dashboard
- [ ] Check logs for role resolution at each step
- [ ] Verify auth_uid matches between auth.users and public.users

## Files Affected

| File | Change |
|------|--------|
| [app/api/employees/accept-invite/route.ts](app/api/employees/accept-invite/route.ts) | Query duplicate users by auth_uid, not email |
| [app/lib/supabase/queries.ts](app/lib/supabase/queries.ts) | Upsert preserves role field |
| [middleware.ts](middleware.ts) | Allows null workspace routes |
| [app/invite/invite-form.tsx](app/invite/invite-form.tsx) | Role-based redirect logic |
| [app/api/auth/login/route.ts](app/api/auth/login/route.ts) | (No changes, working correctly) |

## Version Info

- **Version**: v1 (No Facade, Direct Role Mapping)
- **Date**: January 2026
- **Last Updated**: [Production deployment date]
