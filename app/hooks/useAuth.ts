'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';

/**
 * User access record returned from rpc_get_user_access
 * Guaranteed to be exactly ONE row or empty
 */
export interface UserAccess {
  user_id: string;
  workspace_id: string | null;
  role: 'super_admin' | 'admin' | 'employee' | string;
}

/**
 * Auth context containing session and access info
 */
export interface AuthState {
  session: Session | null;
  access: UserAccess | null;
  role: UserAccess['role'] | null;
  workspaceId: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
}

/**
 * useAuth Hook
 *
 * Implements the mandatory auth flow (single source of truth via /api/auth/me):
 * 1. Call GET /api/auth/me to check if user has a valid server-side session
 * 2. If 401/403 → user is not authenticated, no session
 * 3. If 200 → /api/auth/me returns role, workspace, and user data
 * 4. Set role, workspaceId, and isLoading=false
 *
 * CRITICAL CONSTRAINTS:
 * - Server uses HttpOnly cookies for session security
 * - Client validates session via /api/auth/me, not client-side Supabase.getSession()
 * - Never hardcode roles or infer from email/cookies
 * - Never call /api/auth/me during SSR or build time
 * - Always handle loading and error states before rendering
 *
 * USAGE:
 * ```tsx
 * const auth = useAuth();
 * if (auth.isLoading) return <LoadingSpinner />;
 * if (auth.isError) return <ErrorPage message={auth.errorMessage} />;
 * if (!auth.session) return <RedirectToLogin />;
 * if (auth.role === 'admin') return <AdminDashboard />;
 * ```
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    access: null,
    role: null,
    workspaceId: null,
    isLoading: true,
    isError: false,
    errorMessage: null,
  });

  // Use ref to prevent multiple simultaneous calls
  const initInProgressRef = useRef(false);
  const hasInitialized = useRef(false);

  /**
   * Initialize auth via /api/auth/me (server-side session validation)
   * Only call once per component mount
   */
  const initializeAuth = useCallback(async () => {
    // Prevent race conditions and multiple initializations
    if (initInProgressRef.current || hasInitialized.current) {
      console.log('[useAuth] Already initialized or initialization in progress, skipping');
      return;
    }

    initInProgressRef.current = true;
    console.log('[useAuth] ===== STARTING AUTH INITIALIZATION =====');

    try {
      // ===== STEP 1: Validate session via backend (single source of truth) =====
      // Server validates the HttpOnly cookies and returns role + workspace
      console.log('[useAuth] STEP 1: Validating session via /api/auth/me...');
      const meResponse = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Include HttpOnly cookies in request
      });

      console.log('[useAuth] /api/auth/me response status:', meResponse.status);

      // 401/403: No valid session, user not authenticated
      if (meResponse.status === 401 || meResponse.status === 403) {
        console.log('[useAuth] No valid session (', meResponse.status, ')');
        setState((prev) => ({
          ...prev,
          session: null,
          access: null,
          role: null,
          workspaceId: null,
          isLoading: false,
          isError: false,
          errorMessage: null,
        }));
        hasInitialized.current = true;
        initInProgressRef.current = false;
        return;
      }

      // Server errors (500+) are real errors
      if (!meResponse.ok) {
        let meError: any = {};
        try {
          meError = await meResponse.json();
        } catch (e) {
          try {
            const text = await meResponse.text();
            meError = { error: text };
          } catch (e2) {
            meError = { error: 'Unknown error' };
          }
        }
        console.error('[useAuth] /api/auth/me server error (', meResponse.status, '):', meError);
        setState((prev) => ({
          ...prev,
          session: null,
          isLoading: false,
          isError: true,
          errorMessage: `Server error (${meResponse.status}): ${meError.error || 'Unknown error'}`,
        }));
        hasInitialized.current = true;
        initInProgressRef.current = false;
        return;
      }

      // Success - user has a valid session and role
      const meData = await meResponse.json();
      console.log('[useAuth] ✓ Session validated successfully, role:', meData.role);

      // Backend validated user and role lookup succeeded
      setState((prev) => ({
        ...prev,
        session: meData.session || { user: meData.user },
        access: meData.access || null,
        role: meData.role || null,
        workspaceId: meData.workspaceId || null,
        isLoading: false,
        isError: false,
        errorMessage: null,
      }));

      console.log('[useAuth] ✓ Auth state updated with role and workspace');
      hasInitialized.current = true;
      initInProgressRef.current = false;
      console.log('[useAuth] ===== AUTH INITIALIZATION COMPLETE =====');
      return;
    } catch (err: any) {
      console.error('[useAuth] Unexpected error:', err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        errorMessage: err?.message || 'Unknown error',
      }));
    } finally {
      initInProgressRef.current = false;
      hasInitialized.current = true;
    }
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return state;
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: string | string[]): boolean {
  const auth = useAuth();
  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(auth.role || '');
}

/**
 * Hook to get the current user's workspace ID
 */
export function useWorkspaceId(): string | null {
  const auth = useAuth();
  return auth.workspaceId;
}
