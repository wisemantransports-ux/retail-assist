# 🔴 AUTH REDIRECT AUDIT - SUPER ADMIN REDIRECT FAILURE

**Audit Date:** January 18, 2026  
**Status:** REDIRECT FAILURE IDENTIFIED - NO CODE CHANGED  
**Scope:** Authentication flow for super_admin role

---

## 📍 Root Cause Identified

**Why super_admin users end up on `/dashboard` instead of `/admin`:**

The super_admin role is **never created during signup**. The signup RPC only creates users with `admin` role (client admins). Super admins must be manually inserted into the database at the platform level.

---

## 🔍 Audit Findings

### 1️⃣ WHERE USER ROLE IS SET DURING SIGNUP

**File:** `app/api/auth/signup/route.ts`  
**Lines:** 55-63

```typescript
const rpcCall: any = supabaseAdmin.rpc('rpc_create_user_profile', {
  p_auth_uid: newUser.id,
  p_business_name: business_name,
  p_email: email,
  p_phone: phone,
  p_full_name: full_name || null,
  p_plan_type: plan_type || 'starter',
  // NOTE: p_is_super_admin parameter is NEVER passed
});
```

**Issue:** The `p_is_super_admin` parameter is **hardcoded as missing**, which defaults to `false`.

### 2️⃣ RPC THAT CREATES THE ROLE

**File:** `supabase/migrations/024_create_rpc_create_user_profile.sql`  
**Function:** `rpc_create_user_profile()`

```sql
CREATE OR REPLACE FUNCTION public.rpc_create_user_profile(
  p_auth_uid uuid,
  p_business_name text,
  p_email text,
  p_full_name text,
  p_phone text,
  p_plan_type text,
  p_is_super_admin boolean DEFAULT false  -- ← DEFAULTS TO FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ...
  INSERT INTO public.admin_access (workspace_id, user_id, role)
  SELECT v_workspace_id, v_user_id,
         CASE WHEN p_is_super_admin THEN 'super_admin' ELSE 'admin' END
         -- ↑ If p_is_super_admin is false (default), role is always 'admin'
  ...
END;
$$;
```

**Logic:**
- Line 56-60: Sets role to either `'super_admin'` or `'admin'` based on `p_is_super_admin` parameter
- Signup route NEVER passes this parameter → defaults to `FALSE`
- Result: **ALL signups create users with `role = 'admin'`** (not super_admin)

### 3️⃣ WHERE USER ROLE IS READ DURING LOGIN

**File:** `app/api/auth/login/route.ts`  
**Lines:** 56-80

```typescript
// Fetch user role and workspace from RPC (returns exactly one row)
const { data: userAccess, error: rpcError } = await supabase.rpc('rpc_get_user_access')
...
const accessRecord = userAccess?.[0]
const role = accessRecord?.role
const workspaceId = accessRecord?.workspace_id

console.log('[LOGIN] Resolved role:', role)  // ← Logs the role from RPC
```

**Result:** The login endpoint **correctly reads and returns the role** from the RPC. If role is `admin`, it correctly returns `admin`.

### 4️⃣ RPC THAT RETURNS THE ROLE

**File:** `supabase/migrations/029_fix_get_user_access.sql`  
**Function:** `rpc_get_user_access()`

```sql
create or replace function public.rpc_get_user_access()
returns table (user_id uuid, workspace_id uuid, role text)
...
as $$
  select r.user_id, r.workspace_id, r.role
  from (
    -- 1️⃣ Super Admin (workspace_id = NULL)
    select ... 'super_admin'::text as role, 1 as priority
    from public.users u
    where u.auth_uid = auth.uid()
      and u.role = 'super_admin'
    union all
    
    -- 2️⃣ Platform Staff 
    select ... 'platform_staff'::text as role, 2 as priority
    ...
    union all
    
    -- 3️⃣ Client Admin (admin_access with non-platform workspace_id)
    select ... 'admin'::text as role, 3 as priority
    from public.admin_access aa
    where u.auth_uid = auth.uid()
      and aa.workspace_id is not null
      and aa.workspace_id != '00000000-0000-0000-0000-000000000001'
    union all
    
    -- 4️⃣ Employee
    select ... 'employee'::text as role, 4 as priority
    ...
  ) r
  order by r.priority limit 1;
$$;
```

**Issue:** Super admin role is only recognized if:
1. User exists in `users` table with `role = 'super_admin'` (line 12-17)
2. Auth UID matches current session
3. They do NOT have an `admin_access` row (which they would if created via signup)

