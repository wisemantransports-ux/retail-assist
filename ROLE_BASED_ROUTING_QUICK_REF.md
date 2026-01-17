# Role-Based Routing Quick Reference

## 4 Roles - 4 Routes

```
┌─────────────────────────────────────────────────────────────────┐
│                     ROLE-BASED ACCESS MATRIX                    │
├──────────────────┬──────────────┬──────────────┬────────────────┤
│ Role             │ workspace_id │ Primary Route│ Blocked Routes │
├──────────────────┼──────────────┼──────────────┼────────────────┤
│ super_admin      │ NULL         │ /admin       │ /dashboard     │
│                  │              │              │ /employees/*   │
│                  │              │              │ /admin/support │
├──────────────────┼──────────────┼──────────────┼────────────────┤
│ platform_staff   │ PLATFORM_WS* │ /admin/      │ /admin         │
│                  │              │ support      │ /dashboard     │
│                  │              │              │ /employees/*   │
├──────────────────┼──────────────┼──────────────┼────────────────┤
│ admin (client)   │ client_ws_id │ /dashboard   │ /admin         │
│                  │              │              │ /admin/support │
│                  │              │              │ /employees/*   │
├──────────────────┼──────────────┼──────────────┼────────────────┤
│ employee         │ assigned_ws  │ /employees/  │ /admin         │
│                  │              │ dashboard    │ /admin/support │
│                  │              │              │ /dashboard     │
└──────────────────┴──────────────┴──────────────┴────────────────┘

* PLATFORM_WS = 00000000-0000-0000-0000-000000000001
```

## Role Detection Flow

```
RPC: rpc_get_user_access()
│
├─ Check users table: role = 'super_admin'?
│  └─ YES: return (user_id, NULL, 'super_admin') ← STOP
│
├─ Check admin_access: workspace_id = PLATFORM_WORKSPACE_ID?
│  └─ YES: return (user_id, PLATFORM_WORKSPACE_ID, 'platform_staff') ← STOP
│
├─ Check admin_access: workspace_id IS NOT NULL?
│  └─ YES: return (user_id, workspace_id, 'admin') ← STOP
│
├─ Check employees: workspace_id IS NOT NULL?
│  └─ YES: return (user_id, workspace_id, 'employee') ← STOP
│
└─ NO MATCH: return empty (no role)
```

## Login Flow

```
1. POST /api/auth/login { email, password }
   │
   ├─ Validate with Supabase Auth
   ├─ Ensure internal user row exists
   ├─ Call rpc_get_user_access() → get role + workspace_id
   └─ Return { role, workspace_id } to client

2. Client-side redirect based on role:
   │
   ├─ role='super_admin'    → router.push('/admin')
   ├─ role='platform_staff' → router.push('/admin/support')
   ├─ role='admin'          → router.push('/dashboard')
   ├─ role='employee'       → router.push('/employees/dashboard')
   └─ no role              → router.push('/unauthorized')

3. Middleware validates each request:
   │
   ├─ Check session exists
   ├─ Call rpc_get_user_access()
   ├─ Validate role-route match
   ├─ Grant access or redirect to /unauthorized
```

## Code Locations

### RPC Function (Role Detection)
📍 [supabase/migrations/029_fix_get_user_access.sql](../supabase/migrations/029_fix_get_user_access.sql)

### Middleware (Edge Routing)
📍 [middleware.ts](../middleware.ts)

### Server Auth Endpoints
📍 [app/api/auth/login/route.ts](../app/api/auth/login/route.ts)
📍 [app/api/auth/me/route.ts](../app/api/auth/me/route.ts)

### Client Login Pages
📍 [app/auth/login/page.tsx](../app/auth/login/page.tsx)
📍 [app/auth/signup/page.tsx](../app/auth/signup/page.tsx)

## Constants

| Constant | Value |
|----------|-------|
| PLATFORM_WORKSPACE_ID | `00000000-0000-0000-0000-000000000001` |

## Key Invariants

### Super Admin
- ✅ `workspace_id = NULL` always
- ✅ Accesses `/admin` only
- ✅ Never client admin
- ✅ Never has workspace

### Platform Staff  
- ✅ `workspace_id = PLATFORM_WORKSPACE_ID` always
- ✅ Accesses `/admin/support` only
- ✅ Internal Retail Assist employees only

### Client Admin
- ✅ `workspace_id = non-null, non-platform`
- ✅ Accesses `/dashboard` only
- ✅ One workspace per admin
- ✅ Client business owner

### Employee
- ✅ `workspace_id = non-null`
- ✅ Accesses `/employees/dashboard` only
- ✅ One workspace per employee
- ✅ Client business staff

## Testing Quick Check

```bash
# Super Admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"super@admin.com","password":"xxx"}'
# Expected: { "user": { "role": "super_admin" }, "workspaceId": null }

# Platform Staff
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"support@retail-assist.com","password":"xxx"}'
# Expected: { "user": { "role": "platform_staff" }, "workspaceId": "00000000-0000-0000-0000-000000000001" }

# Client Admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@client.com","password":"xxx"}'
# Expected: { "user": { "role": "admin" }, "workspaceId": "<client-workspace-uuid>" }

# Employee
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@client.com","password":"xxx"}'
# Expected: { "user": { "role": "employee" }, "workspaceId": "<client-workspace-uuid>" }
```

## Middleware Route Protection

```typescript
// Protected Routes (in middleware config)
matcher: [
  '/admin',
  '/admin/:path*',           // Except /admin/support for platform_staff
  '/dashboard',
  '/dashboard/:path*',
  '/employees',
  '/employees/:path*'
]

// Middleware Logic
if (role === 'super_admin') {
  // Only /admin/* allowed
  if (pathname.startsWith('/dashboard') || 
      pathname.startsWith('/employees') ||
      pathname.startsWith('/admin/support')) {
    redirect to /admin
  }
}

if (role === 'platform_staff') {
  // Only /admin/support/* allowed
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/support') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/employees')) {
    redirect to /admin/support
  }
}

if (role === 'admin') {
  // Only /dashboard/* allowed
  if (pathname.startsWith('/admin') ||
      pathname.startsWith('/employees')) {
    redirect to /dashboard
  }
}

if (role === 'employee') {
  // Only /employees/dashboard/* allowed
  if (pathname.startsWith('/admin') ||
      pathname.startsWith('/dashboard')) {
    redirect to /employees/dashboard
  }
}
```

## Database Tables Involved

| Table | Usage |
|-------|-------|
| `users` | `role='super_admin'` for super admin detection |
| `admin_access` | `workspace_id` for platform_staff & admin roles |
| `employees` | `workspace_id` for employee role |
| `workspaces` | Referenced by workspace_id values |

## Common Issues & Solutions

### Issue: User has no role
**Cause**: User not in any role table (users, admin_access, employees)
**Solution**: Create appropriate entry for user's role

### Issue: User logged in but redirects to /unauthorized
**Cause**: Middleware detected invalid role/workspace_id combination
**Solution**: Run `SELECT * FROM rpc_get_user_access()` while logged in as that user

### Issue: Super admin getting redirected to /dashboard
**Cause**: Super admin has workspace_id != NULL
**Solution**: Verify user has `role='super_admin'` in users table, NOT in admin_access

### Issue: Client admin can't access /dashboard
**Cause**: Missing or incorrect workspace_id
**Solution**: Verify admin_access row exists with correct workspace_id (non-platform)

---

**For detailed information, see**: [ROLE_BASED_ROUTING_COMPLETE.md](ROLE_BASED_ROUTING_COMPLETE.md)
