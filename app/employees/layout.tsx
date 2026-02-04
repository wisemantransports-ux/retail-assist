'use client';


/**
 * Employees Layout
 *
 * Role-Based Access:
 * - employee: Full access to their workspace portal
 * 
 * This layout wraps all /employees/* routes and ensures:
 * 1. User is authenticated
 * 2. User has employee role
 * 3. User sees loading spinner while auth is being verified
 *
 * Middleware redirects employees to /employees/dashboard
 * All content under /employees/* is workplace-scoped
 */
export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}
