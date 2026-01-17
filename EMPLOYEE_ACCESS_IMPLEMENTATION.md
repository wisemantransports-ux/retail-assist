# Employee Access Implementation - Complete Guide

## Overview

This document describes the complete employee workspace scoping implementation, including:
- Single workspace enforcement per employee
- Employee invite system with authorization checks
- Middleware routing and access control
- API layer workspace validation
- Database constraints and RLS policies

---

## Data Model

### Employee Table
```sql
CREATE TABLE public.employees (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,  -- Each user can be employee in ONE workspace
  workspace_id UUID NOT NULL,     -- The workspace they're assigned to
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- CRITICAL CONSTRAINT: User can only be employee in ONE workspace
  UNIQUE (user_id, workspace_id),
  
  -- Ensure user is not deleted orphaning the record
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Ensure workspace still exists
  FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);
```

### Employee Invites Table
```sql
CREATE TABLE public.employee_invites (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,     -- Which workspace the invite is for
  email TEXT NOT NULL,            -- Invited person's email
  invited_by UUID NOT NULL,       -- Who sent the invite (must be admin/super_admin)
  role TEXT DEFAULT 'employee',   -- 'employee' or 'platform_staff'
  token TEXT UNIQUE NOT NULL,     -- Secure token for acceptance
  status TEXT DEFAULT 'pending',  -- 'pending', 'accepted', 'revoked'
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP            -- 30 days from creation
);
```

---

## Role Hierarchy & Invite Rules

### Who Can Invite Whom

```
┌──────────────────────────────────────────────────────┐
│         INVITE AUTHORIZATION MATRIX                  │
├───────────────────┬────────────────┬─────────────────┤
│ Inviter Role      │ Can Invite     │ To Workspace    │
├───────────────────┼────────────────┼─────────────────┤
│ super_admin       │ platform_staff │ Platform WS*    │
│ super_admin       │ employee       │ Any workspace   │
│ admin (client)    │ employee       │ Own workspace   │
│ employee          │ (nobody)       │ (N/A)           │
│ platform_staff    │ (nobody)       │ (N/A)           │
└───────────────────┴────────────────┴─────────────────┘

* Platform WS = 00000000-0000-0000-0000-000000000001
```

### Enforcement

**Migration 032** - `rpc_create_employee_invite()`
- Validates inviter is admin or super_admin
- Validates inviter has access to workspace
- Validates role + workspace combination
- Returns error if inviter has insufficient permissions

**Migration 033** - `rpc_accept_employee_invite()`
- Validates invite token is valid and pending
- Validates user is not already an employee elsewhere
- Validates user is not already an admin
- Creates employee record with workspace_id
- Prevents multiple workspace assignments

---

## Workspace Scoping Enforcement

### 1. Single Workspace Per Employee

**Database Level** (Migration 035)
```sql
-- Unique constraint ensures user can belong to only one workspace
UNIQUE (user_id, workspace_id)

-- Constraint check prevents user from being both admin and employee
CREATE TRIGGER check_employee_not_admin_before_insert
```

**Application Level** (Migration 033)
```sql
-- Before accepting invite, check:
IF EXISTS (SELECT 1 FROM employees WHERE user_id = v_user_id) THEN
  RAISE EXCEPTION 'User is already an employee in another workspace'
END IF
```

### 2. RPC Returns Correct Workspace

**Migration 029** - `rpc_get_user_access()`
```sql
-- For employees, returns:
SELECT
  e.user_id,
  e.workspace_id,      -- THE workspace they belong to
  'employee'::text
FROM public.employees e
WHERE auth.uid() = (SELECT auth_uid FROM users WHERE id = e.user_id)
```

### 3. Middleware Validates Access

**middleware.ts** - Employee Role Handler
```typescript
if (role === 'employee') {
  // MUST have workspace_id
  if (!workspaceId) {
    // Invalid state: employee without workspace
    redirect to /unauthorized
  }
  
  // Can ONLY access /employees/dashboard
  if (pathname !== '/employees/dashboard' && !pathname.startsWith('/employees/dashboard/')) {
    redirect to /employees/dashboard
  }
  
  // Allows through (API layer validates workspace scoping)
}
```

### 4. API Layer Validates Workspace Access

