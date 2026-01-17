'use client';

import { useState } from 'react';

interface InviteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: string) => Promise<boolean>;
  isPlatformStaff?: boolean;
}

/**
 * InviteEmployeeModal Component
 *
 * Modal form for inviting new employees
 *
 * Used by:
 * - Super Admin: invites platform staff (workspace_id = null)
 * - Client Admin: invites workspace employees (workspace_id = their workspace)
 *
 * Features:
 * - Email validation
 * - Role selection (employee, admin)
 * - Loading states during submission
 * - Error/success messaging
 * - Accessible keyboard navigation
 *
 * WORKSPACE SCOPING:
 * - Form submission payload is built by parent component
 * - This component only collects email and role
 * - API endpoint determines workspace_id from authenticated user context
 *
 * ROLE VALIDATION:
 * - Only admins can access the page containing this modal
 * - RPC enforces authorization at API level
 */
export default function InviteEmployeeModal({
  isOpen,
  onClose,
  onSubmit,
  isPlatformStaff = false,
}: InviteEmployeeModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate role
    if (!role) {
      setError('Role is required');
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit(email, role);

      if (result) {
        setSuccess(true);
        setEmail('');
        setRole('employee');

        // Auto-close after success message
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 2000);
      } else {
        setError('Failed to send invite. Please try again.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-card-bg rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Invite {isPlatformStaff ? 'Platform Staff' : 'Employee'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted hover:text-foreground disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-200 rounded text-green-800 text-sm">
            ✓ Invitation sent successfully! The user will receive an email with next steps.
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded text-red-800 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="employee@example.com"
              disabled={loading}
              autoFocus
              className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Role Dropdown */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="employee">Employee (Limited access)</option>
              <option value="admin">Admin (Full access)</option>
            </select>
            <p className="text-xs text-muted mt-1">
              {role === 'admin'
                ? 'Admin can manage employees and settings'
                : 'Employee has read-only access to assigned items'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-card-border rounded-lg text-foreground hover:bg-background disabled:opacity-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                '📧 Send Invite'
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <p className="text-xs text-muted mt-4 pt-4 border-t border-card-border">
          The invitation will be valid for 30 days. The user will need to verify their email
          address after accepting the invite.
        </p>
      </div>
    </div>
  );
}
