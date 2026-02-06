# Employee Invite Flow - Complete Fix Summary

## Problem Root Cause

Employees invited by super admins were getting `workspaceId: null` in `/api/auth/me`, causing authorization failures even though invite acceptance succeeded.

### Root Issues Fixed:

1. **Missing Platform Workspace**: `PLATFORM_WORKSPACE_ID` didn't exist in `workspaces` table → FK violation
2. **No Workspace Assignment**: Invite acceptance wasn't resolving workspace for super_admin invites
3. **Wrong Resolution Order**: `/api/auth/me` was checking `users` table before `employees` table

---

## Fixes Applied

### ✅ Fix 1: Create Platform Workspace

**File**: `supabase/migrations/040_insert_platform_workspace.sql`

Created SQL migration to insert the platform workspace with fixed ID `00000000-0000-0000-0000-000000000001`.

**Status**: ✅ Workspace exists in database

---

### ✅ Fix 2: Resolve Workspace in Invite Acceptance

**File**: `app/api/employees/accept-invite/route.ts`

```typescript
// Resolve workspace based on who invited
const resolvedWorkspaceId = 
  invitedByRole === 'super_admin' 
    ? PLATFORM_WORKSPACE_ID  // Platform employees get platform workspace
    : invite.workspace_id;    // Client employees get their workspace

// Insert employee with valid workspace_id
const { error: employeeError } = await admin
  .from('employees')
  .insert({
    auth_uid: authUid,
    workspace_id: resolvedWorkspaceId,  // ✅ Never NULL
    invited_by_role: invitedByRole,
  });
```

**Changes**:
- Import `PLATFORM_WORKSPACE_ID` from config
- Resolve workspace id: super_admin → PLATFORM_WORKSPACE_ID, else → invite.workspace_id
- Insert employee with resolved workspace (never null)
- Return resolved workspace_id in response

---

### ✅ Fix 3: Authoritative Employee Role Resolution

**File**: `app/api/auth/me/route.ts`

```typescript
// 1️⃣ CHECK EMPLOYEES TABLE FIRST (AUTHORITATIVE)
const { data: employeeCheck } = await admin
  .from('employees')
  .select('workspace_id, invited_by_role')
  .eq('auth_uid', authUser.id)
  .maybeSingle();

if (employeeCheck) {
  // ✅ Employee found → return their workspace from employees table
  return NextResponse.json({
    role: 'employee',
    workspaceId: employeeCheck.workspace_id,
    user: {
      workspace_id: employeeCheck.workspace_id,
      // ...
    },
  });
}

// 2️⃣ NOT AN EMPLOYEE → check users table for admin roles
const { data: userDataFromDb } = await admin
  .from('users')
  .select('*')
  .eq('auth_uid', authUser.id)
  .single();

// Only super_admin (workspaceId=null) and client_admin resolved here
```

**Changes**:
- Import `PLATFORM_WORKSPACE_ID` from config
- Check employees table FIRST (not as fallback)
- Return `employeeCheck.workspace_id` directly (no null fallback)
- Only check users table for super_admin/client_admin roles

---

## Data Model (Corrected)

```
users table:
  - super_admin: role='super_admin', workspace_id=NULL
  
employees table:
  - employee: auth_uid, workspace_id=PLATFORM_WORKSPACE_ID or CLIENT_WS_ID, invited_by_role
```

**Auth Me Resolution Flow**:
```
1. Check employees → Found?
   ✓ Return role='employee', workspace_id from employees
   ✗ Continue to step 2

2. Check users → role=super_admin?
   ✓ Return role='super_admin', workspace_id=NULL
   ✓ Return role='client_admin', workspace_id from users
   ✗ Return 403 (no role)
```

---

## Expected Behavior After Fix

### Super Admin Invites Employee

```
POST /api/employees/invite
├── invite.workspace_id = null (super admin scope)
├── invited_by_role = 'super_admin'
│
POST /api/employees/accept-invite
├── resolvedWorkspaceId = PLATFORM_WORKSPACE_ID ✅
├── employee.workspace_id = PLATFORM_WORKSPACE_ID ✅
└── Returns: { workspace_id: PLATFORM_WORKSPACE_ID }
│
GET /api/auth/me
├── Checks employees → Found ✅
├── Returns: { role: 'employee', workspaceId: PLATFORM_WORKSPACE_ID }
└── GET /employees/dashboard → 200 ✅
```

### Client Admin Invites Employee

```
POST /api/employees/invite
├── invite.workspace_id = 'client-workspace-id' ✅
├── invited_by_role = 'client_admin'
│
POST /api/employees/accept-invite
├── resolvedWorkspaceId = 'client-workspace-id' ✅
├── employee.workspace_id = 'client-workspace-id' ✅
└── Returns: { workspace_id: 'client-workspace-id' }
│
GET /api/auth/me
├── Checks employees → Found ✅
├── Returns: { role: 'employee', workspaceId: 'client-workspace-id' }
└── GET /employees/dashboard → 200 ✅
```

---

## Testing Checklist

- [ ] Super admin creates invite (via UI or `/api/employees/invite`)
- [ ] Employee receives invite token
- [ ] Employee accepts invite (password set, auth user created)
- [ ] Employee logs in with email + password
- [ ] `/api/auth/me` returns:
  - `role: 'employee'` ✅
  - `workspaceId: PLATFORM_WORKSPACE_ID` ✅
  - `user.workspace_id: PLATFORM_WORKSPACE_ID` ✅
- [ ] Redirect to `/employees/dashboard` works (no 403)
- [ ] Dashboard loads with correct workspace context

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/migrations/040_insert_platform_workspace.sql` | New migration to insert platform workspace |
| `app/api/employees/accept-invite/route.ts` | Resolve workspace_id for all invites |
| `app/api/auth/me/route.ts` | Check employees table first (authoritative) |

---

## Key Principles Enforced

✅ **Employees are workspace-scoped**: Cannot have `workspace_id = NULL`  
✅ **Employees table is authoritative**: `/api/auth/me` resolves role from employees table  
✅ **Super admins remain workspace-less**: `users.workspace_id = NULL`  
✅ **No security relaxation**: All authorization rules remain strict  
✅ **Idempotent migrations**: Can be re-run safely  
