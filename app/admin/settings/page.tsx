"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (!res.ok || data.user.role !== 'admin') {
        router.push('/admin/login');
        return;
      }
      
      setAdminEmail(data.user.email);
      setLoading(false);
    } catch {
      router.push('/admin/login');
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords don't match" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: "Password must be at least 6 characters" });
      return;
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Password updated successfully' });
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        throw new Error(data.error);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update password' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white">Dashboard</Link>
            <span className="text-white">/</span>
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
        </div>
      </nav>

      <main className="p-6 max-w-2xl">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Admin Settings</h2>

          {message && (
            <div className={`mb-4 p-3 rounded ${
              message.type === 'success' 
                ? 'bg-green-900/50 border border-green-600 text-green-200' 
                : 'bg-red-900/50 border border-red-600 text-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-1">Admin Email</label>
            <p className="text-white">{adminEmail}</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg"
            >
              Update Password
            </button>
          </form>
        </div>

        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Environment Info</h2>
          <div className="space-y-2 text-gray-400 text-sm">
            <p>Database: File-based JSON Storage</p>
            <p>Data Location: .data/database.json</p>
          </div>
        </div>
      </main>
    </div>
  );
}
