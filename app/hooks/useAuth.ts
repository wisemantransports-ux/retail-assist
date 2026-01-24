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
 * Implements the mandatory auth flow:
 * 1. Call supabase.auth.getSession()
 * 2. If no session → isLoading becomes false, isError false, session null
 * 3. After session is confirmed, call supabase.rpc('rpc_get_user_access')
 * 4. If RPC returns no rows → treat as unauthorized
 *
 * CRITICAL CONSTRAINTS:
 * - Never call RPC before auth session is ready
 * - Never hardcode roles
 * - Never infer access from email
 * - Never call RPC during SSR or build time
 * - Always handle loading and error states
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
      // ===== STEP 0: Try backend API first (most reliable after login) =====
      console.log('[useAuth] Step 0: Checking backend /api/auth/me...');
      const meResponse = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Include cookies in request
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        console.log('[useAuth] Backend auth successful:', meData);
        
        // Backend validated user and RPC succeeded
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
      }

      // Backend returned error - fall back to direct Supabase auth
      console.log('[useAuth] Backend auth failed, falling back to Supabase.auth.getSession()');

      const supabase = createBrowserSupabaseClient();

      // ===== STEP 1: Get session =====
      console.log('[useAuth] Step 1: Checking session...');
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
        return;
      }

      console.log('[useAuth] Session confirmed for user:', session.user.id);

      // ===== STEP 2: Call RPC to get access =====
      console.log('[useAuth] Step 2: Fetching user access via RPC...');
      const {
        data: userAccess,
        error: rpcError,
      } = await supabase.rpc('rpc_get_user_access');

      if (rpcError) {
        console.error('[useAuth] RPC error:', rpcError.message);
        setState((prev) => ({
          ...prev,
          session,
          isLoading: false,
          isError: true,
          errorMessage: `Failed to fetch access: ${rpcError.message}`,
        }));
        return;
      }

      // ===== STEP 3: Check RPC result =====
      // RPC returns exactly one row or empty
      const accessRecord = userAccess?.[0];

      if (!accessRecord) {
        console.warn('[useAuth] RPC returned no rows - user is unauthorized');
        setState((prev) => ({
          ...prev,
          session,
          access: null,
          role: null,
          workspaceId: null,
          isLoading: false,
          isError: true,
          errorMessage: 'User access not found - unauthorized',
        }));
        return;
      }

      const { role, workspace_id } = accessRecord;

      // Validate role is one of the allowed roles
      const validRoles = ['super_admin', 'admin', 'employee'];
      if (!validRoles.includes(role)) {
        console.error('[useAuth] Invalid role from RPC:', role);
        setState((prev) => ({
          ...prev,
          session,
          isLoading: false,
          isError: true,
          errorMessage: `Invalid role: ${role}`,
        }));
        return;
      }

      console.log('[useAuth] User authenticated with role:', role, 'workspace:', workspace_id);

      // ===== SUCCESS: Update state =====
      setState((prev) => ({
        ...prev,
        session,
        access: accessRecord,
        role,
        workspaceId: workspace_id,
        isLoading: false,
        isError: false,
        errorMessage: null,
      }));
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
