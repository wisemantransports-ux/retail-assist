'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface SuperAdminInviteEmployeeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Super Admin Invite Employee Form
 * 
 * Features:
 * - Invite by email
 * - Optional first name
 * - All invites automatically get workspace_id = PLATFORM_WORKSPACE_ID
 * - No role selection (always employee)
 * - Direct API call to /api/super-admin/employees/invite
 * 
 * Invite Flow:
 * 1. Form submitted with email
 * 2. API creates invite record with workspace_id = null (super_admin indicator)
 * 3. Employee receives invite link
 * 4. Clicking link → /invite?token=xxx
 * 5. Employee fills form (first_name, password)
 * 6. Submits to /api/employees/accept-invite?token=xxx
 * 7. Accept endpoint creates user + employee row with PLATFORM_WORKSPACE_ID
 * 8. Frontend redirects to login
 * 9. Employee logs in → gets PLATFORM_WORKSPACE_ID → redirected to /super-admin/employees
 */
export default function SuperAdminInviteEmployeeForm({
  onSuccess,
  onCancel,
}: SuperAdminInviteEmployeeFormProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/super-admin/employees/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          first_name: firstName.trim() || null,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || 'Failed to send invite');
        setLoading(false);
        return;
      }

      console.log('[SuperAdminInviteForm] Invite sent:', {
        email: data.email,
        token: data.token?.substring(0, 16) + '...',
      });

      // Reset form
      setEmail('');
      setFirstName('');

      // Notify parent
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('[SuperAdminInviteForm] Error:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email Address *
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="employee@example.com"
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
          required
        />
      </div>

      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
          First Name (Optional)
        </label>
        <input
          id="firstName"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          disabled={loading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Sending...' : 'Send Invite'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-50 disabled:cursor-not-allowed font-medium transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
