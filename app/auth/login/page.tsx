"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// Platform workspace ID for internal Retail Assist staff
const PLATFORM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

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

      // ===== ROLE-BASED CLIENT-SIDE REDIRECT =====
      // Use role and workspace_id from server-resolved auth
      const role = data.user?.role;
      const workspaceId = data.workspaceId;
      
      console.log('[Login Page] Role from API:', role);
      console.log('[Login Page] Workspace ID from API:', workspaceId);

      // Determine redirect target based on role
      let targetPath = '/unauthorized'; // default fallback
      
      if (role === 'super_admin') {
        // Super admin always goes to /admin
        // workspace_id should be NULL
        targetPath = '/admin';
        console.log('[Login Page] Super admin detected, redirecting to /admin');
      } 
      else if (role === 'platform_staff') {
        // Platform staff always goes to /admin/support
        // workspace_id should be PLATFORM_WORKSPACE_ID
        targetPath = '/admin/support';
        console.log('[Login Page] Platform staff detected, redirecting to /admin/support');
      }
      else if (role === 'admin') {
        // Client admin always goes to /dashboard
        // workspace_id should be client workspace id (not null, not platform workspace)
        targetPath = '/dashboard';
        console.log('[Login Page] Client admin detected, redirecting to /dashboard');
      }
      else if (role === 'employee') {
        // Employee always goes to /employees/dashboard
        // workspace_id should be assigned workspace id
        targetPath = '/employees/dashboard';
        console.log('[Login Page] Employee detected, redirecting to /employees/dashboard');
      }

      console.log('[Login Page] Final redirect target:', targetPath);
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
