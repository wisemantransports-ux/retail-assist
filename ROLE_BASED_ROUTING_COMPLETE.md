# Role-Based Routing & Middleware Implementation - COMPLETE

## Overview
This document summarizes the complete implementation of role-based routing and middleware for Retail Assist, supporting 4 distinct roles with proper access control at the edge and client levels.

---

## Authoritative Role Model (Per Requirements)

### 1. **Super Admin** (`super_admin`)
- **Scope**: Platform-level (Retail Assist owner)
- **workspace_id**: `NULL` (never has workspace)
- **Primary Route**: `/admin`
- **Access Rules**:
  - ✅ Can access `/admin` and all sub-routes
  - ❌ Cannot access `/dashboard`, `/employees/dashboard`, or `/admin/support`
  - Cannot be a client admin
  - Never accesses `/dashboard`
  - Always has `workspace_id = NULL`

### 2. **Platform Staff** (`platform_staff`)
- **Scope**: Internal Retail Assist employees
- **workspace_id**: `00000000-0000-0000-0000-000000000001` (platform workspace)
- **Primary Route**: `/admin/support`
- **Access Rules**:
  - ✅ Can access `/admin/support` and sub-routes
  - ❌ Cannot access `/admin`, `/dashboard`, or `/employees/dashboard`
  - Identified by being member of platform workspace

### 3. **Client Admin** (`admin`)
- **Scope**: Client business owner (one workspace)
- **workspace_id**: Non-null, NOT platform workspace ID
- **Primary Route**: `/dashboard`
- **Access Rules**:
  - ✅ Can access `/dashboard` and all sub-routes
  - ❌ Cannot access `/admin`, `/admin/support`, or `/employees/dashboard`
  - Must have valid workspace_id for their client workspace

### 4. **Employee** (`employee`)
- **Scope**: Client business staff (one workspace)
- **workspace_id**: Assigned client workspace
- **Primary Route**: `/employees/dashboard`
- **Access Rules**:
  - ✅ Can access `/employees/dashboard` and sub-routes
  - ❌ Cannot access `/admin`, `/admin/support`, or `/dashboard`
  - Must have workspace_id set
  - Scoped to exactly ONE workspace

---

## Implementation Details

### 1. Database Layer - RPC Function

**File**: [supabase/migrations/029_fix_get_user_access.sql](supabase/migrations/029_fix_get_user_access.sql)

**Changes**:
- Added `platform_staff` role detection
- Returns exactly ONE row with (user_id, workspace_id, role)
- Role Priority Order:
  1. `super_admin` (workspace_id = NULL)
  2. `platform_staff` (workspace_id = platform workspace ID)
  3. `admin` (workspace_id = client workspace, excluding platform workspace)
  4. `employee` (workspace_id = assigned workspace)

**Key Logic**:
```sql
-- Super Admin check (users table, role = 'super_admin')
select u.id, null::uuid, 'super_admin', 1
from public.users u
where u.auth_uid = auth.uid() and u.role = 'super_admin'

-- Platform Staff check (admin_access table, workspace_id = platform ID)
select aa.user_id, PLATFORM_WORKSPACE_ID, 'platform_staff', 2
from public.admin_access aa
where u.auth_uid = auth.uid() and aa.workspace_id = PLATFORM_WORKSPACE_ID

-- Client Admin check (admin_access table, non-null workspace_id != platform ID)
select aa.user_id, aa.workspace_id, 'admin', 3
from public.admin_access aa
where u.auth_uid = auth.uid() and aa.workspace_id is not null
and aa.workspace_id != PLATFORM_WORKSPACE_ID

-- Employee check (employees table, not admin or super_admin)
select e.user_id, e.workspace_id, 'employee', 4
from public.employees e
where u.auth_uid = auth.uid() and NOT EXISTS (admin_access) and NOT EXISTS (super_admin)
```

---

### 2. Edge-Level Routing - Middleware

**File**: [middleware.ts](middleware.ts)

**Changes**:
- Added `platform_staff` role handling
- Validates workspace_id matches role requirements
- Implements role-based redirects at edge level
- Comments explain each role's access rules

**Middleware Flow**:
1. Check if session exists → redirect to `/login` if not
2. Call `rpc_get_user_access()` → get (role, workspace_id)
3. Validate role has required workspace_id:
   - `super_admin`: workspace_id must be NULL
   - `platform_staff`: workspace_id must be PLATFORM_WORKSPACE_ID
   - `admin`: workspace_id must not be null and not be platform workspace
   - `employee`: workspace_id must not be null
4. Route based on role:
   - `super_admin` → `/admin`
   - `platform_staff` → `/admin/support`
   - `admin` → `/dashboard`
   - `employee` → `/employees/dashboard`
5. Any unauthorized access → `/unauthorized`

