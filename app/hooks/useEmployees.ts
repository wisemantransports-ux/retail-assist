import { useState, useCallback, useEffect } from 'react';

/**
 * Employee data structure from the API
 * Returned from GET /api/employees and GET /api/employees/[id]
 */
export interface Employee {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  email?: string;
  full_name?: string;
  phone?: string;
  role?: string;
}

/**
 * Hook to manage employee CRUD operations
 * Handles fetching, creating, updating, and deleting employees
 *
 * Features:
 * - Lazy-loaded Supabase admin client via API endpoints
 * - Workspace scoping for client admins
 * - Role-based access control (only admins)
 * - Error handling with proper status codes
 *
 * @param workspaceId - Optional workspace ID (null for platform staff, set for client employees)
 */
export function useEmployees(workspaceId: string | null = null) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all employees scoped to workspace
   * For super_admin: workspace_id = null (platform-wide staff)
   * For admin: workspace_id = their workspace (client employees only)
   */
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/employees', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You are not authenticated');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to view employees');
        }
        throw new Error('Failed to fetch employees');
      }

      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch employees';
      setError(message);
      console.error('[useEmployees] Fetch error:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch a single employee by ID
   * WORKSPACE SCOPING: Only returns employees in the current admin's workspace
   */
  const fetchEmployee = useCallback(async (employeeId: string): Promise<Employee | null> => {
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You are not authenticated');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to view this employee');
        }
        if (response.status === 404) {
          throw new Error('Employee not found');
        }
        throw new Error('Failed to fetch employee');
      }

      const data = await response.json();
      return data.employee || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch employee';
      console.error('[useEmployees] Fetch single error:', message);
      throw err;
    }
  }, []);

  /**
   * Create a new employee invite
   *
   * WORKSPACE SCOPING:
   * - For super_admin: workspace_id = null (creates platform-wide invite)
   * - For admin: workspace_id = their workspace_id (creates workspace-scoped invite)
   *
   * ROLE VALIDATION:
   * - Only admins can create invites
   * - Invites are automatically scoped to admin's workspace via RPC
   *
   * @param email - Employee email to invite
   * @param role - Employee role (default: 'employee')
   * @returns Promise<{ success: boolean; invite?: any; error?: string }>
   */
  const createEmployee = useCallback(
    async (
      email: string,
      role: string = 'employee'
    ): Promise<{ success: boolean; invite?: any; error?: string }> => {
      try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return { success: false, error: 'Invalid email format' };
        }

        // Build request payload
        // IMPORTANT: Only send 'email' field
        // The API endpoint rejects 'role' and 'workspace_id' fields
        // Workspace context is inferred server-side from authenticated admin's access
        const payload = {
          email,
        };

        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            return { success: false, error: 'You are not authenticated' };
          }
          if (response.status === 403) {
            return { success: false, error: 'You do not have permission to create employees' };
          }
          if (response.status === 400) {
            return { success: false, error: data.error || 'Invalid request' };
          }
          return { success: false, error: 'Failed to create employee invite' };
        }

        return { success: true, invite: data.invite };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create employee';
        console.error('[useEmployees] Create error:', message);
        return { success: false, error: message };
      }
    },
    [workspaceId]
  );

  /**
   * Update an existing employee
   *
   * WORKSPACE SCOPING:
   * - Only updates employees in the admin's workspace
   * - Cannot change employee's workspace_id (enforced by API)
   *
   * ROLE VALIDATION:
   * - Only admins can update employees
   *
   * @param employeeId - Employee ID to update
   * @param updates - Fields to update (full_name, phone, is_active)
   * @returns Promise<{ success: boolean; employee?: Employee; error?: string }>
   */
  const updateEmployee = useCallback(
    async (
      employeeId: string,
      updates: Partial<Pick<Employee, 'full_name' | 'phone' | 'is_active'>>
    ): Promise<{ success: boolean; employee?: Employee; error?: string }> => {
      try {
        const response = await fetch(`/api/employees/${employeeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            return { success: false, error: 'You are not authenticated' };
          }
          if (response.status === 403) {
            return { success: false, error: 'You do not have permission to update this employee' };
          }
          if (response.status === 404) {
            return { success: false, error: 'Employee not found' };
          }
          return { success: false, error: 'Failed to update employee' };
        }

        // Update local state optimistically
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === employeeId ? { ...emp, ...data.employee } : emp
          )
        );

        return { success: true, employee: data.employee };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update employee';
        console.error('[useEmployees] Update error:', message);
        return { success: false, error: message };
      }
    },
    []
  );

  /**
   * Delete an employee
   *
   * WORKSPACE SCOPING:
   * - Only deletes employees in the admin's workspace
   *
   * ROLE VALIDATION:
   * - Only admins can delete employees
   *
   * @param employeeId - Employee ID to delete
   * @returns Promise<{ success: boolean; error?: string }>
   */
  const deleteEmployee = useCallback(
    async (employeeId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`/api/employees/${employeeId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            return { success: false, error: 'You are not authenticated' };
          }
          if (response.status === 403) {
            return { success: false, error: 'You do not have permission to delete this employee' };
          }
          if (response.status === 404) {
            return { success: false, error: 'Employee not found' };
          }
          return { success: false, error: 'Failed to delete employee' };
        }

        // Update local state optimistically
        setEmployees((prev) => prev.filter((emp) => emp.id !== employeeId));

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete employee';
        console.error('[useEmployees] Delete error:', message);
        return { success: false, error: message };
      }
    },
    []
  );

  return {
    employees,
    loading,
    error,
    fetchEmployees,
    fetchEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}
