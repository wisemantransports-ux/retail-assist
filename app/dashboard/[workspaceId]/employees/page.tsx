'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import EmployeeTable from '@/components/EmployeeTable';
import InviteEmployeeModal from '@/components/InviteEmployeeModal';
import EditEmployeeModal from '@/components/EditEmployeeModal';

/**
 * Business Employee Management Page
 *
 * Route: /dashboard/[workspaceId]/employees
 * Role: admin (client) only
 *
 * Features:
 * - List all employees in current workspace
 * - Invite modal: sends POST /api/employees with workspace_id = admin's workspace_id
 * - Edit modal: update name, role, active status
 * - Remove action: DELETE /api/employees/[id]
 *
 * ROLE VALIDATION:
 * - Only admin (client) role can access
 * - Enforced via middleware + rpc_get_user_access()
 * - workspace_id from URL must match authenticated admin's workspace
 *
 * WORKSPACE SCOPING:
 * - All employees are filtered by workspace_id at API level
 * - Admin cannot view/edit/delete employees from other workspaces
 * - Invite tokens scoped to this workspace only
 *
 * API INTEGRATION:
 * - Uses lazy-loaded Supabase admin client via API endpoints
 * - Invite tokens: 128-bit, 30-day expiry
 * - All errors handled with proper status codes
 */

interface UserAccess {
  role: string;
  workspace_id: string | null;
  plan_limits?: {
    maxEmployees: number;
    maxPages?: number;
    hasInstagram?: boolean;
  };
}

