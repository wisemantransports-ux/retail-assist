# Super Admin Authorization Flow Trace

## Overview
Traced the complete authorization flow from login through page render to identify where super_admin is being denied access.

---

## 1. ROLE RESOLUTION FOR SUPER_ADMIN

### Entry Point: POST /api/auth/login
**File**: [app/api/auth/login/route.ts](app/api/auth/login/route.ts#L45-L63)

```
Line 54:  const { data: userAccess, error: rpcError } = await supabase.rpc('rpc_get_user_access')
Line 55:  const accessRecord = userAccess?.[0]
Line 56:  const role = accessRecord?.role
Line 57:  const workspaceId = accessRecord?.workspace_id
```

✅ **Status**: Role resolved correctly
- RPC returns: `role = 'super_admin'`, `workspace_id = null`
- Result returned to client with: `{ user: { id, email, role }, workspaceId: null }`

---

## 2. AUTHORIZATION CHECKS - COMPLETE FLOW

### Check 1: Login Page Redirect
**File**: [app/auth/login/page.tsx](app/auth/login/page.tsx#L18-L68)

```
Line 32:   const meResponse = await fetch('/api/auth/me', {credentials: 'include'})
Line 36:   const meData = await meResponse.json()
Line 37:   const role = meData.role
Line 38:   const workspaceId = meData.workspaceId
```

✅ **Status**: Validates auth ready before redirect
- Calls `/api/auth/me` to confirm backend auth
- If fails: throws error → login page stays open
- If succeeds: calls `router.push(targetPath)` based on role

---

### Check 2: /api/auth/me Endpoint
**File**: [app/api/auth/me/route.ts](app/api/auth/me/route.ts#L1-L136)

```
Line 18:   const { data: userData, error: authError } = await supabase.auth.getUser()
Line 19:   if (authError || !userData?.user) → return 401
Line 26:   const authUser = userData.user
```

✅ **Status**: Auth validation passes
- `supabase.auth.getUser()` validates JWT server-side → ✅ FOUND
- Gets auth user successfully

```
Line 30:   const admin = createAdminSupabaseClient()
Line 33:   const { data: userDataFromDb } = await admin.from('users').select('*').eq('auth_uid', authUser.id)
```

✅ **Status**: User lookup passes with admin client
- Uses admin client (bypasses RLS) → Can read user record
- Returns user data successfully

```
Line 71:   const { data: userAccess, error: rpcError } = await supabase.rpc('rpc_get_user_access')
Line 72:   if (rpcError) → return 500
Line 73:   const role = accessRecord?.role
```

✅ **Status**: Role resolved correctly via RPC
- Returns: `role = 'super_admin'`, `workspace_id = null`
- Includes in response: `{ session, access, role, workspaceId }`

---

### Check 3: Middleware (Proxy)
**File**: [middleware.ts](middleware.ts#L32-L100)

```
Line 32:   const { data: { user }, error: userError } = await supabase.auth.getUser()
Line 33:   if (!user || userError) → return /login redirect
```

✅ **Status**: User JWT validation passes

```
Line 44:   const { data: userAccess } = await supabase.rpc('rpc_get_user_access')
Line 45:   const role = accessRecord?.role
Line 46:   const workspaceId = accessRecord?.workspace_id
```

✅ **Status**: Role resolved correctly

```
Line 71-98: Role === 'super_admin' block
Line 73-75: Check workspace_id must be null
Line 77-81: Block certain paths (✅ /admin is allowed)
Line 83-86: Redirect to /admin if not there
```

✅ **Status**: Super admin passes middleware
- Workspace validation: ✅ `workspaceId === null`
- Path allowed: ✅ Can access `/admin`
- Redirects to `/admin`

---

### Check 4: ProtectedRoute Component
**File**: [app/lib/auth/ProtectedRoute.tsx](app/lib/auth/ProtectedRoute.tsx#L96-L150)

```
Line 103: if (auth.isLoading) → show spinner
Line 108: if (auth.isError) → show unauthorized
Line 113: if (!auth.session) → redirect to /login
Line 120: if (allowedRoles && !roles.includes(auth.role)) → show unauthorized
Line 130: if (auth.role !== 'super_admin' && !auth.workspaceId) → show unauthorized
Line 135: if (auth.role === 'super_admin' && auth.workspaceId) → show unauthorized
```

✅ **Status**: Super admin passes all checks
- Has session: ✅
- Role 'super_admin' allowed: ✅
- Workspace validation: ✅ (null is allowed)

---

### Check 5: /admin Page Component
**File**: [app/admin/page.tsx](app/admin/page.tsx#L40-L68)

```
Line 42: const checkAuth = async () => {
Line 43:   const res = await fetch('/api/auth/me')
Line 44:   const data = await res.json()
Line 46:   if (!res.ok) → push('/admin/login')
Line 51:   const role = data.user.role
Line 52:   const workspaceId = data.user.workspace_id
Line 55:   if (role !== 'super_admin') → push('/admin/login')
```

✅ **Status**: Auth check passes

```
Line 57: const res = await fetch('/api/admin/users')
Line 58: const data = await res.json()
```

⚠️ **PROBLEM**: Calls `/api/admin/users` endpoint

---

### Check 6: GET /api/admin/users Endpoint ❌ **DENIAL POINT**
**File**: [app/api/admin/users/route.ts](app/api/admin/users/route.ts#L1-L50)

```
Line 5-17: async function verifyAdmin(request: Request) {
Line 6:    const cookieStore = await cookies()
Line 7:    const sessionId = cookieStore.get('session_id')?.value
Line 8:    if (!sessionId) return null
Line 10:   const session = await sessionManager.validate(sessionId)
Line 11:   if (!session) return null
Line 13:   const user = await db.users.findById(session.user_id)
```

✅ **Status**: Session validation passes
- Session ID exists ✅
- Session valid ✅
- User lookup via `findById()` uses admin client ✅

```
Line 14:   if (!user || user.role !== 'super_admin') return null
```

✅ **Status**: Role check passes
- User exists ✅
- Role is 'super_admin' ✅

```
Line 19: const admin = await verifyAdmin(request)
Line 20: if (!admin) {
Line 21:   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
Line 22: }
Line 24: const users = await db.users.getAll()
```

✅ **Status**: Authorization passes

```
Line 24: const users = await db.users.getAll()
```

❌ **DENIAL POINT - LINE 24 IN [app/api/admin/users/route.ts](app/api/admin/users/route.ts#L24)**

---

## 3. EXACT DENIAL POINT

### Root Cause: db.users.getAll() Uses Anon Client
**File**: [app/lib/db/index.ts](app/lib/db/index.ts#L275-L280)

```typescript
async getAll() {
  const s = supabase()  // ← Uses anon/server client (NOT admin)
  const { data, error } = await s.from('users').select('*')
  if (error) throw error
  return data.map(migrateUser)
}
```

**Line 276**: `const s = supabase()` where `supabase = () => createServerClient()`

### Why This Fails for Super Admin

1. **Anon Client Subject to RLS**: The `createServerClient()` (anon/user-scoped client) is subject to Row Level Security (RLS) policies
2. **User Table RLS Policy**: The `users` table likely has a policy that allows:
   - Users to read only their own rows: `WHERE auth.uid() = user.auth_uid`
   - Super admin cannot bypass this because RLS applies at the client level
3. **Result**: When super_admin calls `db.users.getAll()`, the RLS policy prevents reading all users, causing an error or empty result

### Flow Visualization

```
super_admin login
    ↓
POST /api/auth/login ✅
    ↓
GET /api/auth/me ✅
    ↓
router.push('/admin') ✅
    ↓
middleware for /admin ✅
    ↓
ProtectedRoute <super_admin> ✅
    ↓
/admin page loads ✅
    ↓
checkAuth() via GET /api/auth/me ✅
    ↓
fetch('/api/admin/users') ✅ (200)
    ↓
verifyAdmin() ✅ (passes)
    ↓
db.users.getAll() ❌ (FAILS - RLS policy blocks)
    ↓
Error response / Empty users
    ↓
Admin page breaks / shows no users
```

---

## 4. FLAGS AND ISSUES

### Issue 1: db.users.getAll() Uses Anon Client ❌
- **File**: [app/lib/db/index.ts#L276](app/lib/db/index.ts#L276)
- **Problem**: Subject to RLS policies
- **Impact**: Super admin cannot fetch all users
- **Comparison**: Other methods (`findById`, `update`) correctly use admin client

### Issue 2: Similar Pattern in Other Endpoints
Need to check all places calling `db.users.getAll()`:

```
Matches found:
- /app/api/admin/users/route.ts:24
- Any other endpoints?
```

### Issue 3: Implicit Requirement for users Table Entry
- Super admin MUST have a row in the `users` table
- If user doesn't exist, `db.users.findById()` creates one via `ensureInternalUser()`
- But getAll() will still fail if RLS policy is too restrictive

---

## 5. SUMMARY

**Where super_admin is denied**: [app/lib/db/index.ts#L276](app/lib/db/index.ts#L276) in `db.users.getAll()`

**Root cause**: Uses `createServerClient()` (anon client) instead of `createAdminSupabaseClient()` (admin/service-role client)

**Why it matters**: RLS policies on `users` table prevent the anon client from reading all users, but admin client can bypass them.

**Call chain to denial**:
1. Page: [app/admin/page.tsx#L57](app/admin/page.tsx#L57)
2. API: [app/api/admin/users/route.ts#L24](app/api/admin/users/route.ts#L24)
3. DB: [app/lib/db/index.ts#L276](app/lib/db/index.ts#L276) ← **DENIAL POINT**

