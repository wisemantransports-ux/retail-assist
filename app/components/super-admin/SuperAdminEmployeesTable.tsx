'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Edit2, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { PLATFORM_WORKSPACE_ID } from '@/lib/config/workspace';

interface Employee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  created_at: string;
  workspace_id: string;
}

interface SuperAdminEmployeesTableProps {
  refreshTrigger?: number;
}

/**
 * Super Admin Employees Table
 *
 * Displays all employees in PLATFORM_WORKSPACE_ID
 *
 * Features:
 * - View all platform employees
 * - Edit employee details (name, status)
 * - Deactivate employees
 * - Automatic refresh on invite success
 *
 * API Integration:
 * - GET /api/super-admin/employees → list all platform employees
 * - PUT /api/super-admin/employees/[id] → update employee
 * - DELETE /api/super-admin/employees/[id] → deactivate employee
 */
export default function SuperAdminEmployeesTable({ refreshTrigger = 0 }: SuperAdminEmployeesTableProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ first_name: string; last_name: string } | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchEmployees();
  }, [refreshTrigger]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/super-admin/employees', {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data?.error || 'Failed to load employees');
        return;
      }

      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error('[SuperAdminEmployeesTable] Fetch error:', err);
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (employeeId: string) => {
    if (!editData) return;

    try {
      const response = await fetch(`/api/super-admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data?.error || 'Failed to update employee');
        return;
      }

      toast.success('Employee updated successfully');
      setEditingId(null);
      setEditData(null);
      fetchEmployees();
    } catch (err) {
      console.error('[SuperAdminEmployeesTable] Update error:', err);
      toast.error('Failed to update employee');
    }
  };

  const handleDeactivate = async (employeeId: string, email: string) => {
    if (!confirm(`Are you sure you want to deactivate ${email}?`)) {
      return;
    }

    try {
      setDeleting(prev => ({ ...prev, [employeeId]: true }));

      const response = await fetch(`/api/super-admin/employees/${employeeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data?.error || 'Failed to deactivate employee');
        return;
      }

      toast.success('Employee deactivated');
      fetchEmployees();
    } catch (err) {
      console.error('[SuperAdminEmployeesTable] Delete error:', err);
      toast.error('Failed to deactivate employee');
    } finally {
      setDeleting(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Loader2 size={32} className="animate-spin mx-auto text-blue-600" />
        <p className="text-gray-600 mt-4">Loading employees...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-start gap-4">
          <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Error</h3>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={fetchEmployees}
              className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4">
          <CheckCircle size={24} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Employees Yet</h3>
        <p className="text-gray-600">You haven't invited any employees yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map(employee => (
              <tr key={employee.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-900 font-medium">{employee.email}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {editingId === employee.id && editData ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editData.first_name}
                        onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                        placeholder="First name"
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={editData.last_name}
                        onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                        placeholder="Last name"
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    `${employee.first_name || '—'} ${employee.last_name || ''}`.trim() || '—'
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      employee.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {employee.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(employee.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex gap-2">
                    {editingId === employee.id ? (
                      <>
                        <button
                          onClick={() => handleEditSubmit(employee.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditData(null);
                          }}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(employee.id);
                            setEditData({
                              first_name: employee.first_name || '',
                              last_name: employee.last_name || '',
                            });
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-medium transition"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(employee.id, employee.email)}
                          disabled={deleting[employee.id]}
                          className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded text-xs font-medium transition disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          {deleting[employee.id] ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Deactivate
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
