"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchUserRoleWithRetry } from "@/lib/auth/fetchUserRole";

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
      // STEP 1: Sign in to Supabase
      console.log('[Login Page] Step 1: POST /api/auth/login');
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(loginData.error || 'Login failed');
      }

      console.log('[Login Page] ✓ Login successful');

      // STEP 2: Wait for Supabase cookies to be set
      console.log('[Login Page] Step 2: Waiting 100ms for auth cookies...');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // STEP 3: Fetch user role from /api/auth/me with retries
      console.log('[Login Page] Step 3: Fetching user role from /api/auth/me');
      const roleResult = await fetchUserRoleWithRetry();

      if (!roleResult.success) {
        // Detailed error message to help diagnose
        const diagnostic = [
          'Authentication validation failed.',
          `Error: ${roleResult.error}`,
          'Please check:',
          '1. User exists in Supabase Auth',
          '2. User has role set in database users table',
          '3. Browser allows cookies',
        ].join('\n');
        throw new Error(diagnostic);
      }

      const role = roleResult.role;
      const workspaceId = roleResult.workspaceId;

      console.log('[Login Page] ✓ Role resolved:', { role, workspaceId });

      // STEP 4: Route based on role
      let targetPath = '/unauthorized';

      if (role === 'super_admin') {
        targetPath = '/admin';
        console.log('[Login Page] → Redirecting super_admin to /admin');
      } else if (role === 'platform_staff') {
        targetPath = '/admin/support';
        console.log('[Login Page] → Redirecting platform_staff to /admin/support');
      } else if (role === 'admin') {
        targetPath = '/dashboard';
        console.log('[Login Page] → Redirecting client_admin to /dashboard');
      } else if (role === 'employee') {
        targetPath = '/employees/dashboard';
        console.log('[Login Page] → Redirecting employee to /employees/dashboard');
      }

      console.log('[Login Page] Step 4: Redirecting to', targetPath);
      // CRITICAL: Use router.replace to prevent back button returning to login
      router.replace(targetPath);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to log in';
      console.error('[Login Page] Error:', errorMessage);
      setError(errorMessage);
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
