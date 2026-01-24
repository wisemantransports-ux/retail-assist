# Login Redirect Issue - Root Cause Analysis

**Problem:** After successful login, both super_admin and admin users are redirected back to `/login` instead of their respective dashboards (`/admin` and `/dashboard`).

**Current Behavior:**
```
1. User logs in → POST /api/auth/login 200
2. Cookies are set: session_id, sb-auth-token
3. Login page should: router.push('/admin') or router.push('/dashboard')
4. ACTUAL: Page shows /login again
```

---

## Root Cause Analysis

### 1. Login API ✅ (WORKING)
- **File**: `app/api/auth/login/route.ts`
- **Status**: Correctly returns role and workspace_id
- **Response**:
```json
{
  "success": true,
  "user": { "id": "...", "email": "...", "role": "super_admin|admin" },
  "workspaceId": null
}
```
- **Cookies Set**: ✅ Both `session_id` and `sb-auth-token`
- **Verification**: Logs show `[LOGIN] Set session_id cookie` → status 200

### 2. Middleware ✅ (WORKING)
- **File**: `middleware.ts`
- **Status**: Correctly validates users and resolves roles
- **Verification**: Logs show after login, middleware sees `hasUser: true` and resolves role
- **Issue**: None detected

### 3. Login Page ⚠️ (POTENTIAL ISSUE)
- **File**: `app/auth/login/page.tsx`
- **Current Logic**:
  1. Fetch `/api/auth/login` with email/password
  2. Parse response → extract `data.user.role`
  3. Call `router.push(targetPath)` to redirect
- **Potential Issues**:
  - Browser might be caching the login page HTML
  - `router.push()` might not be triggering properly
  - Client-side redirect might be happening before cookies are available

### 4. ProtectedRoute ⚠️ (TIMING ISSUE)
- **File**: `app/lib/auth/ProtectedRoute.tsx`
- **Flow**:
  1. Check if loading → show spinner
  2. Check if session exists → redirect to login if not
  3. Check if role allowed → show unauthorized if not
- **Issue**: After `router.push()` from login page, the destination page mounts
  - `ProtectedRoute` is rendered
  - `useAuth()` hook is called
  - `useAuth()` calls `supabase.auth.getSession()`
  - If session not ready → `!auth.session` → redirect to login

### 5. useAuth Hook ⚠️ (SESSION INITIALIZATION)
- **File**: `app/hooks/useAuth.ts`
- **Flow**:
  1. Call `supabase.auth.getSession()`
  2. If no session → return `{ session: null }`
  3. If session exists → call RPC for role
- **Issue**: After fresh login, Supabase SDK might not have read session from cookies yet
  - Browser cookies are set by API response
  - But JavaScript Supabase client might not initialize session immediately
  - Timing issue: client-side redirect happens before session is available

---

## Diagnosis

### What's Happening
1. ✅ Login API succeeds and sets cookies
2. ✅ Middleware validates user on GET requests
3. ❌ Frontend `router.push()` navigates to destination
4. ❌ Page loads, `ProtectedRoute` mounts
5. ❌ `useAuth()` tries to read session via `supabase.auth.getSession()`
6. ❌ Session not ready yet (browser cookies set but SDK not synchronized)
7. ❌ `auth.session === null` → `useEffect` triggers `router.push('/login')`
8. ❌ User sees login page again

### Why It Works In Middleware
- Middleware calls `/api/auth/me`
- This makes a server-side request with cookies in the request object
- Server-side SDK can read cookies directly
- No timing issues

### Why It Fails On Client
- Client `ProtectedRoute` calls `useAuth()`
- `useAuth()` calls `supabase.auth.getSession()`
- This reads from browser storage (localStorage/cookies)
- After fresh login, browser cookies are set but SDK hasn't initialized
- Race condition: SDK reads before cookies are available

---

## Solution

### Option A: Use Session API (RECOMMENDED)
Make the destination page immediately call `/api/auth/me` instead of relying on `supabase.auth.getSession()`.

**Advantage**: Works consistently, server validates session
**Disadvantage**: Extra network request

### Option B: Add Cache Directives
Add `noStore()` to login page to prevent browser caching.

**Advantage**: Simple change
**Disadvantage**: Doesn't fix the root cause

### Option C: Wait For Supabase Session
Add a small delay or retry logic in `useAuth()` to wait for Supabase SDK initialization.

**Advantage**: Minimal code changes
**Disadvantage**: Unreliable, adds latency

### Option D: Store Session In SessionStorage
Store role/workspace_id in sessionStorage after login, check there first.

**Advantage**: Fast, works immediately
**Disadvantage**: Client-side state, less secure

---

## Recommended Fix: Option A + Option B

1. **Fix login page caching** - Add `noStore()` export
2. **Use API-based session** - Make `ProtectedRoute` check `/api/auth/me` first before relying on `supabase.auth.getSession()`

---

## Files To Change

### 1. `app/auth/login/page.tsx`
- Add `export const revalidate = 0;` to prevent caching
- Add `noStore()` import and call

### 2. `app/lib/auth/ProtectedRoute.tsx`
- Add fallback to `/api/auth/me` if `supabase.auth.getSession()` returns null
- This ensures consistent behavior with middleware

### 3. `app/hooks/useAuth.ts`
- Consider adding `/api/auth/me` as primary source instead of secondary

---

## Testing Checklist

- [ ] Super admin logs in → redirected to `/admin` (not login)
- [ ] Admin logs in → redirected to `/dashboard` (not login)
- [ ] Employee logs in → redirected to `/app` (not login)
- [ ] Cookies are properly set after login
- [ ] Browser refresh on dashboard doesn't redirect to login
- [ ] Multiple rapid logins don't cause race conditions

