'use client';

import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';

/**
 * Platform Admin Layout
 *
 * Wraps all platform admin routes with role-based protection.
 * Only super_admin users can access these routes.
 *
 * When middleware redirects super_admin here, this layout ensures:
 * 1. User is authenticated
 * 2. User has super_admin role
 * 3. User sees loading spinner while auth is being verified
 */
export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles="super_admin">
      {children}
    </ProtectedRoute>
  );
}
