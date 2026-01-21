'use client';

import { Employee } from '@/hooks/useEmployees';

interface EmployeeTableProps {
  employees: Employee[];
  loading: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  isDeleting?: Record<string, boolean>;
}

/**
 * EmployeeTable Component
 *
 * Generic table component used by both:
 * - Super Admin (Platform Staff Management) at /admin/platform-staff
 * - Client Admin (Business Employee Management) at /dashboard/[workspaceId]/employees
 *
 * Features:
 * - Displays employees with name, email, role, status
 * - Edit and delete actions per row
 * - Responsive design for desktop and mobile
 * - Loading skeleton states
 * - Empty state messaging
 *
 * WORKSPACE SCOPING NOTE:
 * - Data passed to this component is already workspace-scoped by the parent
 * - For super_admin: lists platform staff (workspace_id = null)
 * - For admin: lists employees in their workspace only
 */
export default function EmployeeTable({
  employees,
  loading,
  onEdit,
  onDelete,
  isDeleting = {},
}: EmployeeTableProps) {
  if (loading) {
    return (
      <div className="bg-card-bg rounded-lg border border-card-border overflow-hidden">
        <div className="divide-y divide-card-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="h-4 bg-card-border rounded animate-pulse flex-1" />
              <div className="h-4 bg-card-border rounded animate-pulse flex-1" />
              <div className="h-4 bg-card-border rounded animate-pulse w-24" />
              <div className="h-4 bg-card-border rounded animate-pulse w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="bg-card-bg rounded-lg border border-card-border p-12 text-center">
        <div className="text-muted mb-2">📭</div>
        <h3 className="text-foreground font-medium mb-1">No employees yet</h3>
        <p className="text-muted text-sm">
          Use the "Invite Employee" button to add your first employee.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-lg border border-card-border overflow-x-auto">
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border bg-background">
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                Email
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                Role
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className="hover:bg-background transition-colors"
              >
                <td className="px-6 py-3 text-sm text-foreground">
                  {employee.full_name || 'Unnamed'}
                </td>
                <td className="px-6 py-3 text-sm text-muted">
                  {employee.email || 'No email'}
                </td>
                <td className="px-6 py-3 text-sm text-muted">
                  {employee.phone || '—'}
                </td>
                <td className="px-6 py-3 text-sm text-foreground">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {employee.role || 'employee'}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employee.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-sm space-x-2">
                  <button
                    onClick={() => onEdit(employee)}
                    disabled={isDeleting[employee.id]}
                    className="inline-flex items-center px-3 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(employee)}
                    disabled={isDeleting[employee.id]}
                    className="inline-flex items-center px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 text-xs font-medium"
                  >
                    {isDeleting[employee.id] ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-card-border">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="p-4 space-y-3 hover:bg-background transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-foreground">
                  {employee.full_name || 'Unnamed'}
                </div>
                <div className="text-xs text-muted mt-1">
                  {employee.email || 'No email'}
                </div>
                {employee.phone && (
                  <div className="text-xs text-muted mt-1">
                    📞 {employee.phone}
                  </div>
                )}
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  employee.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {employee.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                {employee.role || 'employee'}
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onEdit(employee)}
                disabled={isDeleting[employee.id]}
                className="flex-1 px-3 py-2 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 text-xs font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(employee)}
                disabled={isDeleting[employee.id]}
                className="flex-1 px-3 py-2 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 text-xs font-medium"
              >
                {isDeleting[employee.id] ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
