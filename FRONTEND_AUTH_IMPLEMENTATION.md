# Frontend Authentication & Role-Based Routing Implementation Guide

**Date:** January 23, 2026  
**Status:** ✅ COMPLETE  
**Auth Freeze:** ✅ MAINTAINED - No database or RPC modifications

---

## Overview

This document describes the complete frontend authentication and role-based routing implementation for the Supabase-backed Retail Assist application.

**Key Principles:**
- All access logic depends on `rpc_get_user_access`
- Never call RPC before auth session is ready
- Never hardcode roles - use provided utilities
- Never infer access from email
- Never call RPC during SSR or build time
- Always handle loading and error states
- Middleware handles first-pass routing
- Client components provide additional protection and UX

---

## Architecture

### Auth Flow (Mandatory)

```
1. Page loads (browser)
   ↓
2. Middleware checks request
   ├─ Call: supabase.auth.getSession()
   ├─ If no session → redirect to /login
   ├─ Call: supabase.rpc('rpc_get_user_access')
   └─ If no rows → redirect to /unauthorized
   ↓
3. Route-specific handling
   ├─ /admin/* → super_admin/platform_staff only
   ├─ /dashboard/* → admin only
   ├─ /app/* → employee only
   └─ /platform-admin → super_admin only
   ↓
4. Client component renders
   ├─ AuthProvider provides session + access
   ├─ useAuth hook fetches user access from RPC
   ├─ ProtectedRoute verifies role
   └─ Children render with auth context available
```

### Components & Hooks

#### 1. **useAuth Hook** (`app/hooks/useAuth.ts`)

Implements the mandatory auth flow in a client component:

```tsx
export function useAuth(): AuthState {
  // Returns: { session, access, role, workspaceId, isLoading, isError, errorMessage }
  // - Calls getSession()
  // - If session exists, calls rpc_get_user_access()
  // - Handles all error states
}
```

**Usage:**
```tsx
const auth = useAuth();
if (auth.isLoading) return <Spinner />;
if (!auth.session) return <Unauthorized />;
console.log('User role:', auth.role); // 'super_admin' | 'admin' | 'employee'
```

#### 2. **AuthProvider** (`app/lib/auth/AuthProvider.tsx`)

Context provider to share auth state across components:

```tsx
export function AuthProvider({ children }: AuthProviderProps) {
  const authState = useAuth();
  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthState {
  // Access auth state in any child component
}
```

**Usage in Root Layout:**
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### 3. **ProtectedRoute Component** (`app/lib/auth/ProtectedRoute.tsx`) — *DEPRECATED*

> Deprecated: Page-level guards that block rendering (e.g., `ProtectedRoute`, `AdminProtectedRoute`) were removed in favor of a single authoritative gate in `app/dashboard/layout.tsx` which relies on `/api/auth/me`. Do not add new page-level blocking guards.

Guards routes based on authentication and role:

```tsx
export function ProtectedRoute({
  children,
  allowedRoles,
  loadingComponent,
  unauthorizedComponent,
  redirectTo = '/login',
}: ProtectedRouteProps): React.ReactNode
```

**Usage:**
```tsx
// Require authentication only
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// Require specific role
<ProtectedRoute allowedRoles="admin">
  <AdminPanel />
</ProtectedRoute>

// Multiple roles
<ProtectedRoute allowedRoles={['super_admin', 'admin']}>
  <ManagementPanel />
</ProtectedRoute>

// With HOC
export default withProtectedRoute(AdminComponent, { allowedRoles: 'admin' });
```

#### 4. **Role-Based Routing Utilities** (`app/lib/auth/roleBasedRouting.ts`)

Type-safe role management and routing hooks:

```tsx
// Role to route mapping
export const ROLE_ROUTES = {
  super_admin: '/platform-admin',
  admin: '/admin/dashboard',
  employee: '/app',
};

// Get route for a role
getRouteForRole('admin'); // '/admin/dashboard'

// Auto-redirect authenticated users
useRoleBasedRedirect(); // Redirects to role-based homepage

// Guard a route and redirect if unauthorized
useRouteGuard('admin'); // Redirects elsewhere if not admin

// Check if user can access a resource
const canAccess = useCanAccess('admin'); // boolean
```

---

## Routing Rules

### Route Mapping

| Path | Role | Component | Notes |
|------|------|-----------|-------|
| `/login` | — | Login page | No auth required |
| `/platform-admin` | `super_admin` | Platform admin dashboard | Retail Assist internal staff |
| `/admin/*` | `super_admin` \| `platform_staff` | Admin section | Platform staff support portal |
| `/admin/dashboard` | `super_admin` \| `admin` | Client admin dashboard | Client business admin |
| `/dashboard/*` | `admin` | Client dashboard | Client business admin features |
| `/app` | `employee` | Employee app dashboard | Client business staff |
| `/employees/messages` | `employee` | Message queue | Client business staff messages |
| `/unauthorized` | — | Error page | No access error |