function EmployeesContent() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const { employees, loading, error, fetchEmployees, createEmployee, updateEmployee, deleteEmployee } =
    useEmployees(workspaceId);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ id?: string; token?: string; email?: string } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Check authentication and authorization on mount
  useEffect(() => {
    async function checkAccess() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });

        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();
        const role = data.user?.role;
        const userWorkspaceId = data.user?.workspace_id;
        const planLimits = data.user?.plan_limits;

        console.log('[EmployeesPage] Resolved role:', role);
        console.log('[EmployeesPage] Workspace ID:', userWorkspaceId);
        console.log('[EmployeesPage] Plan limits:', planLimits);
        console.log('[EmployeesPage] URL Workspace ID:', workspaceId);

        // Only admin (client) can access this page
        if (role !== 'admin') {
          console.warn('[EmployeesPage] Access denied for role:', role);
          router.push('/unauthorized');
          return;
        }

        // Verify workspace_id from URL matches authenticated user's workspace
        // WORKSPACE SCOPING: Prevent cross-workspace access
        if (userWorkspaceId !== workspaceId) {
          console.error(
            '[EmployeesPage] Workspace mismatch:',
            `user=${userWorkspaceId}, url=${workspaceId}`
          );
          router.push('/unauthorized');
          return;
        }

        // Admin must have a workspace_id
        if (!userWorkspaceId) {
          console.error('[EmployeesPage] Admin has no workspace_id');
          router.push('/unauthorized');
          return;
        }

        setUserAccess({ 
          role, 
          workspace_id: userWorkspaceId,
          plan_limits: planLimits || { maxEmployees: 2 }
        });
        fetchEmployees();
      } catch (err) {
        console.error('[EmployeesPage] Auth check error:', err);
        router.push('/login');
      } finally {
        setAuthLoading(false);
      }
    }

    checkAccess();
  }, [router, workspaceId, fetchEmployees]);

  /**
   * Handle employee invite submission
   * WORKSPACE SCOPING: workspace_id = admin's workspace is passed implicitly via RPC
   */
  const handleInviteSubmit = async (email: string, role: string): Promise<boolean> => {
    // Only send email from client — server infers workspace and invited_by
    const result = await createEmployee(email);

    if (result.success) {
      // Persist invite info locally and show link modal
      setLastInvite(result.invite || null);
      setShowInviteLinkModal(true);

      toast.success(`Invite created for ${email}`, { duration: 3500 });

      console.log('[EmployeesPage] Invite created:', result.invite);

      // Refresh employee list
      await fetchEmployees();
      return true;
    } else {
      // Show the ACTUAL backend error, don't override with generic text
      // Backend provides specific reasons: plan limit, auth, permissions, validation, etc.
      const errorMessage = result.error;
      toast.error(errorMessage, { duration: 4500 });
      console.error('[EmployeesPage] Invite creation failed:', errorMessage);
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
   * WORKSPACE SCOPING: API endpoint verifies employee is in admin's workspace
   */
  const handleEditSubmit = async (
    employeeId: string,
    updates: Partial<Pick<Employee, 'full_name' | 'phone' | 'is_active'>>
  ): Promise<boolean> => {
    const result = await updateEmployee(employeeId, updates);

    if (result.success) {
      return true;
    } else {
      console.error('[EmployeesPage] Update error:', result.error);
      return false;
    }
  };

  /**
   * Handle delete button click
   * WORKSPACE SCOPING: API endpoint verifies employee is in admin's workspace
   */
  const handleDeleteClick = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to remove ${employee.full_name || 'this employee'}?`)) {
      return;
    }

    setDeleting((prev) => ({ ...prev, [employee.id]: true }));
    const result = await deleteEmployee(employee.id);

    if (result.success) {
      // Employee removed from local state automatically
      console.log('[EmployeesPage] Employee deleted:', employee.id);
    } else {
      console.error('[EmployeesPage] Delete error:', result.error);
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
    <div className="min-h-screen bg-background">
      {/* Toast Notifications */}
      <Toaster position="top-right" />

      <div className="p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              👥 Employee Management
            </h1>
            <p className="text-muted">
              Manage employees and their access to your workspace
            </p>
          </div>

          {/* Plan Limit Info */}
          {userAccess && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Employee Limit: <span className="font-bold">{employees.length}</span> of{' '}
                  <span className="font-bold">
                    {userAccess.plan_limits?.maxEmployees === -1 ? 'Unlimited' : userAccess.plan_limits?.maxEmployees || 2}
                  </span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {userAccess.plan_limits?.maxEmployees === -1
                    ? 'Your Enterprise plan allows unlimited employees'
                    : userAccess.plan_limits?.maxEmployees === 5
                    ? 'Your Pro plan allows up to 5 employees'
                    : 'Your Starter plan allows up to 2 employees'}
                </p>
              </div>
              {userAccess.plan_limits && userAccess.plan_limits.maxEmployees !== -1 && userAccess.plan_limits.maxEmployees - employees.length === 0 && (
                <div className="text-right">
                  <p className="text-xs font-medium text-orange-600">⚠ Limit Reached</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Action Buttons */}
          <div className="mb-6 flex gap-3 flex-wrap">
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={
                loading ||
                authLoading ||
                (userAccess?.plan_limits?.maxEmployees !== -1 &&
                  employees.length >= (userAccess?.plan_limits?.maxEmployees || 2))
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title={
                userAccess?.plan_limits?.maxEmployees !== -1 &&
                employees.length >= (userAccess?.plan_limits?.maxEmployees || 2)
                  ? `Your plan allows only ${userAccess?.plan_limits?.maxEmployees || 2} employee(s). Upgrade to add more.`
                  : 'Invite a new employee'
              }
            >
              📧 Invite Employee
            </button>
            <button
              onClick={() => fetchEmployees()}
              disabled={loading}
              className="px-6 py-2 border border-card-border rounded-lg text-foreground hover:bg-background font-medium text-sm disabled:opacity-50"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Limit Reached Warning */}
          {userAccess &&
            userAccess.plan_limits?.maxEmployees !== -1 &&
            employees.length >= (userAccess.plan_limits?.maxEmployees || 2) && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  🔒 <span className="font-medium">Employee limit reached</span> - Your{' '}
                  {userAccess.plan_limits?.maxEmployees === 5 ? 'Pro' : 'Starter'} plan allows only{' '}
                  {userAccess.plan_limits?.maxEmployees} employee(s). Upgrade to add more.
                </p>
              </div>
            )}

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
              <div className="text-sm text-muted">Total Employees</div>
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
      </div>

      {/* Modals */}
      <InviteEmployeeModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleInviteSubmit}
        isPlatformStaff={false}
      />

      {/* Invite Link Modal */}
      {showInviteLinkModal && lastInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-card-bg rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Invitation Link</h3>
              <button onClick={() => setShowInviteLinkModal(false)} className="text-muted">✕</button>
            </div>

            <p className="text-sm text-muted mb-3">Share this link with the invited user. It will expire per workspace policy.</p>

            <div className="mb-4">
              <input
                readOnly
                value={
                  lastInvite.token
                    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite?token=${lastInvite.token}`
                    : ''
                }
                className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-foreground"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const link = lastInvite?.token
                    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite?token=${lastInvite.token}`
                    : '';
                  if (link) {
                    navigator.clipboard.writeText(link).then(() => {
                      toast.success('Copied invite link to clipboard');
                    });
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
              >
                Copy Link
              </button>
              <button
                onClick={() => setShowInviteLinkModal(false)}
                className="flex-1 px-4 py-2 border border-card-border rounded-lg text-foreground hover:bg-background font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
export default function EmployeesPage() {
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
      <EmployeesContent />
    </Suspense>
  );
}
