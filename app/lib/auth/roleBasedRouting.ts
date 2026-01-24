'use client';

import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/lib/auth/AuthProvider';
import { useEffect } from 'react';

/**
 * Role-based routing utilities
 *
 * Maps roles to their destination paths:
 * - super_admin → /platform-admin
 * - admin → /admin/dashboard
 * - employee → /app
 *
 * NEVER hardcode role names - always use these utilities
 */

export const ROLE_ROUTES = {
  super_admin: '/platform-admin',
  admin: '/admin/dashboard',
  employee: '/app',
} as const;

export type ValidRole = keyof typeof ROLE_ROUTES;

/**
 * Get the destination route for a role
 *
 * USAGE:
 * ```tsx
 * const destination = getRouteForRole('admin'); // '/admin/dashboard'
 * ```
 */
export function getRouteForRole(role: string | null): string | null {
  if (!role) return null;
  return ROLE_ROUTES[role as ValidRole] ?? null;
}

/**
 * useRoleBasedRedirect Hook
 *
 * Automatically redirects authenticated users to their role-based homepage
 * Use this on your root "/" or "/login-complete" page
 *
 * FLOW:
 * 1. Wait for auth to load
 * 2. If no session, redirect to login
 * 3. If session exists, redirect to role-based route
 *
 * USAGE:
 * ```tsx
 * export default function HomePage() {
 *   useRoleBasedRedirect();
 *   return <LoadingSpinner />; // Show while redirecting
 * }
 * ```
 */
export function useRoleBasedRedirect(): void {
  const router = useRouter();
  const auth = useAuthContext();

  useEffect(() => {
    // Wait for auth to finish loading
    if (auth.isLoading) {
      return;
    }

    // If error or no session, redirect to login
    if (auth.isError || !auth.session) {
      console.log('[useRoleBasedRedirect] No session, redirecting to /login');
      router.push('/login');
      return;
    }

    // If no role, show unauthorized
    if (!auth.role) {
      console.warn('[useRoleBasedRedirect] No role assigned, redirecting to /unauthorized');
      router.push('/unauthorized');
      return;
    }

    // Redirect to role-based route
    const destination = getRouteForRole(auth.role);
    if (destination) {
      console.log('[useRoleBasedRedirect] Redirecting', auth.role, 'to', destination);
      router.push(destination);
    } else {
      console.error('[useRoleBasedRedirect] Unknown role:', auth.role);
      router.push('/unauthorized');
    }
  }, [auth.isLoading, auth.isError, auth.session, auth.role, router]);
}

/**
 * isValidRole Type Guard
 *
 * Type-safe way to check if a string is a valid role
 *
 * USAGE:
 * ```tsx
 * if (isValidRole(userRole)) {
 *   const route = ROLE_ROUTES[userRole];
 * }
 * ```
 */
export function isValidRole(role: any): role is ValidRole {
  return Object.keys(ROLE_ROUTES).includes(role);
}

/**
 * useRouteGuard Hook
 *
 * Guards a route and redirects if user doesn't have the required role
 * Automatically redirects to their appropriate home page
 *
 * USAGE:
 * ```tsx
 * export default function AdminPage() {
 *   useRouteGuard('admin'); // Ensures user is admin
 *   return <AdminDashboard />;
 * }
 * ```
 */
export function useRouteGuard(requiredRole: string | string[]): void {
  const router = useRouter();
  const auth = useAuthContext();
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  useEffect(() => {
    // Wait for auth to load
    if (auth.isLoading) {
      return;
    }

    // If no session, redirect to login
    if (!auth.session) {
      console.warn('[useRouteGuard] No session, redirecting to /login');
      router.push('/login');
      return;
    }

    // If role is not in allowed list, redirect to role's home
    if (!requiredRoles.includes(auth.role || '')) {
      console.warn('[useRouteGuard] User role not allowed:', auth.role, '- allowed:', requiredRoles);
      const homeRoute = getRouteForRole(auth.role);
      if (homeRoute) {
        router.push(homeRoute);
      } else {
        router.push('/unauthorized');
      }
      return;
    }
  }, [auth.isLoading, auth.session, auth.role, requiredRoles, router]);
}

/**
 * useCanAccess Hook
 *
 * Check if current user can access a specific role-protected resource
 * Use this for conditional rendering of UI elements
 *
 * USAGE:
 * ```tsx
 * const canAccessAdmin = useCanAccess('admin');
 * if (canAccessAdmin) {
 *   return <AdminPanel />;
 * }
 * ```
 */
export function useCanAccess(requiredRole: string | string[]): boolean {
  const auth = useAuthContext();
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return requiredRoles.includes(auth.role || '');
}