**Problem:** Signup creates users with `admin_access` row, making them `admin`, not `super_admin`.

### 5️⃣ POST-AUTH REDIRECT LOGIC

**File (Signup):** `app/auth/signup/page.tsx`  
**Lines:** 108-136

```typescript
// Fetch role from RPC to determine redirect target
const { data: userAccess } = await supabase.rpc('rpc_get_user_access');
const role = userAccess?.[0]?.role;

let targetPath = '/unauthorized';

if (role === 'super_admin') {
  targetPath = '/admin';
} else if (role === 'admin') {
  targetPath = '/dashboard';  // ← DEFAULT FOR ALL SIGNUPS
} else if (role === 'employee') {
  targetPath = '/employees/dashboard';
}

router.push(targetPath);
```

**File (Login):** `app/auth/login/page.tsx`  
**Lines:** 38-65

```typescript
// Determine redirect target based on role
const role = data.user?.role;

let targetPath = '/unauthorized';

if (role === 'super_admin') {
  targetPath = '/admin';
} else if (role === 'admin') {
  targetPath = '/dashboard';  // ← RECEIVES 'admin' ROLE FROM LOGIN API
} else if (role === 'employee') {
  targetPath = '/employees/dashboard';
}

router.push(targetPath);
```

**Logic Summary:**
- ✅ Code correctly checks role and routes to `/dashboard` for `admin` role
- ✅ Code correctly would route to `/admin` for `super_admin` role
- ❌ **Problem:** Role is ALWAYS `admin` because signup never passes `p_is_super_admin = true`

### 6️⃣ MIDDLEWARE ROUTING

**File:** `middleware.ts`  
**Lines:** 73-92

```typescript
// ===== 1️⃣ SUPER ADMIN ROLE (workspace_id = NULL) =====
if (role === 'super_admin') {
  console.log('[Middleware] Processing super_admin access');
  
  if (workspaceId !== null && workspaceId !== undefined) {
    console.error('[Middleware] Super admin has workspace_id set - unauthorized state');
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }
  
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || 
      pathname === '/employees' || pathname.startsWith('/employees/')) {
    console.warn('[Middleware] Super admin attempted to access protected route:', pathname, 
                 '- redirecting to /admin');
    url.pathname = '/admin';
    return NextResponse.redirect(url);
  }
  
  if (!pathname.startsWith('/admin')) {
    url.pathname = '/admin';
    console.log('[Middleware] Redirecting super_admin to /admin');
    return NextResponse.redirect(url);
  }
}
```

**Middleware Logic:**
- ✅ Middleware **DOES** enforce super_admin → `/admin`
- ✅ Middleware **DOES** enforce `admin` (client) → `/dashboard`
- ✅ Middleware **WOULD** correctly route super admin IF role = 'super_admin'

**But:** Since signup always sets role to `admin`, middleware never sees `super_admin` and doesn't apply the override.

---

## 📊 Flow Diagram - Where Redirect Fails

```
SIGNUP FLOW
═══════════
1. User signs up (Email, password, business_name)
   ↓
2. /api/auth/signup creates auth user
   ↓
3. Calls rpc_create_user_profile(p_auth_uid, ..., p_is_super_admin=NULL)
   ├─ p_is_super_admin defaults to FALSE (migration 024, line 25)
   ├─ Creates admin_access row with role='admin' (NOT 'super_admin')
   └─ User inserted into admin_access with workspace_id = NEW_WORKSPACE
   ↓
4. /app/auth/signup/page.tsx calls rpc_get_user_access()
   ├─ RPC checks: Is user in users table with role='super_admin'? NO
   ├─ RPC checks: Is user in admin_access with platform workspace? NO
   ├─ RPC checks: Is user in admin_access with regular workspace? YES ✓
   └─ RPC returns: role='admin' (not 'super_admin')
   ↓
5. Signup page routes based on role
   ├─ If role === 'super_admin' → /admin (NOT TAKEN)
   └─ Else if role === 'admin' → /dashboard ✓ TAKEN
   ↓
6. User redirected to /dashboard ❌

LOGIN FLOW (Same Issue)
═══════════════════════
1. User logs in (Email, password)
   ↓
2. /api/auth/login signs in with Supabase
   ↓
3. Calls rpc_get_user_access()
   └─ Returns role='admin' (because admin_access row was created during signup)
   ↓
4. Returns { role: 'admin', ... } to client
   ↓
5. Login page routes based on role
   └─ Else if role === 'admin' → /dashboard ✓ TAKEN
   ↓
6. User redirected to /dashboard ❌

MIDDLEWARE (Doesn't Override Because Role is Wrong)
═════════════════════════════════════════════════════
1. User visits any route after login
   ↓
2. Middleware calls rpc_get_user_access()
   └─ Returns role='admin' (not 'super_admin')
   ↓
3. Middleware routing logic
   ├─ if (role === 'super_admin') → NO, skip to next role
   └─ if (role === 'admin') → YES ✓
     └─ Enforce /dashboard access
   ↓
4. Middleware allows /dashboard, doesn't override to /admin ❌
```

