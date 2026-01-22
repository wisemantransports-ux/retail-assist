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
      console.log('[InviteForm] Token from URL:', { 
        token: token?.substring(0, 8) + '...', 
        token_length: token?.length,
        param_name: searchParams.has('token') ? 'token' : searchParams.has('invite') ? 'invite' : 'none',
      });
      console.log('[InviteForm] Submitting invite acceptance:', { token: token?.substring(0, 8) + '...', email, first_name: firstName });

      // Token goes in the URL query string, NOT in the request body
      const acceptUrl = `/api/employees/accept-invite?token=${encodeURIComponent(token)}`;
      console.log('[InviteForm] POST URL:', acceptUrl);
      console.log('[InviteForm] Request payload:', {
        token_in_url: token,
        token_length: token?.length,
        body: {
          email: email.toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          password_length: password.length,
        },
      });

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

      console.log('[InviteForm] Request sent with token in URL:', {
        token_in_url: token?.substring(0, 8) + '...',
        token_length: token?.length,
        body_contains_token: false,
        email_sent: email.toLowerCase(),
      });

      console.log('[InviteForm] Response status:', response.status);
      console.log('[InviteForm] Response content-type:', response.headers.get('content-type'));

      // Safely parse JSON response
      let data = null;
      const responseText = await response.text();
      console.log('[InviteForm] Response body length:', responseText.length);
      console.log('[InviteForm] Response body:', responseText);

      if (responseText) {
        try {
          data = JSON.parse(responseText);
          console.log('[InviteForm] Parsed response:', data);
        } catch (parseError) {
          console.error('[InviteForm] JSON parse error:', parseError);
          console.error('[InviteForm] Response text was:', responseText);
          data = { success: false, error: 'Invalid server response' };
        }
      } else {
        console.warn('[InviteForm] Response body is empty!');
        data = { success: false, error: 'Empty server response' };
      }

      // Check if request failed
      if (!response.ok) {
        const errorMessage = data?.error || `Server error: ${response.status}`;
        console.error('[InviteForm] Error accepting invite:', errorMessage);
        toast.error(errorMessage);
        return;
      }

      // Verify success response has required fields
      if (!data?.success) {
        const errorMessage = data?.error || 'Failed to accept invite';
        console.error('[InviteForm] Invite not accepted:', errorMessage);
        toast.error(errorMessage);
        return;
      }

      // Verify workspace_id is present
      if (!data?.workspace_id) {
        console.error('[InviteForm] No workspace_id in success response:', data);
        toast.error('Invalid server response: missing workspace information');
        return;
      }

      // Success!
      const workspaceId = data.workspace_id;
      const role = data.role || 'employee';
      console.log('[InviteForm] Invite accepted successfully:', { workspaceId, role });

      toast.success('Invite accepted! Redirecting to your dashboard...');

      // Redirect to employee dashboard
      setTimeout(() => {
        const redirectUrl = `/employee/dashboard`;
        console.log('[InviteForm] Redirecting to:', redirectUrl);
        router.push(redirectUrl);
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[InviteForm] Caught error:', error);
      toast.error(errorMessage);
    } finally {
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