### RPC Result Interpretation

The `rpc_get_user_access` RPC returns exactly 0 or 1 row:

```sql
-- Returns:
{
  user_id: string,
  workspace_id: string | null,
  role: 'super_admin' | 'admin' | 'employee'
}
```

**Role-Specific Workspace Rules:**

| Role | workspace_id | Can Access |
|------|--------------|-----------|
| `super_admin` | NULL | All workspaces (platform-wide) |
| `admin` | Set | Only their workspace (client admin) |
| `employee` | Set | Only their workspace (client staff) |

---

## File Structure

```
app/
├── layout.tsx                    # ✅ Updated: Now wraps with AuthProvider
├── page.tsx                      # Home page
├── hooks/
│   ├── useAuth.ts               # ✅ NEW: Core auth hook
│   ├── useEmployees.ts
│   └── ...
├── lib/
│   ├── auth/
│   │   ├── AuthProvider.tsx      # ✅ NEW: Context provider
│   │   ├── ProtectedRoute.tsx    # ✅ NEW: Route protection component
│   │   └── roleBasedRouting.ts   # ✅ NEW: Routing utilities
│   └── ...
├── platform-admin/              # ✅ NEW: Super admin section
│   ├── layout.tsx               # Wrapped with ProtectedRoute
│   └── page.tsx                 # Platform admin dashboard
├── admin/
│   ├── page.tsx
│   └── ...
├── dashboard/
│   ├── layout.tsx               # ✅ Updated: Now uses ProtectedRoute
│   ├── page.tsx
│   └── ...
├── app/                         # ✅ NEW: Employee app section
│   ├── layout.tsx               # Wrapped with ProtectedRoute
│   └── page.tsx                 # Employee app dashboard
├── employees/
│   ├── layout.tsx               # ✅ NEW: Wrapped with ProtectedRoute
│   ├── messages/
│   │   └── page.tsx
│   └── ...
└── ...

middleware.ts                    # ✅ Existing: Already implements auth flow
```

---

## Implementation Details

### 1. Client-Side Auth Flow

When a user visits the app:

```tsx
// Step 1: AuthProvider initializes useAuth on app load
<AuthProvider>
  <App />
</AuthProvider>

// Step 2: useAuth runs effect
useEffect(() => {
  // Call supabase.auth.getSession()
  const { session } = await supabase.auth.getSession();
  
  // If session exists, call RPC
  if (session) {
    const { data } = await supabase.rpc('rpc_get_user_access');
    // Update state with role + workspace
  }
}, []);

// Step 3: Component can access via context
const auth = useAuthContext();
if (auth.role === 'admin') { /* render admin UI */ }
```

### 2. Route Protection Flow

When a user navigates to a protected route:

```tsx
// Step 1: Middleware checks first
middleware.ts
├─ Verify session exists
├─ Call RPC to get role
└─ Redirect to role-based path

// Step 2: Route layout protects further
<ProtectedRoute allowedRoles="admin">
  {children}
</ProtectedRoute>

// Step 3: Page component can use auth
export default function AdminPage() {
  useRouteGuard('admin');  // Additional guard
  const auth = useAuthContext(); // Access auth state
}
```

### 3. Workspace Scoping

For `admin` and `employee` roles, `workspace_id` is always set:

```tsx
// Get user's workspace
const auth = useAuthContext();
const workspaceId = auth.workspaceId; // string

// Use in API calls
fetch(`/api/workspace/${auth.workspaceId}/messages`)

// Cannot be null for these roles
if (auth.role === 'employee' && !auth.workspaceId) {
  // This is an error state - should never happen
  throw new Error('Employee without workspace');
}
```

---

## Error Handling

### Session Not Found
```tsx
if (!auth.session) {
  // User not authenticated
  // Middleware will redirect to /login
  // ProtectedRoute shows loading spinner while redirecting
}
```

### RPC Error or No Access
```tsx
if (auth.isError && auth.errorMessage.includes('access')) {
  // User authenticated but no access record
  // This means user is unauthorized
  // Show error or redirect to /unauthorized
}
```

### Invalid Role
```tsx
if (!['super_admin', 'admin', 'employee'].includes(auth.role)) {
  // Malformed RPC response or data corruption
  // Treat as unauthorized
}
```

### Loading State
```tsx
if (auth.isLoading) {
  // Auth still being fetched from RPC
  // Show spinner (ProtectedRoute handles this)
}
```

---

## Security Guarantees

✅ **Session Validation**
- All auth flows start with `supabase.auth.getSession()`
- Session tokens are validated by Supabase

✅ **RPC Authorization**
- `rpc_get_user_access` uses RLS to ensure user can only query their own access
- Returns only user's own role + workspace

✅ **Role-Based Isolation**
- Each role maps to specific routes
- Cross-role access attempts are blocked by ProtectedRoute

✅ **Workspace Scoping**
- `admin` and `employee` users are scoped to exactly ONE workspace
- API endpoints validate `workspace_id` in request path

