"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuthContext } from '@/lib/auth/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { PLATFORM_WORKSPACE_ID } from "@/lib/config/workspace";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuthContext();
  const hasAutoRedirectRef = useRef(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Perform client-side sign in using the shared browser Supabase client
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.session) {
        console.error('[Login Page] supabase.auth.signInWithPassword error', signInError);
        throw new Error(signInError?.message || 'Sign in failed');
      }

      // Ensure the session is persisted and then ask the backend to mirror the session to cookies
      try {
        const access_token = signInData.session.access_token;
        const refresh_token = signInData.session.refresh_token;

        if (!access_token || !refresh_token) {
          console.error('[Login Page] Missing access or refresh token after sign-in - aborting sync');
          throw new Error('Missing access/refresh token from auth provider');
        }

        const syncRes = await fetch('/api/auth/sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, refresh_token }),
        });

        if (!syncRes.ok) {
          const body = await syncRes.json().catch(() => ({}));
          console.error('[Login Page] /api/auth/sync failed', syncRes.status, body);

          if (syncRes.status === 400 && body?.error === 'Invalid refresh token') {
            // Invalid/rotated refresh token - clear local session and prompt user to re-authenticate
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.warn('[Login Page] supabase.signOut() failed', signOutErr);
            }
            try { sessionStorage.removeItem('auth:recent-redirect'); } catch (e) {}
            setError('Your session expired or became invalid. Please sign in again.');
            setLoading(false);
            return;
          }

          // Fallback logging and continue to /api/auth/me validation which may still work
          console.warn('[Login Page] session sync to server failed:', body || syncRes.status);
        }
      } catch (syncErr) {
        console.warn('[Login Page] session sync to server failed:', syncErr);
        // If the sync failed with an invalid refresh token, show a user-facing error
        if ((syncErr as Error).message?.includes('refresh token')) {
          setError((syncErr as Error).message);
          setLoading(false);
          return;
        }
        // Otherwise, continue and attempt /api/auth/me validation as a fallback
      }

      // Wait briefly for cookies to be written by the sync endpoint
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Call /api/auth/me to ensure backend validates and auth context syncs
      let meResponse = null;
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          meResponse = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include',
          });
          
          if (meResponse.ok) {
            console.log('[Login Page] Auth validation succeeded on attempt', attempt);
            break;
          }
          
          console.warn('[Login Page] Auth validation failed on attempt', attempt, '- retrying...');
          
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (err) {
          lastError = err as Error;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

      if (!meResponse?.ok) {
        throw new Error(`Auth validation failed after login${lastError ? ': ' + lastError.message : ''}`);}


      const meData = await meResponse.json();
      const role = meData.role;
      const workspaceId = meData.workspaceId;

      console.log('[Login Page] Role from /api/auth/me:', role);
      console.log('[Login Page] Workspace ID from /api/auth/me:', workspaceId);

      // Determine redirect target based on role
      let targetPath = '/unauthorized';

      if (role === 'super_admin') {
        targetPath = '/admin';
        console.log('[Login Page] Super admin detected, redirecting to /admin');
      } else if (role === 'platform_staff') {
        targetPath = '/support';
        console.log('[Login Page] Platform staff detected, redirecting to /support');
      } else if (role === 'admin') {
        targetPath = '/dashboard';
        console.log('[Login Page] Client admin detected, redirecting to /dashboard');
      } else if (role === 'employee') {
        // Check if employee belongs to PLATFORM_WORKSPACE_ID
        if (workspaceId === PLATFORM_WORKSPACE_ID) {
          targetPath = '/super-admin/employees';
          console.log('[Login Page] Platform employee detected, redirecting to /super-admin/employees');
        } else {
          targetPath = '/employees/dashboard';
          console.log('[Login Page] Client employee detected, redirecting to /employees/dashboard');
        }
      }

      console.log('[Login Page] Final redirect target:', targetPath);
      // Set a short-lived flag to indicate a login-initiated redirect is in progress
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth:recent-redirect', String(Date.now()));
      }

      // NOW redirect - auth context is confirmed ready
      // Use router.replace to prevent back-button issues
      router.replace(targetPath);
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  }

  // Auto-redirect for already authenticated users who land on the login page
  const { status, role, workspaceId } = useAuth();
  useEffect(() => {
    if (hasAutoRedirectRef.current) return;
    if (pathname !== '/auth/login') return;

    if (status === 'loading') return; // wait for /api/auth/me

    if (status === 'authenticated') {
      // If the session exists but the user's role hasn't been resolved yet,
      // do not auto-redirect to `/unauthorized`. Allow the login UI to render
      // so the user can re-authenticate or complete any recovery steps.
      if (!role) {
        console.log('[Login Page] Authenticated but role unresolved — allowing login UI');
        return;
      }

      hasAutoRedirectRef.current = true;

      // Determine redirect target based on role
      let targetPath = '/unauthorized';
      if (role === 'super_admin') {
        targetPath = '/admin';
      } else if (role === 'platform_staff') {
        targetPath = '/support';
      } else if (role === 'admin') {
        targetPath = '/dashboard';
      } else if (role === 'employee') {
        if (workspaceId === PLATFORM_WORKSPACE_ID) {
          targetPath = '/super-admin/employees';
        } else {
          targetPath = '/employees/dashboard';
        }
      }

      // Mark recent redirect to avoid instant bounce-back from ProtectedRoute
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth:recent-redirect', String(Date.now()));
      }

      console.log('[Login Page] Auto-redirecting already-authenticated user to', targetPath);
      router.replace(targetPath);
    }

    // Note: Do NOT auto-redirect to /unauthorized on this page.
    // If status === 'unauthorized' (authenticated but no role), the user should be able to
    // submit the login form to try again. Only the form submission will determine if they
    // should be redirected to /unauthorized.
  }, [status, role, pathname, router, workspaceId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Sign in to manage your automations</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="flex justify-end">
              <Link href="/auth/reset" className="text-sm text-blue-400 hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="text-center text-gray-400 text-sm">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-blue-400 hover:underline font-semibold">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
