'use client';

import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';

/**
 * Employee App Layout
 *
 * Wraps all employee app routes with role-based protection.
 * Only employee users can access these routes.
 *
 * When middleware redirects employees here, this layout ensures:
 * 1. User is authenticated
 * 2. User has employee role
 * 3. User sees loading spinner while auth is being verified
 *
 * All routes under /app/* are protected by this layout.
 */
export default function EmployeeAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles="employee">
      {children}
    </ProtectedRoute>
  );
}
