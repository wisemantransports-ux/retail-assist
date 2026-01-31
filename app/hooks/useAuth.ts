'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
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
 * 1. Call supabase.auth.getSession() to check if browser has auth cookies
 * 2. If no session → user is not authenticated, redirect to /auth/login
 * 3. If session exists → call GET /api/auth/me to fetch authoritative role & workspace
 * 4. If /api/auth/me returns 401/403 → user role not found, show error
 * 5. If /api/auth/me succeeds → set role, workspaceId, and isLoading=false
 *
 * CRITICAL CONSTRAINTS:
 * - Never call /api/auth/me before auth session is ready
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
   * Initialize auth: session → RPC
   * Only call once per component mount
   */
  const initializeAuth = useCallback(async () => {
    // Prevent race conditions and multiple initializations
    if (initInProgressRef.current || hasInitialized.current) {
      return;
    }

    initInProgressRef.current = true;

    try {
      // ===== STEP 0: Check if we have a session first =====
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[useAuth] Session error:', sessionError.message);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          errorMessage: `Session error: ${sessionError.message}`,
        }));
        hasInitialized.current = true;
        initInProgressRef.current = false;
        return;
      }

      // If no session, user is not authenticated
      if (!session) {
        console.log('[useAuth] No session found - user not authenticated');
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

      // ===== STEP 1: Session confirmed - fetch user access via backend API =====
      console.log('[useAuth] Session confirmed for user:', session.user.id);
      console.log('[useAuth] Step 1: Fetching user access via /api/auth/me...');
      const meResponse = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Include cookies in request
      });

      // Handle 401/403 as unauthenticated (no role assigned yet)
      if (meResponse.status === 401 || meResponse.status === 403) {
        console.log('[useAuth] /api/auth/me returned', meResponse.status, '- user role not found');
        setState((prev) => ({
          ...prev,
          session,
          access: null,
          role: null,
          workspaceId: null,
          isLoading: false,
          isError: true,
          errorMessage: `User role not found - ensure user is properly onboarded`,
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
          session,
          isLoading: false,
          isError: true,
          errorMessage: `Server error (${meResponse.status}): ${meError.error || 'Unknown error'}`,
        }));
        hasInitialized.current = true;
        initInProgressRef.current = false;
        return;
      }

      // Success - user has a role
      const meData = await meResponse.json();
      console.log('[useAuth] Backend auth successful:', meData);
      
      // Backend validated user and role lookup succeeded
      setState((prev) => ({
        ...prev,
        session: meData.session || {},
        access: meData.access || null,
        role: meData.role || null,
        workspaceId: meData.workspaceId || null,
        isLoading: false,
        isError: false,
        errorMessage: null,
      }));
      
      hasInitialized.current = true;
      initInProgressRef.current = false;
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