**Protected Routes in Middleware**:
```typescript
matcher: [
  '/admin',
  '/admin/:path*',
  '/dashboard',
  '/dashboard/:path*',
  '/employees',
  '/employees/:path*'
]
```

---

### 3. Server-Side Auth Endpoints

#### 3.1 Login Endpoint
**File**: [app/api/auth/login/route.ts](app/api/auth/login/route.ts)

**Changes**:
- Always calls `rpc_get_user_access()` after successful login
- Returns role and workspace_id to client
- Validates role was successfully resolved
- Comments explain 4 role types and their workspace_id values

**Response Structure**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "super_admin|platform_staff|admin|employee"
  },
  "workspaceId": "uuid|null"
}
```

#### 3.2 Auth Me Endpoint
**File**: [app/api/auth/me/route.ts](app/api/auth/me/route.ts)

**Changes**:
- Calls `rpc_get_user_access()` to get authoritative role and workspace_id
- Returns both values to client
- Removed fallback workspace_id logic (RPC is authoritative)
- Validates role was resolved; returns 403 if missing

**Response Structure**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "super_admin|platform_staff|admin|employee",
    "workspace_id": "uuid|null",
    "plan_type": "starter|pro|enterprise",
    ...
  }
}
```

---

### 4. Client-Side Login Flow

**File**: [app/auth/login/page.tsx](app/auth/login/page.tsx)

**Changes**:
- Receives role and workspace_id from `/api/auth/login` response
- Routes based on role:
  - `super_admin` → `/admin`
  - `platform_staff` → `/admin/support`
  - `admin` → `/dashboard`
  - `employee` → `/employees/dashboard`
- Console logs indicate routing decision
- Any unknown role → `/unauthorized`

**Key Logic**:
```typescript
const role = data.user?.role;
const workspaceId = data.workspaceId;

if (role === 'super_admin') router.push('/admin');
else if (role === 'platform_staff') router.push('/admin/support');
else if (role === 'admin') router.push('/dashboard');
else if (role === 'employee') router.push('/employees/dashboard');
else router.push('/unauthorized');
```

---

### 5. Client-Side Signup Flow

**File**: [app/auth/signup/page.tsx](app/auth/signup/page.tsx)

**Changes**:
- After successful signup, calls `rpc_get_user_access()` on client
- Routes to appropriate dashboard based on resolved role
- Handles all 4 role types
- Gracefully handles errors (surfaces as user-facing message)

**Post-Signup Redirect Logic**:
- Same as login: role-based routing to appropriate dashboard

---

## Data Flow & Guarantees

### Login Flow Sequence
```
1. User submits email/password
   ↓
2. /api/auth/login validates credentials with Supabase Auth
   ↓
3. /api/auth/login calls rpc_get_user_access()
   ↓
4. RPC returns (user_id, workspace_id, role) - exactly ONE row
   ↓
5. /api/auth/login returns role + workspace_id to client
   ↓
6. Login page uses role to determine redirect:
   - super_admin → /admin (validated by middleware)
   - platform_staff → /admin/support (validated by middleware)
   - admin → /dashboard (validated by middleware)
   - employee → /employees/dashboard (validated by middleware)
```

### Subsequent Requests Flow
```
1. Middleware intercepts request to protected route
   ↓
2. Middleware calls rpc_get_user_access()
   ↓
3. RPC validates role and workspace_id
   ↓
4. Middleware validates role matches route:
   - /admin/* → only super_admin allowed
   - /admin/support/* → only platform_staff allowed
   - /dashboard/* → only admin allowed
   - /employees/dashboard/* → only employee allowed
   ↓
5. If valid: continue to endpoint
   If invalid: redirect to /unauthorized
```

---

## Key Invariants

### Super Admin Invariants
- ✅ workspace_id is ALWAYS NULL
- ✅ Never has admin_access row with non-null workspace_id
- ✅ Can only access `/admin`
- ✅ Middleware rejects `/dashboard`, `/employees/dashboard`, `/admin/support`

### Platform Staff Invariants
- ✅ workspace_id is ALWAYS `00000000-0000-0000-0000-000000000001`
- ✅ Identified by admin_access with that workspace_id
- ✅ Can only access `/admin/support`
- ✅ Middleware rejects `/admin`, `/dashboard`, `/employees/dashboard`

### Client Admin Invariants
- ✅ workspace_id is NOT NULL
- ✅ workspace_id is NOT platform workspace ID
- ✅ Has admin_access row with their workspace_id
- ✅ Can only access `/dashboard`
- ✅ Middleware rejects `/admin`, `/admin/support`, `/employees/dashboard`

### Employee Invariants
- ✅ workspace_id is NOT NULL
- ✅ workspace_id matches their assigned workspace
- ✅ Does NOT have admin_access row
- ✅ Belongs to exactly ONE workspace
- ✅ Can only access `/employees/dashboard`
- ✅ Middleware rejects `/admin`, `/admin/support`, `/dashboard`

