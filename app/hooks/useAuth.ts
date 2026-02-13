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
  role: 'super_admin' | 'admin' | 'employee' | 'platform_staff' | string;
}

/**
 * Auth context containing session and access info
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unauthorized';

export interface AuthState {
  session: Session | null;
  access: UserAccess | null;
  role: UserAccess['role'] | null;
  workspaceId: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  status: AuthStatus;
}

// IMPORTANT:
// Supabase Auth only proves identity.
// Authorization is resolved exclusively via /api/auth/me.
// Never render protected UI before /api/auth/me returns 200.

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
    status: 'loading',
  });

  const [status, setStatus] = useState<AuthStatus>('loading');

  // Use refs to prevent multiple simultaneous calls and track hydration
  const initInProgressRef = useRef(false);
  const hasInitialized = useRef(false);
  // Track whether we've observed the first auth state change callback from Supabase
  const firstAuthEventRef = useRef(false);

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
          status: 'unauthenticated',
        }));
        setStatus('unauthenticated');
        hasInitialized.current = true;
        initInProgressRef.current = false;
        return;
      }

      // If SDK reports no session, user is unauthenticated.
      // Do NOT call /api/auth/me for unauthenticated users; it will call rpc_get_user_access
      // which is only meant for authenticated users and may return 403 for non-auth requests.
      // Only call /api/auth/me AFTER a session exists (see below).
      if (!session) {
        console.log('[useAuth] No session found - user is unauthenticated');
        setState((prev) => ({
          ...prev,
          session: null,
          access: null,
          role: null,
          workspaceId: null,
          isLoading: false,
          isError: false,
          errorMessage: null,
          status: 'unauthenticated',
        }));
        setStatus('unauthenticated');
        hasInitialized.current = true;
        initInProgressRef.current = false;
        return;
      }

      // ===== STEP 1: Session confirmed - fetch user access via backend API =====
      console.log('[useAuth] Session confirmed for user:', session.user.id);
      console.log('[useAuth] Step 1: Fetching user access via /api/auth/me...');

      // Helper: fetch with retries for transient 5xx errors
      async function fetchWithRetries(input: RequestInfo, init?: RequestInit, retries = 2, backoffMs = 200) {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const res = await fetch(input, init);
            if (res.ok) return res;
            if (res.status >= 500 && attempt < retries) {
              console.warn('[useAuth] /api/auth/me returned', res.status, '- retrying (attempt', attempt + 1, 'of', retries, ')');
              const wait = backoffMs * Math.pow(2, attempt);
              await new Promise((r) => setTimeout(r, wait));
              continue;
            }
            return res;
          } catch (err) {
            if (attempt < retries) {
              const wait = backoffMs * Math.pow(2, attempt);
              await new Promise((r) => setTimeout(r, wait));
              continue;
            }
            throw err;
          }
        }
        throw new Error('Failed to fetch after retries');
      }

      const meResponse = await fetchWithRetries('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Include cookies in request
      });

      // Distinguish 401 (unauthenticated) vs 403 (authorization failure)
      if (meResponse.status === 401) {
        console.log('[useAuth] /api/auth/me returned 401 - treating as unauthenticated');
        // Clear session and treat as unauthenticated so client can handle login flow
        setState((prev) => ({
          ...prev,
          session: null,
          access: null,
          role: null,
          workspaceId: null,
          isLoading: false,
          isError: false,
          errorMessage: null,
          status: 'unauthenticated',
        }));
        setStatus('unauthenticated');
        hasInitialized.current = true;
        initInProgressRef.current = false;
        return;
      }

      if (meResponse.status === 403) {
        console.log('[useAuth] /api/auth/me returned 403 - user is authenticated but unauthorized');
        setState((prev) => ({
          ...prev,
          session,
          access: null,
          role: null,
          workspaceId: null,
          isLoading: false,
          isError: true,
          errorMessage: `User role not found - ensure user is properly onboarded`,
          status: 'unauthorized',
        }));
        setStatus('unauthorized');
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
        console.error('[useAuth] /api/auth/me server error (', meResponse.status, meResponse.statusText, '):', meError);
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
        status: 'authenticated',
      }));

      // Ensure external consumers relying on `status` see the updated value
      setStatus('authenticated');
      
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

  // Initialize auth on mount (this triggers a getSession() check)
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Subscribe to Supabase auth state changes (SIGNED_IN/SIGNED_OUT) to keep state in sync
  // *Important*: The first onAuthStateChange callback (whichever it is) is considered
  // an indicator that the SDK has hydrated. We treat that event as equivalent to
  // the initial getSession() in terms of turning off `isLoading` if needed.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      console.log('[useAuth] auth state changed:', event);

      // If this is the first auth event we observed, mark it and act as a hydration signal
      if (!firstAuthEventRef.current) {
        firstAuthEventRef.current = true;
        console.info('[useAuth] First auth state change observed; treating as hydration signal:', event);

        if (event === 'SIGNED_IN') {
          // Session became available — initialize to fetch backend role/access
          await initializeAuth();
        } else if (event === 'SIGNED_OUT') {
          // Explicitly set unauthenticated state and clear loading
          setState({
            session: null,
            access: null,
            role: null,
            workspaceId: null,
            isLoading: false,
            isError: false,
            errorMessage: null,
            status: 'unauthenticated',
          });
          setStatus('unauthenticated');
        }

        return;
      }

      // Subsequent events: keep state in sync
      if (event === 'SIGNED_IN') {
        await initializeAuth();
      }
      if (event === 'SIGNED_OUT') {
        setState({
          session: null,
          access: null,
          role: null,
          workspaceId: null,
          isLoading: false,
          isError: false,
          errorMessage: null,
          status: 'unauthenticated',
        });
        setStatus('unauthenticated');
      }
    });

    return () => subscription?.unsubscribe();
  }, [initializeAuth]);

  return { ...state, status } as AuthState;
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
