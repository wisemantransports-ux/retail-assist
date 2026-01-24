'use client';

import { useRouteGuard } from '@/lib/auth/roleBasedRouting';
import { useAuthContext } from '@/lib/auth/AuthProvider';
import Link from 'next/link';

/**
 * Employee App Dashboard
 *
 * Route: /app
 * Access: employee only
 * Purpose: Employee dashboard for client business staff
 *
 * This is the main entry point for employee role users.
 * Middleware will automatically redirect employee users here.
 */
export default function EmployeeAppPage() {
  // Guard this route - only employee can access
  useRouteGuard('employee');

  // Get auth context for additional info
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
          <h1 className="text-3xl font-bold text-gray-900">Employee Dashboard</h1>
          <p className="mt-2 text-gray-600">Your workspace portal</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Auth Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h2 className="font-semibold text-blue-900">Your Information</h2>
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
              <dd className="font-mono text-blue-900 truncate">{auth.workspaceId}</dd>
            </div>
          </dl>
        </div>

        {/* Quick Start */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Messages */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Messages</h3>
            <p className="text-gray-600 text-sm mb-4">View and respond to messages from customers</p>
            <Link
              href="/employees/messages"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition"
            >
              Go to Messages
            </Link>
          </div>

          {/* Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Activity</h3>
            <p className="text-gray-600 text-sm mb-4">Track recent activity in your workspace</p>
            <button
              className="inline-block px-4 py-2 bg-gray-200 text-gray-600 rounded font-medium cursor-not-allowed"
              disabled
            >
              Coming Soon
            </button>
          </div>

          {/* Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Settings</h3>
            <p className="text-gray-600 text-sm mb-4">Manage your account and preferences</p>
            <button
              className="inline-block px-4 py-2 bg-gray-200 text-gray-600 rounded font-medium cursor-not-allowed"
              disabled
            >
              Coming Soon
            </button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Features</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">View messages assigned to you</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">Reply to customer messages</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">Workspace-scoped access</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3">✓</span>
              <span className="text-gray-700">Real-time notifications</span>
            </li>
          </ul>
        </div>

        {/* Implementation Note */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> This is the employee dashboard template. 
            All employee-specific features will be available here.
            Your access is scoped to workspace: <code className="bg-yellow-100 px-1">{auth.workspaceId}</code>
          </p>
        </div>
      </main>
    </div>
  );
}
