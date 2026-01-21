import { useState, useCallback } from 'react';

/**
 * Interface for employee invite records
 */
export interface EmployeeInvite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  role?: string;
  workspace_id?: string | null;
  invited_by?: string;
  full_name?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Hook to manage pending employee invites
 * Fetches from employee_invites table
 */
export function usePendingInvites() {
  const [invites, setInvites] = useState<EmployeeInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all pending invites
   */
  const fetchPendingInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/platform-employees/invites', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('You are not authenticated');
        if (response.status === 403) throw new Error('You do not have permission to view invites');
        throw new Error('Failed to fetch invites');
      }

      const data = await response.json();
      setInvites(data.invites || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch pending invites';
      setError(message);
      console.error('[usePendingInvites] Fetch error:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Revoke an invite by ID
   */
  const revokeInvite = useCallback(async (inviteId: string) => {
    try {
      const response = await fetch(`/api/platform-employees/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) return { success: false, error: 'You are not authenticated' };
        if (response.status === 403) return { success: false, error: 'You do not have permission to revoke this invite' };
        if (response.status === 404) return { success: false, error: 'Invite not found' };
        return { success: false, error: 'Failed to revoke invite' };
      }

      // Remove from local state
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke invite';
      console.error('[usePendingInvites] Revoke error:', message);
      return { success: false, error: message };
    }
  }, []);

  /**
   * Resend an invite by ID
   */
  const resendInvite = useCallback(async (inviteId: string) => {
    try {
      const response = await fetch(`/api/platform-employees/invites/${inviteId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) return { success: false, error: 'You are not authenticated' };
        if (response.status === 403) return { success: false, error: 'You do not have permission to resend this invite' };
        if (response.status === 404) return { success: false, error: 'Invite not found' };
        return { success: false, error: 'Failed to resend invite' };
      }

      return { success: true, message: 'Invite resent successfully' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend invite';
      console.error('[usePendingInvites] Resend error:', message);
      return { success: false, error: message };
    }
  }, []);

  return {
    invites,
    loading,
    error,
    fetchPendingInvites,
    revokeInvite,
    resendInvite,
  };
}
