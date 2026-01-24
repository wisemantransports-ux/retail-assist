'use client';

import { useRouteGuard } from '@/lib/auth/roleBasedRouting';
import { useAuthContext } from '@/lib/auth/AuthProvider';
import Link from 'next/link';

/**
 * Platform Admin Dashboard
 *
 * Route: /platform-admin
 * Access: super_admin only
 * Purpose: Retail Assist internal staff can manage the platform
 *
 * This is the main entry point for super_admin role users.
 * Middleware will automatically redirect super_admin users here.
 */
export default function PlatformAdminPage() {
  // Guard this route - only super_admin can access
  useRouteGuard('super_admin');

  // Get auth context for additional info if needed
  const auth = useAuthContext();

  // Show loading while auth is being verified
  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Retail Assist Platform Management</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Auth Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h2 className="font-semibold text-blue-900">Authentication Info</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-blue-700 font-medium">Role</dt>
              <dd className="text-blue-900">{auth.role}</dd>
            </div>
            <div>
              <dt className="text-blue-700 font-medium">User ID</dt>
              <dd className="font-mono text-blue-900 truncate">{auth.session?.user?.id}</dd>
            </div>
            <div>
              <dt className="text-blue-700 font-medium">Email</dt>
              <dd className="text-blue-900">{auth.session?.user?.email}</dd>
            </div>
            <div>
              <dt className="text-blue-700 font-medium">Workspace</dt>
              <dd className="text-blue-900">{auth.workspaceId || 'None (Super Admin)'}</dd>
            </div>
          </dl>
        </div>

        {/* Welcome Section */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Statistics Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Statistics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">Total Workspaces</span>
                <span className="text-2xl font-bold text-blue-600">—</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">Active Users</span>
                <span className="text-2xl font-bold text-green-600">—</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">Platform Staff</span>
                <span className="text-2xl font-bold text-purple-600">—</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Statistics will be populated with actual data</p>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/admin/users"
                className="block w-full p-3 text-left bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700 font-medium transition"
              >
                → Manage Users
              </Link>
              <Link
                href="/admin/settings"
                className="block w-full p-3 text-left bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 text-indigo-700 font-medium transition"
              >
                → Platform Settings
              </Link>
              <Link
                href="/admin/platform-staff"
                className="block w-full p-3 text-left bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 text-purple-700 font-medium transition"
              >
                → Platform Staff
              </Link>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Admin Features</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">View and manage all workspaces</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">Manage workspace admins</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">View platform analytics</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">Manage support staff access</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">System configuration</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">Audit logs</span>
            </li>
          </ul>
        </div>

        {/* Implementation Note */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> This is the platform admin dashboard template. 
            Implement specific platform management features based on your requirements.
          </p>
        </div>
      </main>
    </div>
  );
}