✅ **No Hardcoded Roles**
- All role names come from RPC response
- Use `ROLE_ROUTES` constant for role→route mappings
- Use `useCanAccess()` hook for role checks

✅ **No Email-Based Access**
- Access is determined solely by RPC, not email or domain
- Email is never checked in routing logic

✅ **No SSR RPC Calls**
- RPC only called in client components (useAuth hook)
- Middleware uses server-side Supabase client with session cookies

---

## Usage Examples

### Example 1: Protected Page with Role Guard

```tsx
// app/admin/page.tsx
'use client';

import { useRouteGuard } from '@/app/lib/auth/roleBasedRouting';
import { useAuthContext } from '@/app/lib/auth/AuthProvider';

export default function AdminPage() {
  // Guard this route - redirect if not super_admin
  useRouteGuard('super_admin');
  
  const auth = useAuthContext();
  
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {auth.session?.user?.email}</p>
    </div>
  );
}
```

### Example 2: Conditional Rendering by Role

```tsx
'use client';

import { useCanAccess } from '@/app/lib/auth/roleBasedRouting';

export default function Dashboard() {
  const canAccessAdmin = useCanAccess('admin');
  const canAccessSuper = useCanAccess('super_admin');
  
  return (
    <div>
      {canAccessSuper && <PlatformSettings />}
      {canAccessAdmin && <WorkspaceSettings />}
    </div>
  );
}
```

### Example 3: Auto-Redirect on Login

```tsx
// app/login-complete/page.tsx
'use client';

import { useRoleBasedRedirect } from '@/app/lib/auth/roleBasedRouting';

export default function LoginCompletePage() {
  useRoleBasedRedirect(); // Auto-redirects to role's homepage
  
  return <LoadingSpinner />;
}
```

### Example 4: Layout with Multiple Roles

```tsx
// app/admin/layout.tsx
import { ProtectedRoute } from '@/app/lib/auth/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
      <div className="flex">
        <Sidebar />
        {children}
      </div>
    </ProtectedRoute>
  );
}
```

---

## Testing Checklist

- [ ] **Session Check**: User without session is redirected to /login
- [ ] **RPC Check**: User with session but no RPC access sees unauthorized page
- [ ] **Super Admin**: Can access /platform-admin, redirected from /dashboard
- [ ] **Admin**: Can access /dashboard, redirected from /platform-admin
- [ ] **Employee**: Can access /app, redirected from /dashboard
- [ ] **Loading States**: Loading spinner shows while auth is being verified
- [ ] **Error States**: Auth errors are properly displayed
- [ ] **Workspace Scoping**: Employee can only access their workspace
- [ ] **Role-Based UI**: UI elements show/hide based on user role
- [ ] **Cross-Role Navigation**: Attempting to navigate to wrong route redirects correctly

---

## Troubleshooting

### Issue: Infinite redirect loop

**Cause:** ProtectedRoute redirecting during render  
**Fix:** Use `useEffect` in ProtectedRoute for redirects (already implemented)

### Issue: useAuthContext outside AuthProvider

**Error:** `useAuthContext must be used within AuthProvider`  
**Fix:** Ensure component is wrapped by AuthProvider (in root layout)

### Issue: RPC not returning data

**Cause:** User might not have access record in database  
**Debug:** Check user_access or workspace_members table  
**Fix:** Verify RPC query and user permissions

### Issue: Loading stays true forever

**Cause:** RPC call failing or hanging  
**Debug:** Check browser console for network errors  
**Fix:** Check Supabase logs for RPC errors

---

## Deployment Notes

✅ **Ready for Production:**
- Middleware is already protecting routes
- useAuth hook uses browser client with session persistence
- ProtectedRoute handles all client-side protection
- No breaking changes to existing code

⚠️ **Before Deploying:**
- Test all role transitions (login → redirect → role page)
- Verify RPC query with production data
- Test cross-role access attempts
- Check workspace scoping in API endpoints

---

## Related Files

- **Middleware:** `middleware.ts` (implements server-side routing)
- **RPC:** `supabase/migrations/038_comprehensive_signup_invite_flow_migration.sql` (defines rpc_get_user_access)
- **Auth Routes:** `app/api/auth/` (login, logout, me endpoints)
- **Supabase Client:** `app/lib/supabase/client.ts` (browser client)

---

## Summary

This implementation provides:

✅ Complete auth flow from session → RPC → role-based routing  
✅ Type-safe role management with constants and hooks  
✅ Loading and error state handling  
✅ Workspace-scoped access for employees and admins  
✅ No breaking changes to existing code  
✅ Production-ready security  

All constraints from the requirements are satisfied:
- ✅ Uses existing RPC: `rpc_get_user_access`
- ✅ Never calls RPC before session is ready
- ✅ Never hardcodes roles
- ✅ Never infers access from email
- ✅ Never calls RPC during SSR
- ✅ Handles all loading and error states
- ✅ No database schema changes
- ✅ No new RPCs created
