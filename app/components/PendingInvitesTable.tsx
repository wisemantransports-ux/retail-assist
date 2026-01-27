'use client';

import React, { useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Copy, Check } from 'lucide-react';

/**
 * TypeScript interface for employee invite records
 */
interface EmployeeInvite {
  id: string;
  email: string;
  status: string;
  created_at?: string;
  role?: string;
  workspace_id?: string | null;
  invited_by?: string;
  full_name?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Props interface for the PendingInvitesTable component
 */
interface PendingInvitesTableProps {
  platformEmployees: EmployeeInvite[];
  appBaseUrl?: string;
  onInviteAction?: (inviteId: string, action: 'copy' | 'revoke' | 'resend') => void;
}

/**
 * PendingInvitesTable Component
 * Displays a table of employee invites with action buttons to copy invitation links
 *
 * Features:
 * - Shows email, status, and action columns
 * - Copy-to-clipboard functionality with toast notifications
 * - Dynamic button state (Copy -> Copied!)
 * - Filters to show only pending invites
 * - Responsive design with TailwindCSS
 *
 * @param platformEmployees - Array of employee invite records
 * @param appBaseUrl - Base URL of the application (defaults to window.location.origin)
 * @param onInviteAction - Optional callback for tracking actions
 */
export const PendingInvitesTable: React.FC<PendingInvitesTableProps> = ({
  platformEmployees,
  appBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.com',
  onInviteAction,
}) => {
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  /**
   * Generates the invitation link for an invite
   */
  const generateInviteLink = useCallback(
    (token: string): string => {
      return `${appBaseUrl}/invite?token=${token}`;
    },
    [appBaseUrl]
  );

  /**
   * Copies the invite link to clipboard
   */
  const handleCopyLink = useCallback(
    async (invite: EmployeeInvite) => {
      const inviteLink = generateInviteLink(invite.token || invite.id);

      try {
        // Copy to clipboard
        await navigator.clipboard.writeText(inviteLink);

        // Show success toast
        toast.success('Invite link copied!', {
          duration: 3000,
          position: 'top-right',
          icon: '✓',
        });

        // Update button state
        setCopiedInviteId(invite.id);

        // Call optional callback
        onInviteAction?.(invite.id, 'copy');

        // Reset button state after 2 seconds
        setTimeout(() => {
          setCopiedInviteId(null);
        }, 2000);
      } catch (error) {
        console.error('Failed to copy invite link:', error);
        toast.error('Failed to copy link', {
          duration: 3000,
          position: 'top-right',
          icon: '✗',
        });
      }
    },
    [generateInviteLink, onInviteAction]
  );

  /**
   * Filter to show only pending invites
   */
  const pendingInvites = platformEmployees.filter(
    (invite) => invite.status === 'pending'
  );

  // If no pending invites, show empty state
  if (pendingInvites.length === 0) {
    return (
      <div className="p-8 text-center">
        <Toaster position="top-right" />
        <p className="text-gray-500 text-sm">No pending invites at the moment.</p>
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification Container */}
      <Toaster position="top-right" />

      {/* Table Container */}
      <div className="w-full overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="w-full text-left text-sm">
          {/* Table Header */}
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-semibold text-gray-700">Email</th>
              <th className="px-6 py-3 font-semibold text-gray-700">Status</th>
              <th className="px-6 py-3 font-semibold text-gray-700">Created At</th>
              <th className="px-6 py-3 font-semibold text-gray-700 text-right">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-gray-200">
            {pendingInvites.map((invite) => (
              <tr key={invite.id} className="hover:bg-gray-50 transition-colors">
                {/* Email Column */}
                <td className="px-6 py-4 text-gray-900 font-medium">
                  {invite.email}
                </td>

                {/* Status Column */}
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {invite.status}
                  </span>
                </td>

                {/* Created At Column */}
                <td className="px-6 py-4 text-gray-600 text-xs">
                  {invite.created_at
                    ? new Date(invite.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A'}
                </td>

                {/* Action Column */}
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleCopyLink(invite)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                      copiedInviteId === invite.id
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300'
                    }`}
                    disabled={copiedInviteId === invite.id}
                    title={generateInviteLink(invite.token || invite.id)}
                  >
                    {copiedInviteId === invite.id ? (
                      <>
                        <Check size={16} className="flex-shrink-0" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} className="flex-shrink-0" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Link Reference - Hidden but available for debugging */}
      <details className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <summary className="cursor-pointer font-medium text-gray-700 text-sm">
          Debug: Invite Link Format
        </summary>
        <pre className="mt-2 text-xs bg-white p-3 border border-gray-200 rounded overflow-x-auto">
          {`Format: ${appBaseUrl}/invite?token=[token]\nExample: ${generateInviteLink('example-32-char-token-here-abc123')}`}
        </pre>
      </details>
    </>
  );
};

export default PendingInvitesTable;
