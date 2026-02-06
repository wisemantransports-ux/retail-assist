'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Plus, AlertCircle } from 'lucide-react';
import SuperAdminInviteEmployeeForm from '@/components/super-admin/SuperAdminInviteEmployeeForm';
import SuperAdminEmployeesTable from '@/components/super-admin/SuperAdminEmployeesTable';

/**
 * Super Admin Employees Management Page
 *
 * Route: /super-admin/employees
 * Role: super_admin only
 *
 * Features:
 * - Invite new platform employees
 * - View all platform employees
 * - Edit employee details
 * - Deactivate employees
 *
 * CRITICAL RULES:
 * 1. Only super_admin can access this page
 * 2. All employees here belong to PLATFORM_WORKSPACE_ID
 * 3. No role-switching options shown
 * 4. No "continue as admin" buttons
 * 5. After invite acceptance, employee redirected to login
 *
 * FLOW:
 * 1. Super admin fills invite form
 * 2. Invite token generated with workspace_id = null (super_admin indicator)
 * 3. Employee receives email link
 * 4. Employee clicks link → redirected to accept-invite
 * 5. Accept-invite → creates user, creates employee row with PLATFORM_WORKSPACE_ID
 * 6. Employee → login page (no auto-switch)
 * 7. Employee logs in → /super-admin/employees dashboard
 */

interface UserAccess {
  role: string;
  workspace_id: string | null;
}

export default function SuperAdminEmployeesPage() {
  const router = useRouter();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [userAccess, setUserAccess] = useState<UserAccess | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [refreshEmployees, setRefreshEmployees] = useState(0);

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
        const role = data.role;
        const workspaceId = data.workspace_id;

        console.log('[SuperAdminEmployeesPage] Resolved role:', role);
        console.log('[SuperAdminEmployeesPage] Workspace ID:', workspaceId);

        // Only super_admin can access this page
        if (role !== 'super_admin') {
          console.warn('[SuperAdminEmployeesPage] Access denied for role:', role);
          router.push('/unauthorized');
          return;
        }

        setUserAccess({ role, workspace_id: workspaceId });
      } catch (error) {
        console.error('[SuperAdminEmployeesPage] Auth check failed:', error);
        router.push('/login');
      } finally {
        setAuthLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  const handleInviteSuccess = () => {
    setShowInviteForm(false);
    // Trigger employees table refresh
    setRefreshEmployees(prev => prev + 1);
    toast.success('Employee invited successfully!');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userAccess || userAccess.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You do not have permission to access this page.</p>
          <button
            onClick={() => router.push('/')}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Platform Employees</h1>
              <p className="text-gray-600 mt-1">Manage all employees for the Retail Assist platform</p>
            </div>
            <button
              onClick={() => setShowInviteForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
            >
              <Plus size={20} />
              Invite Employee
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Invite Form Modal */}
        {showInviteForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Invite Employee</h2>
                <button
                  onClick={() => setShowInviteForm(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="p-6">
                <SuperAdminInviteEmployeeForm
                  onSuccess={handleInviteSuccess}
                  onCancel={() => setShowInviteForm(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Employees Table */}
        <SuperAdminEmployeesTable refreshTrigger={refreshEmployees} />
      </div>
    </div>
  );
}
