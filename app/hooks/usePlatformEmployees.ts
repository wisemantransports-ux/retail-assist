import { useState, useCallback } from 'react';

export interface PlatformEmployee {
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

export function usePlatformEmployees() {
  const [employees, setEmployees] = useState<PlatformEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/platform-employees', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('You are not authenticated');
        if (response.status === 403) throw new Error('You do not have permission to view platform staff');
        throw new Error('Failed to fetch platform staff');
      }

      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch platform staff';
      setError(message);
      console.error('[usePlatformEmployees] Fetch error:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createEmployee = useCallback(async (
    email: string,
    role: string = 'employee'
  ) => {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return { success: false, error: 'Invalid email format' };

      const response = await fetch('/api/platform-employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        // CRITICAL: Use the ACTUAL backend error message
        const backendError = data.error;
        
        if (backendError) {
          console.error('[usePlatformEmployees] Backend error (status', response.status + '):', backendError);
          return { success: false, error: backendError };
        }

        if (response.status === 401) {
          console.error('[usePlatformEmployees] Authentication error');
          return { success: false, error: 'You are not authenticated' };
        }
        if (response.status === 403) {
          console.error('[usePlatformEmployees] Authorization error');
          return { success: false, error: 'You do not have permission to create platform staff' };
        }

        console.error('[usePlatformEmployees] Unexpected error (status', response.status + '):', data);
        return { success: false, error: `Request failed with status ${response.status}` };
      }

      return { success: true, invite: data.invite };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      console.error('[usePlatformEmployees] Create error:', message);
      return { success: false, error: message };
    }
  }, []);

  const updateEmployee = useCallback(async (employeeId: string, updates: Partial<PlatformEmployee>) => {
    try {
      const response = await fetch(`/api/platform-employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) return { success: false, error: 'You are not authenticated' };
        if (response.status === 403) return { success: false, error: 'You do not have permission to update this platform staff' };
        if (response.status === 404) return { success: false, error: 'Employee not found' };
        return { success: false, error: 'Failed to update platform staff' };
      }

      setEmployees((prev) => prev.map((e) => (e.id === employeeId ? { ...e, ...data.employee } : e)));
      return { success: true, employee: data.employee };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update platform staff';
      console.error('[usePlatformEmployees] Update error:', message);
      return { success: false, error: message };
    }
  }, []);

  const deleteEmployee = useCallback(async (employeeId: string) => {
    try {
      const response = await fetch(`/api/platform-employees/${employeeId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) return { success: false, error: 'You are not authenticated' };
        if (response.status === 403) return { success: false, error: 'You do not have permission to delete this platform staff' };
        if (response.status === 404) return { success: false, error: 'Employee not found' };
        return { success: false, error: 'Failed to delete platform staff' };
      }

      setEmployees((prev) => prev.filter((e) => e.id !== employeeId));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete platform staff';
      console.error('[usePlatformEmployees] Delete error:', message);
      return { success: false, error: message };
    }
  }, []);

  return {
    employees,
    loading,
    error,
    fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}
