"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { PLATFORM_WORKSPACE_ID } from "@/lib/config/workspace";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      // ===== CRITICAL FIX: Wait for auth context to be ready =====
      // After login succeeds, the backend has set Supabase cookies
      // Give the browser a moment to ensure cookies are fully set
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log('[Login Page] Waiting for auth context to initialize...');

      // Call /api/auth/me to ensure backend validates and auth context syncs
      // Retry up to 3 times with delays to ensure auth is ready
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
        throw new Error(`Auth validation failed after login${lastError ? ': ' + lastError.message : ''}`);
      }

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
        targetPath = '/admin/support';
        console.log('[Login Page] Platform staff detected, redirecting to /admin/support');
      } else if (role === 'admin') {
        targetPath = '/dashboard';
        console.log('[Login Page] Client admin detected, redirecting to /dashboard');
      } else if (role === 'employee') {
        targetPath = '/employees/dashboard';
        console.log('[Login Page] Employee detected, redirecting to /employees/dashboard');
      }

      console.log('[Login Page] Final redirect target:', targetPath);
      // NOW redirect - auth context is confirmed ready
      router.push(targetPath);
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  }

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
