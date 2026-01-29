'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Loader2, CheckCircle, LogOut } from 'lucide-react';

/**
 * InviteForm Component
 * 
 * Wrapped in Suspense at the page level to handle useSearchParams()
 * 
 * CRITICAL: Session Purity Rules
 * - Invite acceptance ONLY creates an employee record
 * - Does NOT authenticate or change existing sessions
 * - If user is already authenticated (as admin):
 *   → Show success message + logout button
 *   → Do NOT redirect to employee dashboard
 * - If user is NOT authenticated:
 *   → Redirect to /login?role=employee
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [successState, setSuccessState] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        setIsAuthenticated(response.ok);
        console.log('[InviteForm] Auth check:', response.ok ? 'Authenticated' : 'Not authenticated');
      } catch (error) {
        console.log('[InviteForm] Auth check failed, user not authenticated');
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // Validate token is present
  useEffect(() => {
    if (!token) {
      toast.error('Invalid invitation link. Token is missing.');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } else {
      console.log('[InviteForm] Token extracted from URL:', {
        token_length: token.length,
        token_preview: token.substring(0, 16),
      });
    }
  }, [token, router]);

  if (!token || isAuthenticated === null) {
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
        email,
        isAuthenticated,
      });

      // Token goes in the URL query string
      const acceptUrl = `/api/employees/accept-invite?token=${encodeURIComponent(token)}`;

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
      
      if (response.status === 400 || response.status === 401) {
        const errorMsg = data?.error || 'Invalid or expired invite';
        console.error('[InviteForm] Invalid invite:', errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      if (response.status === 409) {
        console.log('[InviteForm] Employee already exists (409 Conflict)');
        toast.error('Employee record already exists. Please log out and sign in with your employee email.');
        setLoading(false);
        return;
      }

      if (response.status === 500) {
        console.error('[InviteForm] Server error:', data?.error);
        toast.error('Something went wrong. Please try again later.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorMsg = data?.error || `Server error: ${response.status}`;
        console.error('[InviteForm] Request failed:', errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      // Verify success response
      if (!data?.success) {
        const errorMsg = data?.error || 'Failed to accept invite';
        console.error('[InviteForm] Invite acceptance failed:', errorMsg);
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      console.log('[InviteForm] Invite accepted successfully:', {
        employee_id: data.employee_id,
        auth_uid: data.auth_uid,
        email: data.email,
      });

      // ===== CRITICAL: SESSION PURITY LOGIC =====
      // RULE: Invite acceptance does NOT authenticate or redirect
      // UX depends on whether user is already authenticated
      
      if (isAuthenticated) {
        // User is logged in as admin - show success with logout option
        console.log('[InviteForm] User is authenticated, showing success with logout option');
        setSuccessState(true);
        toast.success('Employee account created successfully!');
      } else {
        // User is not authenticated - redirect to login
        console.log('[InviteForm] User is not authenticated, redirecting to login');
        toast.success('Employee account created! Redirecting to login...');
        setTimeout(() => {
          router.push('/login?role=employee');
        }, 1000);
      }
      
      setLoading(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('[InviteForm] Caught error:', error);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  // ===== RENDER: SUCCESS STATE FOR AUTHENTICATED USERS =====
  if (successState && isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Success!
            </h1>
            <p className="text-gray-600">
              Employee account has been created successfully.
            </p>
          </div>

          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 text-sm">
              You are currently logged in as an administrator. To access the employee dashboard, please log out and sign in using your employee email address.
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => {
              // Call logout endpoint
              fetch('/api/auth/logout', { method: 'POST' })
                .then(() => {
                  toast.success('Logged out. Redirecting to login...');
                  setTimeout(() => {
                    router.push('/login?role=employee');
                  }, 1000);
                })
                .catch(() => {
                  router.push('/login?role=employee');
                });
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Log Out & Sign In as Employee
          </button>

          {/* Skip Button */}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full mt-3 text-gray-600 hover:text-gray-700 font-medium py-2 transition-colors"
          >
            Continue as Administrator
          </button>
        </div>
      </>
    );
  }

  // ===== RENDER: FORM FOR UNAUTHENTICATED USERS =====
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
              Minimum 6 characters
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
            <strong>ℹ️ What happens next:</strong> After accepting, you'll be redirected to login. Sign in with your employee email to access your workspace.
          </p>
        </div>
      </div>
    </>
  );
}
