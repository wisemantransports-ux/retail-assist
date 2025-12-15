'use client';

import { useState } from 'react';

interface InviteMemberFormProps {
  workspaceId: string;
  userRole: string;
}

/**
 * InviteMemberForm Component
 * Form for inviting new members to workspace
 */
export default function InviteMemberForm({
  workspaceId,
  userRole,
}: InviteMemberFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!email || !role) {
      setError('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          email,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send invite');
      } else {
        setSuccess(`Invitation sent to ${email}`);
        setEmail('');
        setRole('staff');
      }
    } catch (err) {
      setError('Failed to send invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-md">
      <div className="space-y-4">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={loading}
            className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Role Dropdown */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="staff">Staff (Limited access)</option>
            <option value="admin">Admin (Full access)</option>
            {userRole === 'owner' && (
              <option value="owner">Owner (All access)</option>
            )}
          </select>
          <p className="text-xs text-muted mt-1">
            {role === 'staff'
              ? 'Can view and manage comments'
              : role === 'admin'
                ? 'Can manage agents, automation, and members'
                : 'Full workspace control'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> The invited person will receive an email with a link to join the workspace.
          They can accept the invitation from the signup page.
        </p>
      </div>
    </form>
  );
}
