# Employee Role-Based Middleware Implementation

## Overview

Updated the middleware to enforce strict role-based access control for three distinct user roles:
- **Super Admin** (workspace_id = NULL)
- **Client Admin** (workspace_id != NULL)
- **Employee** (role = 'employee', scoped to workspace)

## Changes Made

### 1. Updated `/app/middleware.ts`

#### Key Features:
- **Session Detection**: Validates Supabase Auth session from cookies
- **RPC Role Resolution**: Fetches role and workspace_id using `rpc_get_user_access()`
- **Comprehensive Access Control**: Blocks cross-role access with clear logging
- **Unauthorized Redirect**: Routes unauthorized users to `/unauthorized` page

#### Role-Based Routing:

**Super Admin Access**
```
- Can access: /admin, /admin/*
- Cannot access: /dashboard/*, /employees/*
- workspace_id: NULL
- Automatic redirect: Always redirects to /admin if accessing other routes
```

**Client Admin Access**
```
- Can access: /dashboard, /dashboard/*
- Cannot access: /admin/*, /employees/*
- workspace_id: Non-null UUID (their workspace)
- Automatic redirect: Always redirects to /dashboard if accessing other routes
```

**Employee Access**
```
- Can access: /employees/dashboard, /employees/dashboard/*
- Cannot access: /admin/*, /dashboard/*
- workspace_id: Non-null UUID (their assigned workspace)
- Must have workspace_id (employees without workspace are unauthorized)
- Automatic redirect: Always redirects to /employees/dashboard if accessing other routes
```

### 2. Validation Logic Flow

```
1. Check Supabase Auth Session
   ├─ If missing → Redirect to /login
   └─ If valid → Continue

2. Fetch User Role via RPC
   ├─ If RPC error → Redirect to /login
   └─ If success → Continue

3. Validate Role Exists
   ├─ If no role → Redirect to /unauthorized
   └─ If role exists → Continue

4. Enforce Role-Based Access
   ├─ Super Admin (role=super_admin OR role=admin + workspace_id=NULL)
   │  ├─ Accessing /employees/* or /dashboard/* → Redirect to /admin
   │  ├─ Accessing /admin/* → Allow
   │  └─ Accessing other routes → Redirect to /admin
   │
   ├─ Client Admin (role=admin + workspace_id!=NULL)
   │  ├─ Accessing /admin/* or /employees/* → Redirect to /dashboard
   │  ├─ Accessing /dashboard/* → Allow
   │  └─ Accessing other routes → Redirect to /dashboard
   │
   ├─ Employee (role=employee)
   │  ├─ No workspace_id → Redirect to /unauthorized
   │  ├─ Accessing /admin/* or /dashboard/* → Redirect to /employees/dashboard
   │  ├─ Accessing /employees/dashboard/* → Allow
   │  └─ Accessing other routes → Redirect to /employees/dashboard
   │
   └─ Unknown Role → Redirect to /unauthorized
```

### 3. RPC Support

The middleware relies on `rpc_get_user_access()` which:
- Returns user_id, workspace_id, and role for authenticated users
- Handles priority-based role resolution:
  1. **Super Admin** (users table with role='super_admin')
  2. **Client Admin / Super Admin** (admin_access table, may have NULL workspace_id)
  3. **Employee** (employees table linked to workspace/business_id)

### 4. Logging

Enhanced logging for debugging:
- `[Middleware] Session check` - Initial session validation
- `[Middleware] Resolved role` - RPC role result
- `[Middleware] Workspace ID` - User's workspace scope
- `[Middleware] Processing <role> access` - Role-specific handling
- `[Middleware] Redirecting <role> to <path>` - Route decisions
- `[Middleware] <role> attempted to access protected route` - Access violations

## Middleware Coverage

The middleware applies to these routes:
- `/admin/*` - Super admin dashboard and management
- `/dashboard/*` - Client admin business dashboard
- `/employees/*` - Employee messaging and task management

## Security Considerations

1. **No Direct Role Switching**: Users cannot manually navigate to unauthorized routes
2. **Continuous Validation**: Every protected route request is validated
3. **Workspace Isolation**: Employees are bound to their assigned workspace
4. **Unauthorized Fallback**: Invalid/unknown roles are caught and redirected
5. **Session Required**: All role-based routing requires valid Supabase Auth session

## Testing

Run the test script to verify all three roles:
```bash
node test-middleware-roles.js
```

This tests:
- ✅ Super admin can access /admin routes
- ✅ Super admin cannot access /dashboard or /employees routes
- ✅ Client admin can access /dashboard routes
- ✅ Client admin cannot access /admin or /employees routes
- ✅ Employees can access /employees/dashboard routes
- ✅ Employees cannot access /admin or /dashboard routes

## Implementation Details

### Files Modified
- `/app/middleware.ts` - Complete rewrite with enhanced role-based logic

### Files Created
- `test-middleware-roles.js` - Test suite for role-based access control

### Existing Components
- `/app/unauthorized/page.tsx` - Access denied page (already existed)
- `rpc_get_user_access()` - RPC function handling role resolution
- Database tables: users, admin_access, employees, workspaces

## Migration Path

No database changes required. The middleware works with existing:
- `users` table with `role` and `auth_uid` columns
- `admin_access` table with `user_id` and `workspace_id`
- `employees` table with `user_id` and `business_id` (workspace reference)
- `workspaces` table for business/workspace definitions

## Future Enhancements

Potential improvements:
1. Add workspace_id validation for client admin (ensure they own the workspace)
2. Add employee workspace validation (ensure they're assigned to the workspace)
3. Add rate limiting to prevent brute-force role detection
4. Add audit logging for access violations
5. Add cache for RPC results to reduce database queries
