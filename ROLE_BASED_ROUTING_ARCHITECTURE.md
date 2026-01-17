# Role-Based Routing Architecture Diagram

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        RETAIL ASSIST PLATFORM                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                       BROWSER (CLIENT)                      │   │
│  │  ┌──────────────────┐          ┌──────────────────────┐    │   │
│  │  │  Login Page      │ ─────→   │  Signup Page         │    │   │
│  │  │  (login.tsx)     │          │  (signup.tsx)        │    │   │
│  │  └────────┬─────────┘          └──────────┬───────────┘    │   │
│  │           │                               │               │   │
│  │           └───────────────┬───────────────┘               │   │
│  │                           │                               │   │
│  │                    POST /api/auth/login                  │   │
│  │                    POST /api/auth/signup                 │   │
│  │                           │                               │   │
│  └───────────────────────────┼───────────────────────────────┘   │
│                              │                                     │
│  ┌──────────────────────────┴────────────────────────────────┐   │
│  │                    NEXT.js EDGE LAYER                      │   │
│  │                   (middleware.ts)                          │   │
│  │                                                            │   │
│  │  All requests to /admin, /dashboard, /employees           │   │
│  │  1. Check session exists                                  │   │
│  │  2. Call rpc_get_user_access() → get role + workspace_id │   │
│  │  3. Validate role-route match                             │   │
│  │  4. Grant access or redirect to /unauthorized             │   │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │                                     │
│  ┌──────────────────────────┴────────────────────────────────┐   │
│  │               SERVER LAYER (Node.js API)                  │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  /api/auth/login                                  │   │   │
│  │  │  1. Validate credentials with Supabase Auth       │   │   │
│  │  │  2. Ensure internal user exists                   │   │   │
│  │  │  3. Call rpc_get_user_access()                    │   │   │
│  │  │  4. Return { role, workspace_id } to client       │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  /api/auth/me                                     │   │   │
│  │  │  1. Check session exists                          │   │   │
│  │  │  2. Fetch user from database                      │   │   │
│  │  │  3. Call rpc_get_user_access()                    │   │   │
│  │  │  4. Return user + role + workspace_id             │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐   │   │
│  │  │  /api/admin/users, /api/workspace/*, etc.         │   │   │
│  │  │  (Existing endpoints - No changes)                │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  │                                                            │   │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │                                     │
│                     RPC: rpc_get_user_access()                   │
│                             │                                     │
│  ┌──────────────────────────┴────────────────────────────────┐   │
│  │                   DATABASE LAYER                          │   │
│  │  (Supabase / PostgreSQL)                                  │   │
│  │                                                            │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ RPC: rpc_get_user_access()                       │    │   │
│  │  │                                                   │    │   │
│  │  │ SELECT role, workspace_id WHERE user_id = uid   │    │   │
│  │  │                                                   │    │   │
│  │  │ 1. Check users.role = 'super_admin'             │    │   │
│  │  │    → return (NULL workspace_id, super_admin)    │    │   │
│  │  │                                                   │    │   │
│  │  │ 2. Check admin_access with PLATFORM_WORKSPACE   │    │   │
│  │  │    → return (PLATFORM_WORKSPACE, platform_staff)│    │   │
│  │  │                                                   │    │   │
│  │  │ 3. Check admin_access with client workspace     │    │   │
│  │  │    → return (client_workspace, admin)           │    │   │
│  │  │                                                   │    │   │
│  │  │ 4. Check employees table                        │    │   │
│  │  │    → return (assigned_workspace, employee)      │    │   │
│  │  │                                                   │    │   │
│  │  │ Return: (user_id, workspace_id, role)           │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                            │   │
│  │  Tables Referenced:                                       │   │
│  │  - public.users (role, auth_uid)                         │   │
│  │  - public.admin_access (workspace_id, user_id)           │   │
│  │  - public.employees (workspace_id, user_id)              │   │
│  │  - public.workspaces (id)                                │   │
│  │                                                            │   │
│  └─────────────────────────────────────────────────────────── │   │
│                                                              │   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Login → Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOGIN FLOW (Detailed)                        │
└─────────────────────────────────────────────────────────────────┘

1. USER ENTERS EMAIL/PASSWORD
   │
   ├─→ [Login Page] POST /api/auth/login
   │
   ├─→ [Server] Validate with Supabase Auth
   │   │
   │   └─→ ✅ Credentials valid → Continue
   │       ❌ Invalid → Return 401
   │
   ├─→ [Server] Ensure internal user exists
   │   │
   │   └─→ Create or fetch from users table
   │
   ├─→ [Server] Call rpc_get_user_access()
   │   │
   │   ├─→ If super_admin:
   │   │   ├─ Return (user_id, NULL, 'super_admin')
   │   │   └─ This is the ONLY super admin path
   │   │
   │   ├─→ If platform_staff:
   │   │   ├─ Check admin_access.workspace_id = '00000000...'
   │   │   └─ Return (user_id, '00000000...', 'platform_staff')
   │   │
   │   ├─→ If client admin:
   │   │   ├─ Check admin_access.workspace_id = (non-null, non-platform)
   │   │   └─ Return (user_id, workspace_id, 'admin')
   │   │
   │   └─→ If employee:
   │       ├─ Check employees.workspace_id = workspace_id
   │       └─ Return (user_id, workspace_id, 'employee')
   │
   ├─→ [Server] Return { role, workspace_id } to client
   │   │
   │   └─→ Example: { user: { role: 'admin' }, workspaceId: 'abc-123' }
   │
   ├─→ [Client] Receive role and workspace_id
   │   │
   │   ├─→ if role === 'super_admin'    → router.push('/admin')
   │   ├─→ if role === 'platform_staff' → router.push('/admin/support')
   │   ├─→ if role === 'admin'          → router.push('/dashboard')
   │   ├─→ if role === 'employee'       → router.push('/employees/dashboard')
   │   └─→ else                         → router.push('/unauthorized')
   │
   ├─→ [Browser] Navigate to correct dashboard
   │   │
   │   └─→ [Middleware] Intercepts request
   │       │
   │       ├─→ Check session exists ✅
   │       ├─→ Call rpc_get_user_access() (revalidate)
   │       ├─→ Validate role-route match
   │       │   ├─→ super_admin + /admin ✅ ALLOW
   │       │   ├─→ admin + /dashboard ✅ ALLOW
   │       │   ├─→ etc.
   │       │   └─→ Mismatches → /unauthorized
   │       │
   │       └─→ Grant access to dashboard
   │
   └─→ USER SEES DASHBOARD

All subsequent requests are validated by [Middleware]
Each request → Check session → Call RPC → Validate → Allow/Deny
```

---

## Role-Route Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│               MIDDLEWARE VALIDATION LOGIC                       │
└─────────────────────────────────────────────────────────────────┘

REQUEST: /dashboard
  │
  ├─→ Middleware calls rpc_get_user_access()
  │
  ├─→ role = 'super_admin'?
  │   ├─ YES → ❌ BLOCK (redirect to /admin)
  │   └─ NO → Continue
  │
  ├─→ role = 'platform_staff'?
  │   ├─ YES → ❌ BLOCK (redirect to /admin/support)
  │   └─ NO → Continue
  │
  ├─→ role = 'admin'?
  │   ├─ YES → ✅ ALLOW (this route is for admins)
  │   └─ NO → Continue
  │
  ├─→ role = 'employee'?
  │   ├─ YES → ❌ BLOCK (redirect to /employees/dashboard)
  │   └─ NO → Continue
  │
  └─→ Unknown role → ❌ BLOCK (redirect to /unauthorized)


REQUEST: /employees/dashboard
  │
  ├─→ Middleware calls rpc_get_user_access()
  │
  ├─→ role = 'super_admin'?
  │   ├─ YES → ❌ BLOCK (redirect to /admin)
  │   └─ NO → Continue
  │
  ├─→ role = 'platform_staff'?
  │   ├─ YES → ❌ BLOCK (redirect to /admin/support)
  │   └─ NO → Continue
  │
  ├─→ role = 'admin'?
  │   ├─ YES → ❌ BLOCK (redirect to /dashboard)
  │   └─ NO → Continue
  │
  ├─→ role = 'employee'?
  │   ├─ YES → ✅ ALLOW (this route is for employees)
  │   └─ NO → Continue
  │
  └─→ Unknown role → ❌ BLOCK (redirect to /unauthorized)


[Similar logic for /admin and /admin/support]
```

---

## RPC Priority System

```
The RPC checks roles in priority order and returns on FIRST MATCH:

┌──────────────────────────────────────────────────────────┐
│  Priority 1: SUPER ADMIN                                 │
│  ├─ Source: users.role = 'super_admin'                   │
│  ├─ workspace_id: NULL                                   │
│  ├─ Return: (user_id, NULL, 'super_admin')               │
│  └─ STOP - Don't check further                           │
└──────────────────────────────────────────────────────────┘
                        ↓
              (If not super admin)
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Priority 2: PLATFORM STAFF                              │
│  ├─ Source: admin_access.workspace_id =                  │
│  │            '00000000-0000-0000-0000-000000000001'     │
│  ├─ workspace_id: '00000000-0000-0000-0000-000000000001' │
│  ├─ Return: (user_id, PLATFORM_WORKSPACE_ID, 'platform..│
│  └─ STOP - Don't check further                           │
└──────────────────────────────────────────────────────────┘
                        ↓
              (If not platform staff)
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Priority 3: CLIENT ADMIN                                │
│  ├─ Source: admin_access.workspace_id IS NOT NULL        │
│  │           AND workspace_id !=                         │
│  │            '00000000-0000-0000-0000-000000000001'     │
│  ├─ workspace_id: Their client workspace UUID            │
│  ├─ Return: (user_id, workspace_id, 'admin')             │
│  └─ STOP - Don't check further                           │
└──────────────────────────────────────────────────────────┘
                        ↓
              (If not client admin)
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Priority 4: EMPLOYEE                                    │
│  ├─ Source: employees.user_id (exists)                   │
│  ├─ workspace_id: Their assigned workspace UUID          │
│  ├─ Return: (user_id, workspace_id, 'employee')          │
│  └─ STOP                                                 │
└──────────────────────────────────────────────────────────┘
                        ↓
              (If no role found)
                        ↓
           Return: (no row) = NULL role
                        ↓
           Middleware redirects to /unauthorized
```

---

## Component Responsibility

```
┌──────────────────────────────────────────────────────────────────┐
│                     RESPONSIBILITY MATRIX                        │
├─────────────────────┬──────────────────┬──────────────────────────┤
│ Component           │ Responsibility   │ Key Validation           │
├─────────────────────┼──────────────────┼──────────────────────────┤
│ rpc_get_user_access │ Determine role   │ Authoritative source     │
│                     │ & workspace_id   │ Returns exactly 1 row    │
│                     │                  │ Handles all role checks  │
├─────────────────────┼──────────────────┼──────────────────────────┤
│ Middleware          │ Edge routing     │ Validates role-route     │
│                     │ & access control │ Prevents unauthorized    │
│                     │                  │ access to routes         │
├─────────────────────┼──────────────────┼──────────────────────────┤
│ Login API           │ Authenticate     │ Gets role from RPC       │
│ /api/auth/login     │ user & resolve   │ Returns role to client   │
│                     │ role             │ Client decides redirect  │
├─────────────────────┼──────────────────┼──────────────────────────┤
│ Auth Me API         │ Session check    │ Gets role from RPC       │
│ /api/auth/me        │ & return user    │ Returns role to client   │
│                     │ with role        │ Used for dashboard init  │
├─────────────────────┼──────────────────┼──────────────────────────┤
│ Login Page          │ Route after      │ Uses role to choose path │
│ (Client)            │ login            │ Redirects to dashboard   │
├─────────────────────┼──────────────────┼──────────────────────────┤
│ Signup Page         │ Route after      │ Uses role to choose path │
│ (Client)            │ signup           │ Redirects to dashboard   │
└─────────────────────┴──────────────────┴──────────────────────────┘
```

---

## Session & Cookie Flow

```
LOGIN
  │
  ├─→ POST /api/auth/login
  │   ├─→ Supabase creates auth session (cookies set)
  │   ├─→ Server creates session record (session_id cookie)
  │   └─→ Return role + workspace_id to client
  │
  ├─→ Client receives response + cookies
  │
  ├─→ Client stores cookies (automatic by browser)
  │
  ├─→ Client redirects to dashboard
  │
  ├─→ Browser makes request to dashboard
  │   └─→ Cookies sent automatically with request
  │
  ├─→ Middleware validates request
  │   ├─→ Reads auth cookie (Supabase session)
  │   ├─→ Reads session_id cookie (custom session)
  │   ├─→ Both must be valid
  │   └─→ Calls RPC to get role
  │
  └─→ Access granted if role matches route


LOGOUT
  │
  ├─→ Clear cookies on client
  │
  ├─→ Call /api/auth/logout
  │   └─→ Invalidate session on server
  │
  └─→ Redirect to /login
      └─→ Middleware blocks access to /dashboard (no session)
          → Redirects to /login
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────┐
│ ERROR: No Session                       │
├─────────────────────────────────────────┤
│ Where: Middleware                       │
│ Action: Redirect to /login              │
│ Log: "No valid session found"           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ERROR: RPC Returns No Role              │
├─────────────────────────────────────────┤
│ Where: Middleware or Login API          │
│ Action: Redirect to /unauthorized       │
│ Log: "No role found for user"           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ERROR: Role-Route Mismatch              │
├─────────────────────────────────────────┤
│ Where: Middleware                       │
│ Action: Redirect to allowed route       │
│ Log: "User role denied access to route" │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ERROR: Invalid workspace_id             │
├─────────────────────────────────────────┤
│ Where: Middleware validation            │
│ Action: Redirect to /unauthorized       │
│ Log: "Invalid workspace_id for role"    │
└─────────────────────────────────────────┘
```

---

**For code implementation details, see**: [ROLE_BASED_ROUTING_COMPLETE.md](ROLE_BASED_ROUTING_COMPLETE.md)
