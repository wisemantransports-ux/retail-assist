'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function InviteEmployee() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Verify user is admin
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();
        setRole(data.role);

        // Only admins can invite
        if (data.role !== 'admin') {
          setError('Admins only');
          router.push('/unauthorized');
          return;
        }
      } catch (err) {
        setError('Failed to verify authorization');
        router.push('/login');
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Create invite via API
      const response = await fetch('/api/employees/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (response.status === 403) {
        setError('You do not have permission to invite employees');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create invite');
      }

      const data = await response.json();
      setSuccess(`Invite sent successfully to ${email}. They will receive an email with instructions to accept.`);
      setEmail('');

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/manage-employees');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Invite Employee</h1>
          <p className="mt-2 text-gray-600">Send an invite link to add a new employee to your workspace</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Employee Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@example.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
            />
            <p className="mt-2 text-xs text-gray-600">
              The employee will receive an email with a link to set up their account
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending Invite...' : 'Send Invite'}
          </button>

          <div className="pt-4 border-t">
            <Link
              href="/dashboard/manage-employees"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ← Back to Employees
            </Link>
          </div>
        </form>

        {/* Security Note */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>WORKSPACE SCOPING:</strong> Invites are automatically scoped to your workspace. The invited employee will only have access to your workspace data after they accept.
          </p>
        </div>
      </div>
    </div>
  );
}
