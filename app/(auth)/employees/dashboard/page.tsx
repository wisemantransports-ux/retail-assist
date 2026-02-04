'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Workspace {
  id: string;
  name: string;
  created_at?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string;
  priority: 'low' | 'medium' | 'high';
}

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  created_at: string;
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // AUTHORIZATION: Fetch user role and workspace_id from authoritative source
        const roleResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!roleResponse.ok) {
          // 401: Session invalid or expired - redirect to login
          if (roleResponse.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch user role');
        }

        const roleData = await roleResponse.json();

        // ROLE VALIDATION: Only employees can access this dashboard
        if (roleData.role !== 'employee') {
          // Non-employees are redirected to /unauthorized
          router.push('/unauthorized');
          return;
        }

        // WORKSPACE SCOPING: Verify workspace_id exists (employee must be scoped to ONE workspace)
        if (!roleData.workspace_id) {
          // This should never happen due to database constraints, but we validate anyway
          setError('Employee not assigned to a workspace. Contact your administrator.');
          setLoading(false);
          return;
        }

        setRole(roleData.role);
        setWorkspaceId(roleData.workspace_id);

        // WORKSPACE SCOPING: Fetch workspace details scoped to this employee's workspace
        // The API endpoint validates that the workspace belongs to the employee's workspace_id
        const workspaceResponse = await fetch(
          `/api/workspaces/${roleData.workspace_id}`,
          {
            credentials: 'include',
          }
        );

        if (workspaceResponse.ok) {
          const workspaceData = await workspaceResponse.json();
          setWorkspace(workspaceData.workspace);
        } else if (workspaceResponse.status === 403) {
          // Employee doesn't have access to this workspace
          setError('You do not have permission to access this workspace.');
        }

        // WORKSPACE SCOPING: Fetch tasks assigned to this employee in their workspace
        // This endpoint should filter by:
        // - assigned_to = current user
        // - workspace_id = employee's workspace
        // Server-side API validation ensures no cross-workspace data leakage
        const tasksResponse = await fetch('/api/tasks?assigned_to=me', {
          credentials: 'include',
        });

        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          setTasks(tasksData.tasks || []);
        } else if (tasksResponse.status === 401) {
          router.push('/auth/login');
          return;
        }

        // WORKSPACE SCOPING: Fetch notifications for this employee in their workspace
        // Notifications are scoped to the employee's workspace by the API endpoint
        const notificationsResponse = await fetch('/api/notifications', {
          credentials: 'include',
        });

        if (notificationsResponse.ok) {
          const notificationsData = await notificationsResponse.json();
          setNotifications(notificationsData.notifications || []);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load dashboard'
        );
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-red-900 mb-2">Error</h1>
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!role || role !== 'employee') {
    // ROLE VALIDATION: Non-employees cannot see this page
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-yellow-900 mb-2">
              Unauthorized
            </h1>
            <p className="text-yellow-700">
              You don't have permission to access this page.
            </p>
            <Link
              href="/unauthorized"
              className="mt-4 inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Go to Unauthorized Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Dashboard
              </h1>
              {workspace && (
                <p className="mt-2 text-gray-600">
                  Workspace: <span className="font-semibold">{workspace.name}</span>
                </p>
              )}
              {/* WORKSPACE SCOPING: Display workspace ID for debugging/verification */}
              {workspaceId && (
                <p className="mt-1 text-sm text-gray-500">
                  Workspace ID: {workspaceId}
                </p>
              )}
            </div>
            <div>
              <Link
                href="/auth/logout"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notifications Section */}
        {notifications.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Notifications
            </h2>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    notification.type === 'info'
                      ? 'bg-blue-50 border-blue-200'
                      : notification.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <p
                    className={`text-sm ${
                      notification.type === 'info'
                        ? 'text-blue-700'
                        : notification.type === 'warning'
                        ? 'text-yellow-700'
                        : 'text-green-700'
                    }`}
                  >
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Assigned Tasks
            </h2>
            <div className="text-sm text-gray-600">
              {tasks.filter((t) => t.status !== 'completed').length} active
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                No tasks assigned yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* WORKSPACE SCOPING: Tasks are filtered server-side to show only
                  tasks assigned to this employee in their workspace. The API
                  endpoint validates workspace_id matches the employee's workspace. */}
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {task.title}
                    </h3>
                    <div className="flex gap-2">
                      {/* Priority Badge */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          task.priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : task.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {(task.priority || '').charAt(0).toUpperCase() + (task.priority || '').slice(1)}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          task.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {task.status === 'in_progress'
                          ? 'In Progress'
                          : (task.status || '').charAt(0).toUpperCase() +
                            (task.status || '').slice(1)}
                      </span>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-gray-600 text-sm mb-3">
                      {task.description}
                    </p>
                  )}

                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>
                      Due:{' '}
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                    <button className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            {/* SECURITY NOTE: This dashboard is scoped to your assigned workspace.
                You can only view data from: {workspace?.name || 'Your workspace'}
                Contact your workspace administrator for support. */}
            This dashboard displays data only from your assigned workspace.{' '}
            <span className="font-semibold">
              You cannot access other workspace data.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
