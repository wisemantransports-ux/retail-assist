'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/lib/auth/AuthProvider';

/**
 * ProtectedRoute Props
 */
export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Single role or array of allowed roles */
  allowedRoles?: string | string[];
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom unauthorized component */
  unauthorizedComponent?: React.ReactNode;
  /** Fallback redirect path if user is not authenticated */
  redirectTo?: string;
}

/**
 * Default loading spinner
 */
function DefaultLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}

/**
 * Default unauthorized message
 */
function DefaultUnauthorized() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-gray-600">You do not have permission to access this page.</p>
      </div>
    </div>
  );
}

/**
 * ProtectedRoute Component
 *
 * Guards routes based on authentication and role
 *
 * FLOW:
 * 1. Check if auth is loading → show loading spinner
 * 2. Check if session exists → redirect to login if not
 * 3. Check if role is allowed → show unauthorized if not
 * 4. Render children if all checks pass
 *
 * USAGE:
 * ```tsx
 * // Require authentication only
 * <ProtectedRoute>
 *   <MyComponent />
 * </ProtectedRoute>
 *
 * // Require specific role
 * <ProtectedRoute allowedRoles="admin">
 *   <AdminPanel />
 * </ProtectedRoute>
 *
 * // Require multiple roles
 * <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
 *   <ManagementPanel />
 * </ProtectedRoute>
 *
 * // Custom components
 * <ProtectedRoute
 *   loadingComponent={<CustomSpinner />}
 *   unauthorizedComponent={<CustomDenied />}
 * >
 *   <MyComponent />
 * </ProtectedRoute>
 * ```
 *
 * IMPORTANT:
 * - Must be used within AuthProvider
 * - Cannot be used in server components
 * - For middleware-level protection, use middleware.ts instead
 */
export function ProtectedRoute({
  children,
  allowedRoles,
  loadingComponent = <DefaultLoadingSpinner />,
  unauthorizedComponent = <DefaultUnauthorized />,
  redirectTo = '/login',
}: ProtectedRouteProps): React.ReactNode {
  const router = useRouter();
  const auth = useAuthContext();

  // ===== HOOK: Redirect if not authenticated =====
  // Must be called at top level, not inside conditionals
  useEffect(() => {
    console.log('[ProtectedRoute] useEffect check:', {
      isLoading: auth.isLoading,
      hasSession: !!auth.session,
      isError: auth.isError,
    });

    if (!auth.isLoading && !auth.session && !auth.isError) {
      console.warn('[ProtectedRoute] ✗ No session found, redirecting to', redirectTo);
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.session, auth.isError, router, redirectTo]);

  // ===== CHECK 1: Loading =====
  if (auth.isLoading) {
    return loadingComponent;
  }

  // ===== CHECK 2: Error =====
  if (auth.isError) {
    console.error('[ProtectedRoute] Auth error:', auth.errorMessage);
    return unauthorizedComponent;
  }

  // ===== CHECK 3: Session exists =====
  if (!auth.session) {
    // Redirect is handled by useEffect above
    return loadingComponent;
  }

  // ===== CHECK 4: Role allowed =====
  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(auth.role || '')) {
      console.warn('[ProtectedRoute] User role not allowed. Role:', auth.role, 'Allowed:', roles);
      return unauthorizedComponent;
    }
  }

  // ===== CHECK 5: Workspace validation =====
  // Super admin can have null workspace_id (they don't belong to any workspace)
  // All other roles MUST have a workspace_id
  if (auth.role !== 'super_admin' && !auth.workspaceId) {
    console.error('[ProtectedRoute] Non-super_admin user missing workspace_id. Role:', auth.role);
    return unauthorizedComponent;
  }

  // Super admin must NOT have a workspace_id (this is an invalid state)
  if (auth.role === 'super_admin' && auth.workspaceId) {
    console.error('[ProtectedRoute] Super admin should not have workspace_id:', auth.workspaceId);
    return unauthorizedComponent;
  }

  // ===== ALL CHECKS PASSED =====
  return children;
}

/**
 * withProtectedRoute HOC
 *
 * Wraps a component with ProtectedRoute
 *
 * USAGE:
 * ```tsx
 * export default withProtectedRoute(MyComponent, { allowedRoles: 'admin' });
 * ```
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
