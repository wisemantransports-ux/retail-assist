'use client';

import { useState, useEffect } from 'react';
import { Employee } from '@/hooks/useEmployees';

interface EditEmployeeModalProps {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSubmit: (
    employeeId: string,
    updates: Partial<Pick<Employee, 'full_name' | 'phone' | 'is_active'>>
  ) => Promise<boolean>;
}

/**
 * EditEmployeeModal Component
 *
 * Modal form for editing existing employee details
 *
 * Features:
 * - Edit full_name, phone, and active status
 * - Cannot change workspace_id (enforced by API)
 * - Cannot change email (shown as read-only)
 * - Optimistic UI updates
 * - Loading states during submission
 * - Error/success messaging
 *
 * WORKSPACE SCOPING:
 * - API endpoint enforces workspace_id cannot be changed
 * - Employee data must already be in admin's workspace
 * - Attempting to edit cross-workspace employees returns 404
 *
 * ROLE VALIDATION:
 * - Only admins can edit employees
 * - RPC enforces authorization at API level
 */
export default function EditEmployeeModal({
  isOpen,
  employee,
  onClose,
  onSubmit,
}: EditEmployeeModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Populate form with employee data when modal opens
  useEffect(() => {
    if (isOpen && employee) {
      setFullName(employee.full_name || '');
      setPhone(employee.phone || '');
      setIsActive(employee.is_active);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setError(null);
    setSuccess(false);

    // Validate full name if provided
    if (fullName.trim().length > 0 && fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters');
      return;
    }

    setLoading(true);
    try {
      const updates: Partial<Pick<Employee, 'full_name' | 'phone' | 'is_active'>> = {};

      if (fullName !== (employee.full_name || '')) {
        updates.full_name = fullName;
      }
      if (phone !== (employee.phone || '')) {
        updates.phone = phone;
      }
      if (isActive !== employee.is_active) {
        updates.is_active = isActive;
      }

      // If nothing changed, just close
      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      const result = await onSubmit(employee.id, updates);

      if (result) {
        setSuccess(true);

        // Auto-close after success message
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 1500);
      } else {
        setError('Failed to update employee. Please try again.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-card-bg rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Edit Employee</h2>
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
            ✓ Employee updated successfully!
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
          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email (Cannot change)
            </label>
            <input
              type="email"
              value={employee.email || 'N/A'}
              disabled
              className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-muted opacity-60 cursor-not-allowed"
            />
            <p className="text-xs text-muted mt-1">
              Email is locked and cannot be changed. Create a new invite if needed.
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setError(null);
              }}
              placeholder="John Doe"
              disabled={loading}
              maxLength={255}
              className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              disabled={loading}
              className="w-full px-4 py-2 border border-card-border rounded-lg bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Active Status */}
          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border border-card-border cursor-pointer accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm font-medium text-foreground">
                Active
              </span>
            </label>
            <p className="text-xs text-muted mt-2 ml-7">
              {isActive
                ? 'This employee can access the platform'
                : 'This employee cannot access the platform'}
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
                  Saving...
                </>
              ) : (
                '💾 Save Changes'
              )}
            </button>
          </div>
        </form>

        {/* Info Text */}
        <p className="text-xs text-muted mt-4 pt-4 border-t border-card-border">
          Changes are saved immediately. You cannot change the workspace for this employee.
        </p>
      </div>
    </div>
  );
}