---

## 🎯 EXACT FAILURE POINTS

| Component | File | Issue | Impact |
|-----------|------|-------|--------|
| **Signup RPC** | `024_create_rpc_create_user_profile.sql` | `p_is_super_admin` defaults to `FALSE` | All signups get `admin` role |
| **Signup API** | `app/api/auth/signup/route.ts` | Never passes `p_is_super_admin` parameter | Role never set to `super_admin` |
| **Signup Page** | `app/auth/signup/page.tsx` | Receives `role='admin'` from RPC | Routes to `/dashboard` ✓ (correct for role received) |
| **Login API** | `app/api/auth/login/route.ts` | Returns correct role from RPC | Routes to `/dashboard` ✓ (correct for role received) |
| **Login Page** | `app/auth/login/page.tsx` | Routes based on role | Goes to `/dashboard` ✓ (correct for role received) |
| **RPC** | `029_fix_get_user_access.sql` | Only returns `super_admin` if user in `users` table with that role | Never returns `super_admin` for signup users |
| **Middleware** | `middleware.ts` | Routes super_admin to `/admin` | Doesn't apply because role is `admin` |

---

## 📝 SUMMARY: Why Super Admin Ends Up on /dashboard

1. **Signup never creates super_admin role**
   - `rpc_create_user_profile()` called without `p_is_super_admin = true`
   - Parameter defaults to `false`
   - Result: User gets `admin` role in `admin_access` table

2. **RPC returns `admin` role for signup users**
   - `rpc_get_user_access()` checks `users` table for `role='super_admin'` (doesn't exist for signup users)
   - Falls through to `admin_access` check
   - Signup users have `admin_access` row with `role='admin'`
   - Result: RPC returns `role='admin'`

3. **Client-side redirect uses returned role**
   - Signup page checks: if `role === 'admin'` → `/dashboard` ✓
   - Login page checks: if `role === 'admin'` → `/dashboard` ✓
   - Result: User routed to `/dashboard` (correct for the role they actually have)

4. **Middleware enforces the wrong role**
   - Middleware receives `role='admin'` from RPC
   - Enforces `/dashboard` for that role
   - Never routes to `/admin` because role is never `super_admin`

---

## 🔑 KEY INSIGHT

**The redirect is working correctly - but for the wrong role.**

A user who signs up gets role = `admin` (client admin), and all three redirect systems correctly route them to `/dashboard`. To create a super_admin, you need to:

1. Manually insert into `users` table with `role = 'super_admin'` and `auth_uid = <their_auth_id>`, OR
2. Modify signup API to pass `p_is_super_admin = true` (currently never happens), OR
3. Manually insert into `admin_access` with `workspace_id = NULL` and `role = 'super_admin'`

---

## ✅ VERIFICATION COMPLETE

- ✅ Signup role set at: `app/api/auth/signup/route.ts` (lines 55-63)
- ✅ RPC creates role: `supabase/migrations/024_create_rpc_create_user_profile.sql`
- ✅ RPC returns role: `supabase/migrations/029_fix_get_user_access.sql`
- ✅ Login reads role: `app/api/auth/login/route.ts` (lines 56-80)
- ✅ Signup redirects on role: `app/auth/signup/page.tsx` (lines 108-136)
- ✅ Login redirects on role: `app/auth/login/page.tsx` (lines 38-65)
- ✅ Middleware enforces on role: `middleware.ts` (lines 73-92)
- ✅ Role is loaded and used (not ignored)
- ✅ Middleware does NOT override routing (receives wrong role)

---

## 🔴 REDIRECT FAILURE IDENTIFIED — NO CODE CHANGED

**Root Cause:** Super admin role is never created during signup.  
**Affected Users:** Any user signing up through `/auth/signup`  
**Actual Behavior:** Users get `admin` role → routed to `/dashboard`  
**Expected Behavior:** Super admin users should have `role = 'super_admin'` → routed to `/admin`

**To fix:** Modify signup flow to properly set super_admin role (requires domain logic for determining who should be super_admin during signup).