**For /employees/dashboard/** endpoints:
```typescript
// When employee accesses a dashboard feature:
1. Get employee's workspace_id from RPC or request context
2. Validate requested workspace_id matches their assigned workspace
3. If mismatch, return 403 Forbidden

// Example: GET /api/employees/dashboard/messages
// Middleware gave us: role='employee', workspace_id='abc-123'
// Request asks for: ?workspace_id=xyz-789
// Result: FORBIDDEN (workspace mismatch)
```

---

## Login Flow for Employees

```
1. Employee has existing auth account
   (Created during invite acceptance via migration 033)

2. POST /api/auth/login
   ├─ Validate email + password with Supabase Auth
   ├─ Ensure internal user record exists
   ├─ Call rpc_get_user_access()
   │  └─ Returns (user_id, workspace_id, 'employee')
   └─ Return { role: 'employee', workspace_id: 'abc-123' }

3. Login page receives response
   ├─ Detects role === 'employee'
   └─ Redirects to /employees/dashboard

4. Browser makes request to /employees/dashboard
   ├─ Middleware validates: role='employee' + pathname starts with /employees/dashboard
   └─ Allows through

5. Employee dashboard loads
   ├─ Frontend knows: workspace_id = 'abc-123'
   ├─ All subsequent API calls include workspace_id
   └─ API layer validates workspace matches

6. Each API call:
   ├─ Middleware: Validates role + route
   ├─ API Handler: Validates workspace_id matches employee's assigned workspace
   └─ Database: RLS policies enforce row-level access
```

---

## Invite Acceptance Flow

### Step 1: Admin Sends Invite

```typescript
// Admin calls: POST /api/employees/invite
{
  email: "newstaff@email.com",
  workspace_id: "admin-workspace-uuid"
}

// Backend:
// 1. Verify caller is admin of that workspace (via RPC)
// 2. Call rpc_create_employee_invite()
// 3. Returns { invite_id, token }
// 4. Send email with acceptance link:
//    https://app.com/invite/employee?token=<token>
```

### Step 2: Employee Receives Invite

Employee gets email with acceptance link containing secure token.

### Step 3: Employee Accepts Invite

```typescript
// Employee navigates to: /auth/accept-invite?token=<token>
// This page calls: POST /api/auth/accept-employee-invite
{
  token: "token-from-url",
  full_name: "John Doe",
  phone: "+1234567890"
}

// Backend (Migration 033):
// 1. Find pending invite with this token
// 2. Validate invite hasn't expired (30 days)
// 3. Resolve invited user's auth_uid
// 4. Check user is not already employee elsewhere
// 5. Check user is not admin
// 6. Insert into employees table with workspace_id
// 7. Mark invite as accepted
// 8. Create Supabase auth session
// 9. Return redirect to /employees/dashboard
```

### Step 4: Employee's First Login

After acceptance, the newly created employee can login:

```
Employee @ /login
  ├─ Email: newstaff@email.com
  ├─ Password: Set during invite acceptance
  ├─ Login API calls rpc_get_user_access()
  └─ Returns (user_id, workspace_id, 'employee')
  
Redirects to /employees/dashboard
```

---

## Preventing Cross-Workspace Access

### Attack: Employee accessing another workspace

```
Employee1 (workspace A) tries to access workspace B's data:

1. Request: GET /api/dashboard/workspace/b-uuid/data
2. Middleware: role='employee' ✓, path NOT /employees/dashboard ✗
3. Result: BLOCKED - Redirected to /employees/dashboard
```

### Attack: Employee accessing admin dashboard

```
Employee tries to access /dashboard:

1. Request: GET /dashboard
2. Middleware: role='employee' + path='/dashboard' (not /employees/dashboard)
3. Result: BLOCKED - Redirected to /employees/dashboard
```

### Attack: Employee accessing another workspace via /employees/dashboard

```
Employee1 (workspace A) tries to access workspace B via employee dashboard:

1. Request: GET /api/employees/dashboard/messages?workspace_id=b-uuid
2. Middleware: role='employee' ✓, path='/employees/dashboard/*' ✓
3. API Handler: Checks request workspace_id vs employee's workspace_id
4. Result: BLOCKED - Returns 403 Forbidden
```

---

## Platform Staff Invite Flow

### Super Admin Invites Platform Staff

```
Super admin can ONLY invite to Platform Workspace:

POST /api/auth/invite
{
  email: "support@retail-assist.com",
  role: "platform_staff",
  workspace_id: "00000000-0000-0000-0000-000000000001"  // MUST be platform WS
}

Migration 032 validates:
- Inviter is super_admin
- Role is 'platform_staff'
- Workspace is platform workspace
- Returns error if any check fails
```

### Platform Staff Login

```
Platform staff auth creates employee record with:
- workspace_id = Platform workspace ID
- role = 'platform_staff' (from rpc_get_user_access)

Login redirects to /admin/support
Middleware blocks /admin, /dashboard, /employees/dashboard
```

---

## Test Cases & Validation

### Test: Employee Login
```bash
# Employee logs in
curl -X POST /api/auth/login \
  -d '{"email":"emp@client.com","password":"xxx"}'

# Expected response
{
  "user": { "role": "employee" },
  "workspaceId": "emp-workspace-uuid"
}

# Expected behavior: Redirects to /employees/dashboard
```

### Test: Employee Cannot Access Dashboard
```bash
# Employee tries to access /dashboard
curl /dashboard

# Middleware intercepts
# role='employee' + path='/dashboard' (not /employees/dashboard)
# Result: 302 Redirect to /employees/dashboard
```

### Test: Employee Cannot Access Admin
```bash
# Employee tries to access /admin
curl /admin

# Middleware intercepts
# role='employee' + path='/admin' (not /employees/dashboard)
# Result: 302 Redirect to /employees/dashboard
```

### Test: Employee Scoped to One Workspace
```bash
# Employee tries to access another workspace via API
curl /api/employees/dashboard/messages?workspace_id=other-uuid

# API checks: Is this employee in other-uuid workspace?
# Result: 403 Forbidden
```

### Test: Super Admin Can Invite to Platform Only
```bash
# Super admin tries to invite platform_staff to client workspace
curl -X POST /api/auth/invite \
  -d '{
    "email":"staff@retail-assist.com",
    "role":"platform_staff",
    "workspace_id":"client-workspace-uuid"
  }'

# Migration 032 validation fails
# Result: 400 Bad Request - "Platform staff must be invited to platform workspace only"
```

### Test: Client Admin Can Only Invite to Own Workspace
```bash
# Admin tries to invite employee to OTHER workspace
curl -X POST /api/auth/invite \
  -d '{
    "email":"emp@client.com",
    "role":"employee",
    "workspace_id":"other-workspace-uuid"
  }'

# Migration 032 validation checks:
# - Is inviter admin of other-workspace-uuid? NO
# Result: 403 Forbidden - "Only workspace admin can invite employees"
```

---

## Summary of Changes

### Migrations
1. **032** - Enhanced `rpc_create_employee_invite()` with authorization
2. **033** - Enhanced `rpc_accept_employee_invite()` with scoping validation
3. **035** - NEW - Database constraints and RLS policies for employee workspace scoping

### Middleware
- Enhanced employee role handler with detailed comments
- Validates employee has workspace_id
- Blocks non-/employees/dashboard access
- Delegates workspace validation to API layer

### RPC Functions
- `rpc_get_user_access()` - Already returns correct role + workspace_id
- `rpc_create_employee_invite()` - Now validates authorization
- `rpc_accept_employee_invite()` - Now validates scoping constraints
- `employee_has_workspace_access()` - NEW - Helper for API validation
- `get_employee_workspace()` - NEW - Get employee's single workspace

### API Guidelines
- /employees/dashboard/* endpoints MUST validate workspace_id matches employee's assigned workspace
- Return 403 Forbidden if workspace mismatch
- Use `get_employee_workspace()` to retrieve employee's workspace
- Use `employee_has_workspace_access()` to validate access

---

## Security Properties

✅ **Workspace Isolation**: Employees are scoped to single workspace via database constraint
✅ **Cannot Escape Scope**: Middleware + API layer validation prevents cross-workspace access
✅ **Authorization**: Only admins can invite employees to their workspace
✅ **Audit Trail**: All invites and acceptances are logged
✅ **Token Security**: 16-byte random tokens, single-use, 30-day expiry
✅ **Role Integrity**: Cannot be both admin and employee

---

**Last Updated**: January 16, 2026
**Status**: ✅ FULLY IMPLEMENTED
