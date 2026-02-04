'use client';

// Adapter: re-exports the app-wide useAuth hook with the shape expected by
// Dashboard layouts and other consumers. Returns { status, user, auth, loading }.
import { useAuth as useAuthBase } from '@/hooks/useAuth';

export function useAuth() {
  const base = useAuthBase();

  return {
    // Normalized top-level fields for ease of use in layouts
    status: base.status,
    user: base.role || null ? { role: base.role, workspaceId: base.workspaceId } : null,

    // Keep legacy shape for existing consumers
    auth: {
      authenticated: base.status === 'authenticated',
      user: base.role ? { role: base.role } : null,
    },

    loading: base.isLoading,
  };
}
