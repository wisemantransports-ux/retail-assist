'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Employee {
  id: string;
  user_id: string;
  workspace_id: string;
  is_active: boolean;
  created_at: string;
}

export default function EditEmployee() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // Verify user is admin and fetch employee details
    const fetchData = async () => {
      try {
        // Get user's role
        const roleResponse = await fetch('/api/auth/me');
        if (!roleResponse.ok) {
          router.push('/login');
          return;
        }

        const roleData = await roleResponse.json();
        setRole(roleData.role);

        // Only admins can edit employees
        if (roleData.role !== 'admin') {
          setError('Admins only');
          router.push('/unauthorized');
          return;
        }

        // Fetch employee details
        const employeeResponse = await fetch(`/api/employees/${employeeId}`);

        if (employeeResponse.status === 401) {
          router.push('/login');
          return;
        }

        if (employeeResponse.status === 404) {
          setError('Employee not found or access denied');
          router.push('/dashboard/manage-employees');
          return;
        }

        if (employeeResponse.status === 403) {
          setError('Access denied');
          router.push('/unauthorized');
          return;
        }

        if (!employeeResponse.ok) {
          throw new Error('Failed to fetch employee');
        }

        const data = await employeeResponse.json();
        setEmployee(data.employee);
        setFullName(data.employee.full_name || '');
        setPhone(data.employee.phone || '');
        setIsActive(data.employee.is_active);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [employeeId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          phone: phone || null,
          is_active: isActive,
        }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (response.status === 404) {
        setError('Employee not found');
        return;
      }

      if (response.status === 403) {
        setError('Access denied');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update employee');
      }

      const data = await response.json();
      setSuccess('Employee updated successfully');
      setEmployee(data.employee);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/manage-employees');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading employee details...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Employee Not Found</h1>
          <p className="text-gray-600 mb-6">The employee you're looking for doesn't exist or you don't have access to it.</p>
          <Link href="/dashboard/manage-employees" className="text-blue-600 hover:text-blue-700 font-medium">
            Back to Employees
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Employee</h1>
              <p className="mt-2 text-gray-600">Update employee details</p>
            </div>
            <Link
              href="/dashboard/manage-employees"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back
            </Link>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Read-only fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={employee.user_id}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-600">Cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace ID
                </label>
                <input
                  type="text"
                  value={employee.workspace_id}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-600">Cannot be changed</p>
              </div>
            </div>

            {/* Editable fields */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                Active Employee
              </label>
            </div>

            {/* Metadata */}
            <div className="pt-4 border-t">
              <p className="text-xs text-gray-600">
                Created: {new Date(employee.created_at).toLocaleString()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href="/dashboard/manage-employees"
                className="flex-1 text-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Security Note */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>WORKSPACE SCOPING:</strong> Employees cannot be moved to different workspaces. To assign an employee to a different workspace, create a new invite.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
