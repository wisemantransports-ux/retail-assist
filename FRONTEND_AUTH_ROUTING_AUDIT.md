# Frontend Role-Based Routing System - Security Audit Report

**Date:** January 23, 2026  
**Status:** ⚠️ CRITICAL ISSUES FOUND

---

## Executive Summary

The frontend role-based routing system has **multiple critical security issues** that could allow unauthorized access:

1. ❌ **Duplicate ProtectedRoute implementations** with inconsistent behavior
2. ❌ **Unprotected routes** exposed to unauthenticated users
3. ❌ **Invalid role references** (`client_admin` doesn't exist in system)
4. ❌ **Workspace ID bypass vulnerability** - hardcoded checks that don't prevent access
5. ⚠️ **Inconsistent hook usage** across pages
6. ⚠️ **Dead code branches** that reference non-existent roles

---

## 1. Routes Protected with ProtectedRoute or useRouteGuard

### Protected Routes

| Route | Protection Type | Allowed Roles | File |
|-------|-----------------|----------------|------|
| `/platform-admin` | Layout + useRouteGuard | `super_admin` | [app/platform-admin/layout.tsx](app/platform-admin/layout.tsx#L22) + [app/platform-admin/page.tsx](app/platform-admin/page.tsx#L19) |
| `/platform-admin/*` | Layout | `super_admin` | [app/platform-admin/layout.tsx](app/platform-admin/layout.tsx#L22) |
| `/app` | Layout + useRouteGuard | `employee` | [app/app/layout.tsx](app/app/layout.tsx#L24) + [app/app/page.tsx](app/app/page.tsx#L19) |
| `/app/*` | Layout | `employee` | [app/app/layout.tsx](app/app/layout.tsx#L24) |
| `/dashboard` | Layout | `admin`, `super_admin` | [app/dashboard/layout.tsx](app/dashboard/layout.tsx#L21) |
| `/dashboard/*` | Layout | `admin`, `super_admin` | [app/dashboard/layout.tsx](app/dashboard/layout.tsx#L21) |
| `/employees` | Layout | `employee` | [app/employees/layout.tsx](app/employees/layout.tsx#L25) |
| `/employees/*` | Layout | `employee` | [app/employees/layout.tsx](app/employees/layout.tsx#L25) |

### Unprotected Routes (NOT guarded)

| Route | Purpose | Issue |
|-------|---------|-------|
| `/` (root) | Marketing page | ✅ OK - public page |
| `/auth/login` | Login page | ✅ OK - needs to be public |
| `/auth/signup` | Signup page | ✅ OK - needs to be public |
| `/pricing` | Pricing page | ✅ OK - public marketing |
| `/test` | Debug endpoint | ❌ **VULNERABLE** - Server component queries Supabase directly |
| `/billing/success` | Payment success page | ⚠️ **SUSPICIOUS** - No auth check, but publicly accessible |
| `/invite` | Employee invite acceptance | ✅ OK - invitation link (needs token) |

---

## 2. Critical Issues Found

### 🔴 ISSUE #1: Duplicate ProtectedRoute Implementations

**Location:** Two different implementations exist:

1. **Main Implementation** (CORRECT):
   - [app/lib/auth/ProtectedRoute.tsx](app/lib/auth/ProtectedRoute.tsx) - uses `useAuthContext()` from AuthProvider
   - Validates through context (centralized auth state)
   - Re-confirms auth on every render

2. **Alternative Implementation** (VULNERABLE):
   - [app/components/ProtectedRoute.tsx](app/components/ProtectedRoute.tsx) - calls `/api/auth/me` directly
   - Doesn't use AuthProvider context
   - Makes HTTP request on every mount

**Used by:**
- [app/dashboard/client/PlatformStaffPageWrapper.tsx](app/dashboard/client/PlatformStaffPageWrapper.tsx#L3) - uses the VULNERABLE version

**Risk:** The alternative implementation bypasses the centralized AuthProvider and directly calls an API endpoint. If that endpoint is misconfigured or has different validation logic, it could allow unauthorized access.

**Example of inconsistency:**
```tsx
// MAIN ProtectedRoute.tsx - uses context
const auth = useAuthContext();
if (!roles.includes(auth.role || '')) { /* deny */ }

// COMPONENTS ProtectedRoute.tsx - makes API call
const { role } = await fetch('/api/auth/me');
if (!allowedRoles.includes(role)) { /* deny */ }
```

**Verdict:** ❌ CRITICAL - Both implementations should not exist. Use only the centralized one.

---

### 🔴 ISSUE #2: Invalid Role References (Dead Code)

**Location:** [app/dashboard/client/PlatformStaffPageWrapper.tsx](app/dashboard/client/PlatformStaffPageWrapper.tsx#L8)

```tsx
<ProtectedRoute allowedRoles={["super_admin", "client_admin"]} redirectTo="/dashboard">
```

**Problem:**
- System has roles: `super_admin`, `admin`, `employee`, `platform_staff`
- This code references `client_admin` which **does not exist**
- This is a dead code branch - will never grant access

**Verdict:** ❌ MEDIUM - Won't cause unauthorized access but indicates stale code that should be removed.

---

### 🔴 ISSUE #3: Workspace ID Validation Bypass

**Location:** [app/dashboard/messages/page.tsx](app/dashboard/messages/page.tsx#L68)

```tsx
// ===== WORKSPACE VALIDATION =====
// Admin must have a workspace_id (not NULL, not platform workspace)
if (!user.workspace_id || user.workspace_id === '00000000-0000-0000-0000-000000000001') {
  setError('Invalid workspace assignment');
  return;
}
```

**Problems:**
1. This check is in **client-side code** - easily bypassed by disabling JavaScript
2. Uses hardcoded platform workspace ID `00000000-0000-0000-0000-000000000001`
3. Only validates **after** fetching `/api/auth/me` - API should enforce this
4. Shows error to user but continues to render component

**Similar issue in:** [app/employees/messages/page.tsx](app/employees/messages/page.tsx#L67)

**Verdict:** ❌ CRITICAL - Client-side validation can be bypassed. Workspace scoping MUST be enforced server-side in API layer.

---

### 🔴 ISSUE #4: Inbox Page Workspace ID Confusion

**Location:** [app/dashboard/inbox/page.tsx](app/dashboard/inbox/page.tsx#L16-L30)

```tsx
async function fetchWorkspaceId() {
  const agentsRes = await fetch('/api/agents');
  if (agentsRes.ok) {
    const authRes = await fetch('/api/auth/me');
    if (authRes.ok) {
      const authData = await authRes.json();
      // Use user ID as workspace ID for simplicity (assuming 1:1 relationship)
      setWorkspaceId(authData.user.id);  // ❌ WRONG!
    }
  }
}
```

**Problem:**
- Uses `user.id` (auth user ID) as `workspace_id`
- This is **NOT a workspace ID** - these are different UUIDs
- Breaks workspace scoping - confuses user ID with workspace ID
- Could allow cross-workspace data access if APIs don't validate properly

**Verdict:** ❌ CRITICAL - Uses wrong identifier for workspace scoping.

---

### 🔴 ISSUE #5: Missing Admin Layout Protection

**Location:** [app/admin/layout.tsx](app/admin/layout.tsx)

```tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Topbar />
      <main className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
```

**Problem:**
- NO `ProtectedRoute` wrapper
- NO role checking
- Middleware protects the routes, but layout doesn't provide client-side confirmation
- If middleware is bypassed (e.g., old cached page), layout won't protect

**Verdict:** ⚠️ HIGH - Should add ProtectedRoute wrapper for defense in depth.

---

### 🟡 ISSUE #6: Test Page Exposes Supabase Schema

**Location:** [app/test/page.tsx](app/test/page.tsx)

```tsx
export default async function Page() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('test').select('*').maybeSingle();
  return <pre>{JSON.stringify({ data, error }, null, 2)}</pre>;
}
```

**Problem:**
- Server component directly queries Supabase
- No authentication check
- Exposes database schema and errors
- Accessible at `/test`

**Verdict:** ⚠️ MEDIUM - Remove in production or add authentication check.

---

### 🟡 ISSUE #7: Hardcoded PLATFORM_WORKSPACE_ID Duplication

**Location:** Multiple files:
- [app/auth/login/page.tsx](app/auth/login/page.tsx#L9)
- [middleware.ts](middleware.ts#L5)

```tsx
const PLATFORM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
```

**Problem:**
- Same UUID hardcoded in multiple places
- If platform workspace ID needs to change, must update multiple files
- No single source of truth

**Verdict:** ⚠️ LOW - Not a security issue, but maintainability problem.

---

### 🟡 ISSUE #8: Double Role Checking - Client-Side and API

**Locations:**
- [app/admin/page.tsx](app/admin/page.tsx#L61) - checks `role !== 'super_admin'`
- [app/dashboard/messages/page.tsx](app/dashboard/messages/page.tsx#L61-64) - checks `role !== 'admin'`
- [app/employees/messages/page.tsx](app/employees/messages/page.tsx) - similar checks

**Problem:**
- Role is checked in client components but also by middleware
- If middleware validates correctly, client-side check is redundant
- If client-side check fails, user already past middleware (suggests middleware failure)

**Verdict:** ⚠️ LOW - Redundant but not necessarily wrong (defense in depth). However, inconsistently applied.

---

## 3. Hook Analysis

### ✅ `useRouteGuard(role)` - CORRECT

Used in:
- [app/platform-admin/page.tsx](app/platform-admin/page.tsx#L19) - `useRouteGuard('super_admin')`
- [app/app/page.tsx](app/app/page.tsx#L19) - `useRouteGuard('employee')`

**Implementation:** [app/lib/auth/roleBasedRouting.ts](app/lib/auth/roleBasedRouting.ts#L118-150)

**Validation:**
- ✅ Checks `auth.isLoading` before validating
- ✅ Redirects to `/login` if no session
- ✅ Redirects to appropriate home route if role mismatch
- ✅ Used in `'use client'` components only
- ✅ Uses `useRouter()` from client-side

**Verdict:** ✅ SECURE

### ⚠️ `useCanAccess(role)` - NOT USED

**Location:** [app/lib/auth/roleBasedRouting.ts](app/lib/auth/roleBasedRouting.ts#L166-175)

```tsx
export function useCanAccess(requiredRole: string | string[]): boolean {
  const auth = useAuthContext();
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return requiredRoles.includes(auth.role || '');
}
```

**Status:** ✅ Implemented correctly but **not used anywhere in codebase**

**Verdict:** ✅ CORRECT (if used), but appears to be dead code.

### ⚠️ `useHasRole(role)` - NOT USED

**Location:** [app/hooks/useAuth.ts](app/hooks/useAuth.ts#L200-204)

```tsx
export function useHasRole(role: string | string[]): boolean {
  const auth = useAuth();
  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(auth.role || '');
}
```

**Status:** ✅ Implemented correctly but **not used anywhere in codebase**

**Verdict:** ✅ CORRECT (if used), but appears to be dead code.

### ✅ `useRoleBasedRedirect()` - NOT USED

**Location:** [app/lib/auth/roleBasedRouting.ts](app/lib/auth/roleBasedRouting.ts#L46-75)

**Status:** ✅ Implemented correctly but **not actively used** (middleware handles initial redirect instead)

**Verdict:** ✅ CORRECT implementation, but middleware redundancy makes it unnecessary.

---

## 4. Workspace ID Usage Analysis

### Correct Usage
- ✅ [app/platform-admin/page.tsx](app/platform-admin/page.tsx#L63) - displays `auth.workspaceId` or shows "None (Super Admin)"
- ✅ [app/app/page.tsx](app/app/page.tsx#L63) - displays `auth.workspaceId`
- ✅ [middleware.ts](middleware.ts#L62-68) - validates workspace_id via RPC

### Incorrect/Risky Usage
- ❌ [app/dashboard/inbox/page.tsx](app/dashboard/inbox/page.tsx#L29) - uses `authData.user.id` as workspace ID
- ❌ [app/dashboard/messages/page.tsx](app/dashboard/messages/page.tsx#L68) - client-side hardcoded check
- ❌ [app/employees/messages/page.tsx](app/employees/messages/page.tsx#L67) - client-side hardcoded check

### Not Validated
- ⚠️ [app/dashboard/[workspaceId]](/app/dashboard/[workspaceId]) - path parameter `workspaceId` is used directly in URLs without verification that user owns this workspace

---

## 5. Access Leak Analysis

### Potential Bypass Vectors

#### Vector 1: Middleware Skip via Direct Page Load
**Risk:** LOW - Mitigated by middleware

If user navigates to `/admin/*` directly:
1. Middleware intercepts request
2. Middleware validates role and redirects
3. User cannot reach page without valid role

**Status:** ✅ Protected

#### Vector 2: Client-Side Bypass via DevTools
**Risk:** MEDIUM - Client-side workspace validation can be bypassed

File: [app/dashboard/messages/page.tsx](app/dashboard/messages/page.tsx#L68)

Attack:
1. User is admin but for workspace "ABC"
2. User opens DevTools and modifies `workspace_id` in state
3. Component re-renders with modified workspace
4. Data from wrong workspace could be accessed

**Status:** ❌ NOT PROTECTED - API must validate

#### Vector 3: Alternative ProtectedRoute Bypass
**Risk:** MEDIUM - If `/api/auth/me` is misconfigured

File: [app/components/ProtectedRoute.tsx](app/components/ProtectedRoute.tsx)

Attack:
1. Call `/api/auth/me` endpoint
2. If endpoint has bug and returns wrong role
3. Alternative ProtectedRoute would allow access

**Status:** ❌ DEPENDS ON API - Centralized context would prevent this

#### Vector 4: Workspace ID Confusion
**Risk:** CRITICAL - Cross-workspace data access

File: [app/dashboard/inbox/page.tsx](app/dashboard/inbox/page.tsx#L29)

Attack:
1. User is admin for workspace "ABC"
2. App stores `workspaceId = user.id` (wrong!)
3. User could craft URLs with different workspace IDs in path
4. If API doesn't validate workspace membership, could access data from other workspaces

**Status:** ❌ CRITICAL - Must be fixed

#### Vector 5: Dynamic Route Parameters
**Risk:** MEDIUM - Route parameters not validated against user's workspace

File: [app/dashboard/[workspaceId]/billing/page.tsx](app/dashboard/[workspaceId]/billing/page.tsx)

```tsx
const workspaceId = params.workspaceId as string;
// No verification that user owns this workspace!
```

Attack:
1. Admin for workspace "ABC" logs in
2. Manually changes URL to `/dashboard/XYZ/billing`
3. If API doesn't check workspace membership, could access billing for workspace "XYZ"

**Status:** ⚠️ DEPENDS ON API - Must be validated server-side

---

## 6. Summary Table: Route Protection Status

| Route | Middleware | Layout | Page Guard | Workspace Check | Status |
|-------|-----------|--------|-----------|-----------------|--------|
| `/platform-admin` | ✅ | ✅ | ✅ | N/A | ✅ SECURE |
| `/app` | ✅ | ✅ | ✅ | ✅ via context | ✅ SECURE |
| `/dashboard` | ✅ | ✅ | ❌ | ⚠️ client-side only | ⚠️ RISKY |
| `/admin` | ✅ | ❌ | ❌ | N/A | ⚠️ NO LAYOUT GUARD |
| `/test` | ❌ | ❌ | ❌ | ❌ | ❌ VULNERABLE |

---

## 7. Recommendations

### 🔴 CRITICAL (Fix Immediately)

1. **Remove duplicate ProtectedRoute**
   - Delete [app/components/ProtectedRoute.tsx](app/components/ProtectedRoute.tsx)
   - Update [app/dashboard/client/PlatformStaffPageWrapper.tsx](app/dashboard/client/PlatformStaffPageWrapper.tsx) to import from `@/lib/auth/ProtectedRoute`

2. **Fix workspace ID confusion**
   - [app/dashboard/inbox/page.tsx](app/dashboard/inbox/page.tsx#L29) should use `authData.user.workspace_id`, not `authData.user.id`
   - Verify this is the admin's workspace_id from RPC, not user ID

3. **Remove client-side workspace validation**
   - [app/dashboard/messages/page.tsx](app/dashboard/messages/page.tsx#L68) - remove hardcoded platform workspace check
   - Let server-side API enforce workspace scoping
   - Client can show error if API rejects, but don't pre-validate

4. **Add server-side workspace validation**
   - Ensure all APIs validate `user.workspace_id` matches request
   - Example: `/api/messages` should verify user's workspace before returning data

---

### 🟡 HIGH PRIORITY (Fix Soon)

5. **Add ProtectedRoute to admin layout**
   - [app/admin/layout.tsx](app/admin/layout.tsx) should wrap children with `<ProtectedRoute allowedRoles="super_admin">`
   - Provides defense-in-depth if middleware is bypassed

6. **Validate route parameters against user's workspace**
   - [app/dashboard/[workspaceId]](app/dashboard/[workspaceId]) routes should verify user owns workspace
   - Add check: `if (params.workspaceId !== auth.workspaceId) redirect('/unauthorized')`

7. **Remove dead role references**
   - [app/dashboard/client/PlatformStaffPageWrapper.tsx](app/dashboard/client/PlatformStaffPageWrapper.tsx#L8) - remove `client_admin` from allowedRoles
   - Should be `allowedRoles="super_admin"` only

---

### 🟠 MEDIUM PRIORITY

8. **Extract PLATFORM_WORKSPACE_ID to config**
   - Create `lib/config/workspace.ts` with constant
   - Import in both [middleware.ts](middleware.ts) and [app/auth/login/page.tsx](app/auth/login/page.tsx)
   - Prevents duplication and eases future changes

9. **Consolidate role validation**
   - Remove redundant client-side role checks if middleware already validates
   - Or document why defense-in-depth is needed

10. **Remove test page**
    - Delete [app/test/page.tsx](app/test/page.tsx) from production
    - Or add authentication check if needed for debugging

11. **Clean up unused hooks**
    - Document why `useCanAccess`, `useHasRole`, `useRoleBasedRedirect` exist if not used
    - Remove if truly dead code

---

## 8. Conclusion

The frontend role-based routing system has **good foundational design** but **multiple implementation issues** that could allow unauthorized access, particularly around:

- **Workspace scoping** - client-side validation and ID confusion
- **Duplicate code paths** - inconsistent implementations
- **API dependency** - client-side checks assume API enforces constraints

**Critical Fix Order:**
1. Fix workspace ID confusion (inbox page)
2. Remove duplicate ProtectedRoute
3. Remove client-side workspace validation
4. Add server-side workspace validation
5. Add layout protection
6. Validate route parameters

**Estimated Impact:** After fixes, routing security moves from **RISKY** to **SECURE**.

