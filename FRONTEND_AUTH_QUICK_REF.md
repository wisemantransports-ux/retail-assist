# Frontend Auth & Routing - Quick Reference

## Core Components

| Component | Location | Purpose | Usage |
|-----------|----------|---------|-------|
| `useAuth()` | `app/hooks/useAuth.ts` | Fetch auth state from RPC | `const auth = useAuth()` |
| `AuthProvider` | `app/lib/auth/AuthProvider.tsx` | Share auth context | Wraps root layout |
| `useAuthContext()` | `app/lib/auth/AuthProvider.tsx` | Access auth context | `const auth = useAuthContext()` |
| `ProtectedRoute` | `app/lib/auth/ProtectedRoute.tsx` | Guard routes by role | `<ProtectedRoute allowedRoles="admin">` |
| `ROLE_ROUTES` | `app/lib/auth/roleBasedRouting.ts` | Role → path mapping | `getRouteForRole('admin')` |

## Quick Patterns

### Protect a Page by Role
```tsx
'use client';
import { useRouteGuard } from '@/app/lib/auth/roleBasedRouting';

export default function AdminPage() {
  useRouteGuard('admin'); // Redirects if not admin
  return <AdminContent />;
}
```

### Protect a Layout
```tsx
import { ProtectedRoute } from '@/app/lib/auth/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles="admin">
      {children}
    </ProtectedRoute>
  );
}
```

### Show UI Based on Role
```tsx
'use client';
import { useCanAccess } from '@/app/lib/auth/roleBasedRouting';

export default function Nav() {
  const isAdmin = useCanAccess('admin');
  
  return (
    <>
      {isAdmin && <AdminLink />}
    </>
  );
}
```

### Get Current User Info
```tsx
'use client';
import { useAuthContext } from '@/app/lib/auth/AuthProvider';

export default function UserCard() {
  const auth = useAuthContext();
  
  return (
    <div>
      <p>Email: {auth.session?.user?.email}</p>
      <p>Role: {auth.role}</p>
      <p>Workspace: {auth.workspaceId}</p>
    </div>
  );
}
```

### Auto-Redirect After Login
```tsx
'use client';
import { useRoleBasedRedirect } from '@/app/lib/auth/roleBasedRouting';

export default function LoginCompletePage() {
  useRoleBasedRedirect(); // Redirects to role's homepage
  return <Spinner />;
}
```

## Role → Route Mapping
```
super_admin → /platform-admin
admin       → /admin/dashboard
employee    → /app
```

## Auth State Object
```typescript
{
  session: Session | null,        // Supabase session
  access: UserAccess | null,      // RPC result: { user_id, workspace_id, role }
  role: string | null,            // 'super_admin' | 'admin' | 'employee'
  workspaceId: string | null,     // User's workspace (null for super_admin)
  isLoading: boolean,             // Auth still loading
  isError: boolean,               // Auth error occurred
  errorMessage: string | null     // Error details
}
```

## Error Handling
```tsx
if (auth.isLoading) return <Spinner />;
if (auth.isError) return <ErrorPage msg={auth.errorMessage} />;
if (!auth.session) return <NotAuthenticated />;
if (!['admin', 'super_admin'].includes(auth.role)) return <Unauthorized />;
```

## Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useAuth()` | Core auth state | `AuthState` |
| `useAuthContext()` | Access auth from context | `AuthState` |
| `useHasRole(role)` | Check if user has role | `boolean` |
| `useWorkspaceId()` | Get user's workspace | `string \| null` |
| `useRoleBasedRedirect()` | Auto-redirect to role homepage | `void` |
| `useRouteGuard(role)` | Guard route by role | `void` |
| `useCanAccess(role)` | Check if can access role | `boolean` |

## Rules to Remember

⚠️ **DO:**
- Use hooks from `roleBasedRouting.ts` for role checks
- Call RPC only in client components (`useAuth`)
- Handle loading and error states
- Scope API calls to user's workspace

⚠️ **DON'T:**
- Hardcode role names
- Infer access from email
- Call RPC in server components or SSR
- Skip error handling
- Trust user-provided role values

## File Changes Summary

| File | Change | Notes |
|------|--------|-------|
| `app/layout.tsx` | ✅ Added AuthProvider | Wraps all routes |
| `app/hooks/useAuth.ts` | ✅ NEW | Core auth hook |
| `app/lib/auth/AuthProvider.tsx` | ✅ NEW | Context provider |
| `app/lib/auth/ProtectedRoute.tsx` | ✅ NEW | Route guard component |
| `app/lib/auth/roleBasedRouting.ts` | ✅ NEW | Role routing utilities |
| `app/platform-admin/layout.tsx` | ✅ NEW | Super admin section |
| `app/platform-admin/page.tsx` | ✅ NEW | Super admin dashboard |
| `app/app/layout.tsx` | ✅ NEW | Employee app section |
| `app/app/page.tsx` | ✅ NEW | Employee app dashboard |
| `app/dashboard/layout.tsx` | ✅ Updated | Added ProtectedRoute |
| `app/employees/layout.tsx` | ✅ NEW | Employee routes guard |

## Testing

Test these scenarios:
1. ✅ User without session → redirects to /login
2. ✅ Super admin logs in → redirects to /platform-admin
3. ✅ Admin logs in → redirects to /admin/dashboard
4. ✅ Employee logs in → redirects to /app
5. ✅ Cross-role navigation → redirects to home
6. ✅ Loading spinner shows during auth
7. ✅ Error states are handled
8. ✅ Workspace scoping works

## Deployment Checklist

- [ ] Test all role login flows
- [ ] Verify RPC returns correct data
- [ ] Test cross-role access attempts
- [ ] Check console for auth errors
- [ ] Verify middleware still works
- [ ] Test on staging environment
- [ ] Monitor error logs post-deploy
