'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

/**
 * InviteForm Component
 * 
 * Wrapped in Suspense at the page level to handle useSearchParams()
 */
export default function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('invite');

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate token is present
  useEffect(() => {
    if (!token) {
      toast.error('Invalid invitation link. Token is missing.');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } else {
      console.log('[InviteForm] Token extracted from URL:', {
        token: token,
        token_length: token.length,
        token_preview: token.substring(0, 16),
        contains_percent: token.includes('%'),
        contains_plus: token.includes('+'),
        contains_space: token.includes(' '),
      });
    }
  }, [token, router]);

  if (!token) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent double submission
    if (loading) {
      return;
    }

    // Validate inputs
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      console.log('[InviteForm] Submitting invite acceptance:', { 
        token: token?.substring(0, 8) + '...', 
        email 
      });

      // Token goes in the URL query string, NOT in the request body
      const acceptUrl = `/api/employees/accept-invite?token=${encodeURIComponent(token)}`;
      console.log('[InviteForm] POST to:', acceptUrl);

      const response = await fetch(acceptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          password,
        }),
      });

      console.log('[InviteForm] Response status:', response.status);

      // Safely parse JSON response
      let data: any = null;
      const responseText = await response.text();

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[InviteForm] JSON parse error:', parseError);
          data = {};
        }
      }

      // ===== HANDLE ERROR RESPONSES =====
      
      // 400/401: Invalid or expired invite token
      if (response.status === 400 || response.status === 401) {
        const errorMsg = data?.error || 'Invalid or expired invite';
        console.error('[InviteForm] Invalid invite:', errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      // 409: Duplicate (treat as idempotent success - user might already have accepted)
      if (response.status === 409) {
        console.log('[InviteForm] User already accepted (409 Conflict) - treating as success');
        toast.success('Invite already accepted! Redirecting...');
        // Still redirect to dashboard after a brief delay
        setTimeout(() => {
          router.push('/employees/dashboard');
        }, 1500);
        return;
      }

      // 500: Server error - show generic message, no raw error text
      if (response.status === 500) {
        console.error('[InviteForm] Server error:', data?.error);
        toast.error('Something went wrong. Please try again later.');
        setLoading(false);
        return;
      }

      // ===== HANDLE SUCCESS (200) =====
      
      // For idempotent behavior: success means either new or existing user
      if (!response.ok) {
        const errorMsg = data?.error || `Server error: ${response.status}`;
        console.error('[InviteForm] Request failed:', errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      // Verify success response has required fields
      if (!data?.success) {
        const errorMsg = data?.error || 'Failed to accept invite';
        console.error('[InviteForm] Invite acceptance failed:', errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      // Success: use backend-provided redirect URL
      if (data?.next) {
        console.log('[InviteForm] Invite accepted, redirecting to:', data.next);
        toast.success('Invite accepted! Redirecting to login...');
        setTimeout(() => {
          router.push(data.next);
        }, 1000);
        return;
      }

      // Fallback if next not provided (shouldn't happen)
      console.error('[InviteForm] No next URL provided by backend');
      toast.error('Invalid server response');
      setLoading(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[InviteForm] Caught error:', error);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />

      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Accept Invitation
          </h1>
          <p className="text-gray-600">
            Complete your profile to join the workspace
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
            />
            <p className="text-xs text-gray-600 mt-1">
              Must match the email the invite was sent to
            </p>
          </div>

          {/* First Name Field */}
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              required
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>

          {/* Last Name Field */}
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Last Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
            />
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
            />
            <p className="text-xs text-gray-600 mt-1">
              Minimum 6 characters. Use a strong password with uppercase, lowercase, numbers, and symbols.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>ℹ️ What happens next:</strong> After accepting, you'll be redirected to your workspace dashboard where you can start collaborating with your team.
          </p>
        </div>
      </div>
    </>
  );
}
