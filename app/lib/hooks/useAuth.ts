'use client';

import { useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  business_name?: string;
  role: 'super_admin' | 'platform_staff' | 'admin' | 'employee';
  workspace_id: string | null;
  plan_type?: string;
}

interface UseAuthResult {
  user: AuthUser | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and manage current user authentication state
 * Uses RPC-resolved role and workspace_id from /api/auth/me endpoint
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        
        if (response.status === 401) {
          // Not authenticated, redirect to login
          window.location.href = '/login';
          return;
        }

        if (response.status === 403) {
          // Forbidden / no role resolved
          window.location.href = '/unauthorized';
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.statusText}`);
        }

        const data = await response.json();
        setUser(data.user);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return { user, loading, error };
}