---

## Testing Checklist

### Super Admin Login
- [ ] Super admin logs in with valid credentials
- [ ] `/api/auth/login` returns `role: 'super_admin'`, `workspace_id: null`
- [ ] Login page redirects to `/admin`
- [ ] Can access `/admin` and sub-routes
- [ ] Middleware blocks access to `/dashboard`, `/employees/dashboard`, `/admin/support`

### Platform Staff Login
- [ ] Platform staff logs in with valid credentials
- [ ] `/api/auth/login` returns `role: 'platform_staff'`, `workspace_id: PLATFORM_WORKSPACE_ID`
- [ ] Login page redirects to `/admin/support`
- [ ] Can access `/admin/support` and sub-routes
- [ ] Middleware blocks access to `/admin`, `/dashboard`, `/employees/dashboard`

### Client Admin Login
- [ ] Client admin logs in with valid credentials
- [ ] `/api/auth/login` returns `role: 'admin'`, `workspace_id: <client-workspace-id>`
- [ ] Login page redirects to `/dashboard`
- [ ] Can access `/dashboard` and sub-routes
- [ ] Middleware blocks access to `/admin`, `/admin/support`, `/employees/dashboard`

### Employee Login
- [ ] Employee logs in with valid credentials
- [ ] `/api/auth/login` returns `role: 'employee'`, `workspace_id: <assigned-workspace-id>`
- [ ] Login page redirects to `/employees/dashboard`
- [ ] Can access `/employees/dashboard` and sub-routes
- [ ] Middleware blocks access to `/admin`, `/admin/support`, `/dashboard`

### Unauthorized Access
- [ ] No session: redirect to `/login`
- [ ] Invalid role from RPC: redirect to `/unauthorized`
- [ ] Super admin accessing `/dashboard`: redirect to `/admin`
- [ ] Admin accessing `/admin`: redirect to `/dashboard`
- [ ] Employee accessing `/dashboard`: redirect to `/employees/dashboard`

---

## API Endpoints - No Changes Required

The following endpoints already properly handle role-based access:
- `/api/admin/users/*` - Uses session verification, checks for `super_admin` role
- Billing endpoints - Use workspace_id for scoping
- Workspace endpoints - Already validate workspace membership

**Note**: These endpoints do NOT use `rpc_get_user_access()` but rely on session verification and explicit role checks. They are compatible with the new role model.

---

## Session & Auth Preservation

All changes preserve existing session logic:
- Supabase Auth cookies are maintained
- Custom session_id cookies are maintained
- Login endpoints create sessions as before
- No changes to session validation or expiration

---

## Summary of Files Changed

| File | Change Type | Purpose |
|------|-------------|---------|
| [supabase/migrations/029_fix_get_user_access.sql](supabase/migrations/029_fix_get_user_access.sql) | Updated RPC | Added `platform_staff` role detection |
| [middleware.ts](middleware.ts) | Updated | Added `platform_staff` handling, improved validation |
| [app/api/auth/login/route.ts](app/api/auth/login/route.ts) | Enhanced | Better comments, added error handling for missing role |
| [app/api/auth/me/route.ts](app/api/auth/me/route.ts) | Enhanced | Better comments, fixed workspace_id source (RPC only) |
| [app/auth/login/page.tsx](app/auth/login/page.tsx) | Updated | Added `platform_staff` route handling |
| [app/auth/signup/page.tsx](app/auth/signup/page.tsx) | Updated | Added `platform_staff` route handling |

---

## Deployment Notes

1. **Database Migration**: Run migration 029 to update RPC function
2. **Middleware**: Deploy new middleware.ts
3. **API Endpoints**: Deploy updated `/api/auth/login` and `/api/auth/me`
4. **Client**: Deploy updated login and signup pages
5. **Testing**: Run full test suite to verify role-based access

**No breaking changes**: All existing authentication and session logic is preserved.

---

## Constants

### Platform Workspace ID
```typescript
const PLATFORM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
```

This ID appears in:
- [middleware.ts](middleware.ts)
- [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
- [app/api/auth/me/route.ts](app/api/auth/me/route.ts)
- [app/auth/login/page.tsx](app/auth/login/page.tsx)

---

## Related Documents

- [SYSTEM_INSTRUCTIONS.MD](SYSTEM_INSTRUCTIONS.MD) - Core system design
- [ROLE_HIERARCHY_QUICK_REF.md](ROLE_HIERARCHY_QUICK_REF.md) - Role hierarchy overview
- [AUTH_SESSION_FIX_SUMMARY.md](AUTH_SESSION_FIX_SUMMARY.md) - Previous auth fixes

---

**Last Updated**: January 16, 2026  
**Status**: ✅ COMPLETE - All changes implemented and documented
