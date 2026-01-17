'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import EmployeeTable from '@/components/EmployeeTable';
import InviteEmployeeModal from '@/components/InviteEmployeeModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';

/**
 * Platform Staff Management Page
 *
 * Route: /admin/platform-staff
 * Role: super_admin only
 *
 * Features:
 * - List all platform staff (workspace_id = NULL)
 * - Invite modal: sends POST /api/employees with workspace_id = NULL
 * - Edit modal: update name, role, active status
 * - Remove action: DELETE /api/employees/[id]
 *
 * ROLE VALIDATION:
 * - Only super_admin can access this page
 * - Enforced via middleware + rpc_get_user_access()
 * - Workspace isolation: platform staff has workspace_id = null
 *
 * API INTEGRATION:
 * - Uses lazy-loaded Supabase admin client via API endpoints
 * - Invite tokens: 128-bit, 30-day expiry (created by RPC)
 * - All errors handled with proper status codes
 */

interface UserAccess {
  role: string;
  workspace_id: string | null;
}

function PlatformStaffContent() {
  const router = useRouter();
  const { employees, loading, error, fetchEmployees, createEmployee, updateEmployee, deleteEmployee } =
    useEmployees(null); // workspace_id = null for platform staff

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check authentication and authorization on mount
  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch('/api/auth/me');

        if (!response.ok) {
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        const role = data.user?.role;
        const workspace_id = data.user?.workspace_id;

        console.log('[PlatformStaffPage] Resolved role:', role);
        console.log('[PlatformStaffPage] Workspace ID:', workspace_id);

        // Only super_admin can access this page
        if (role !== 'super_admin') {
          console.warn('[PlatformStaffPage] Access denied for role:', role);
          router.push('/unauthorized');
          return;
        }

        // Super admin must have workspace_id = null
        if (workspace_id !== null && workspace_id !== undefined) {
          console.error('[PlatformStaffPage] Super admin has workspace_id set');
          router.push('/unauthorized');
          return;
        }

        setUserAccess({ role, workspace_id });
        fetchEmployees();
      } catch (err) {
        console.error('[PlatformStaffPage] Auth check error:', err);
        router.push('/admin/login');
      } finally {
        setAuthLoading(false);
      }
    }

    checkAccess();
  }, [router, fetchEmployees]);

  /**
   * Handle employee invite submission
   * WORKSPACE SCOPING: workspace_id = null is passed implicitly in API endpoint
   */
  const handleInviteSubmit = async (email: string, role: string): Promise<boolean> => {
    const result = await createEmployee(email, role);

    if (result.success) {
      // Refresh employee list
      await fetchEmployees();
      return true;
    } else {
      console.error('[PlatformStaffPage] Invite error:', result.error);
      return false;
    }
  };

  /**
   * Handle edit button click
   */
  const handleEditClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  /**
   * Handle edit form submission
   */
  const handleEditSubmit = async (
    employeeId: string,
    updates: Partial<Pick<Employee, 'full_name' | 'phone' | 'is_active'>>
  ): Promise<boolean> => {
    const result = await updateEmployee(employeeId, updates);

    if (result.success) {
      return true;
    } else {
      console.error('[PlatformStaffPage] Update error:', result.error);
      return false;
    }
  };

  /**
   * Handle delete button click
   * WORKSPACE SCOPING: API endpoint verifies employee is in workspace
   */
  const handleDeleteClick = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to remove ${employee.full_name || 'this employee'}?`)) {
      return;
    }

    setDeleting((prev) => ({ ...prev, [employee.id]: true }));
    const result = await deleteEmployee(employee.id);

    if (result.success) {
      // Employee removed from local state automatically
      console.log('[PlatformStaffPage] Employee deleted:', employee.id);
    } else {
      console.error('[PlatformStaffPage] Delete error:', result.error);
      alert(result.error || 'Failed to delete employee');
    }

    setDeleting((prev) => {
      const next = { ...prev };
      delete next[employee.id];
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!userAccess) {
    return null; // Redirecting in effect hook
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            🏢 Platform Staff Management
          </h1>
          <p className="text-muted">
            Manage all platform staff members across Retail Assist
          </p>
        </div>

        {/* Action Button */}
        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
          >
            📧 Invite Platform Staff
          </button>
          <button
            onClick={() => fetchEmployees()}
            disabled={loading}
            className="px-6 py-2 border border-card-border rounded-lg text-foreground hover:bg-background font-medium text-sm disabled:opacity-50"
          >
            🔄 Refresh
          </button>
        </div>

        {/* API Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 rounded-lg text-red-800 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Employee Table */}
        <EmployeeTable
          employees={employees}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          isDeleting={deleting}
        />

        {/* Stats Footer */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card-bg rounded-lg border border-card-border p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{employees.length}</div>
            <div className="text-sm text-muted">Total Staff</div>
          </div>
          <div className="bg-card-bg rounded-lg border border-card-border p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {employees.filter((e) => e.is_active).length}
            </div>
            <div className="text-sm text-muted">Active</div>
          </div>
          <div className="bg-card-bg rounded-lg border border-card-border p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {employees.filter((e) => !e.is_active).length}
            </div>
            <div className="text-sm text-muted">Inactive</div>
          </div>
          <div className="bg-card-bg rounded-lg border border-card-border p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {employees.filter((e) => e.role === 'admin').length}
            </div>
            <div className="text-sm text-muted">Admins</div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <InviteEmployeeModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleInviteSubmit}
        isPlatformStaff={true}
      />

      <EditEmployeeModal
        isOpen={showEditModal}
        employee={selectedEmployee}
        onClose={() => {
          setShowEditModal(false);
          setSelectedEmployee(null);
        }}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}

/**
 * Page wrapper with Suspense boundary
 */
export default function PlatformStaffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted">Loading...</p>
          </div>
        </div>
      }
    >
      <PlatformStaffContent />
    </Suspense>
  );
}
