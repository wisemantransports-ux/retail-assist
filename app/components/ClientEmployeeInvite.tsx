'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Copy, Check, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

/**
 * TypeScript interface for employee invites in client workspace
 */
interface ClientEmployeeInvite {
  id: string;
  email: string;
  status: string;
  created_at?: string;
  role?: string;
  workspace_id: string;
  invited_by: string;
  full_name?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Props interface for ClientEmployeeInvite component
 */
interface ClientEmployeeInviteProps {
  workspaceId: string;
  adminId: string;
  isSuperAdmin?: boolean;
  defaultRole?: string;
}

/**
 * Initialize Supabase client
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * ClientEmployeeInvite Component
 * Allows admins (client or super admin) to invite employees
 *
 * Features:
 * - Email input with form submission
 * - Calls Supabase RPC with appropriate parameters based on admin type
 *   - Client Admin: p_email, p_invited_by (workspace inferred server-side)
 *   - Super Admin: p_email, p_role, p_workspace_id, p_invited_by
 * - Displays list of pending invites
 * - Copy-to-clipboard for invite links
 * - Success and error toast notifications
 * - Auto-fetches existing invites on mount
 *
 * @param workspaceId - Client workspace UUID (or null for platform staff if super admin)
 * @param adminId - Currently logged-in admin user UUID
 * @param isSuperAdmin - Optional flag to indicate super admin mode (default: false)
 * @param defaultRole - Optional default role for super admin invites (default: 'employee')
 */
export const ClientEmployeeInvite: React.FC<ClientEmployeeInviteProps> = ({
  workspaceId,
  adminId,
  isSuperAdmin = false,
  defaultRole = 'employee',
}) => {
  const [email, setEmail] = useState<string>('');
  const [invites, setInvites] = useState<ClientEmployeeInvite[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  /**
   * Generates the invitation link for an invite token
   */
  const generateInviteLink = useCallback((inviteId: string): string => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://yourapp.com';
    return `${baseUrl}/invite?token=${inviteId}`;
  }, []);

  /**
   * Fetches existing invites for the workspace
   */
  const fetchExistingInvites = useCallback(async () => {
    setIsFetching(true);
    try {
      const { data, error: queryError } = await supabase
        .from('employee_invites')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (queryError) {
        console.error('[ClientEmployeeInvite] Fetch invites error:', queryError);
        toast.error('Failed to load existing invites');
        return;
      }

      setInvites(data as ClientEmployeeInvite[] || []);
    } catch (err) {
      console.error('[ClientEmployeeInvite] Unexpected error fetching invites:', err);
      toast.error('Failed to fetch invites');
    } finally {
      setIsFetching(false);
    }
  }, [workspaceId]);

  /**
   * Fetch invites on component mount
   */
  useEffect(() => {
    fetchExistingInvites();
  }, [fetchExistingInvites]);

  /**
   * Validates email format
   */
  const isValidEmail = (emailAddress: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailAddress);
  };

  /**
   * Handles invite form submission
   */
  const handleSubmitInvite = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      // Validate email
      if (!email.trim()) {
        setError('Email is required');
        toast.error('Please enter an email address');
        return;
      }

      if (!isValidEmail(email)) {
        setError('Invalid email format');
        toast.error('Please enter a valid email address');
        return;
      }

      setIsLoading(true);

      try {
        // Build RPC parameters based on admin type
        // Client Admin: Only p_email and p_invited_by (workspace inferred server-side)
        // Super Admin: All parameters including p_role and p_workspace_id
        const rpcParams: Record<string, any> = {
          p_email: email.trim().toLowerCase(),
          p_invited_by: adminId,
        };

        if (isSuperAdmin) {
          rpcParams.p_role = defaultRole;
          rpcParams.p_workspace_id = workspaceId || null;
        }

        console.log('[ClientEmployeeInvite] Calling RPC with params:', {
          ...rpcParams,
          p_invited_by: '***HIDDEN***',
        });

        const { data, error: rpcError } = await supabase.rpc(
          'rpc_create_employee_invite',
          rpcParams
        );

        if (rpcError) {
          console.error('[ClientEmployeeInvite] RPC error:', rpcError);
          const errorMsg =
            rpcError.message ||
            (typeof rpcError === 'object' ? JSON.stringify(rpcError) : String(rpcError));
          setError(errorMsg);
          toast.error(`Failed to create invite: ${errorMsg}`);
          return;
        }

        // Success: add new invite to list
        if (data && data.length > 0) {
          const newInvite: ClientEmployeeInvite = {
            id: data[0].id,
            email: data[0].email,
            status: data[0].status,
            created_at: data[0].created_at,
            role: data[0].role,
            workspace_id: data[0].workspace_id,
            invited_by: data[0].invited_by,
            full_name: data[0].full_name,
            phone: data[0].phone,
            metadata: data[0].metadata,
          };

          setInvites((prev) => [newInvite, ...prev]);
          toast.success(`Invite sent to ${email}!`);
          console.log('[ClientEmployeeInvite] Invite created successfully:', newInvite.id);

          // Clear input field
          setEmail('');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('[ClientEmployeeInvite] Unexpected error:', err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [email, adminId, isSuperAdmin, defaultRole]
  );

  /**
   * Handles copy-to-clipboard for invite link
   */
  const handleCopyLink = useCallback(async (invite: ClientEmployeeInvite) => {
    const inviteLink = generateInviteLink(invite.id);

    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Link copied to clipboard!', { duration: 2000 });
      setCopiedInviteId(invite.id);

      // Reset button state after 2 seconds
      setTimeout(() => {
        setCopiedInviteId(null);
      }, 2000);
    } catch (err) {
      console.error('[ClientEmployeeInvite] Copy error:', err);
      toast.error('Failed to copy link');
    }
  }, [generateInviteLink]);

  return (
    <>
      {/* Toast Notification Container */}
      <Toaster position="top-right" />

      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg border border-gray-200">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Invite Team Members</h2>
          <p className="text-gray-600 text-sm mt-1">
            Invite employees to join your workspace. They will receive an invitation link.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Invite Form */}
        <form onSubmit={handleSubmitInvite} className="mb-8">
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter employee email address"
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invite'
              )}
            </button>
          </div>
        </form>

        {/* Invites Table */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Pending Invites {invites.length > 0 && `(${invites.length})`}
          </h3>

          {isFetching ? (
            <div className="text-center py-8">
              <div className="inline-block">
                <Loader2 size={24} className="animate-spin text-blue-600" />
              </div>
              <p className="text-gray-600 text-sm mt-2">Loading invites...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500 text-sm">No pending invites yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-sm">
                {/* Table Header */}
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 font-semibold text-gray-700">Invited At</th>
                    <th className="px-6 py-3 font-semibold text-gray-700 text-right">Invitation Link</th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-gray-200">
                  {invites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-gray-50 transition-colors">
                      {/* Email Column */}
                      <td className="px-6 py-4 text-gray-900 font-medium">{invite.email}</td>

                      {/* Status Column */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {invite.status}
                        </span>
                      </td>

                      {/* Invited At Column */}
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

                      {/* Copy Link Column */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleCopyLink(invite)}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                            copiedInviteId === invite.id
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300'
                          }`}
                          disabled={copiedInviteId === invite.id}
                          title={generateInviteLink(invite.id)}
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
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-900 text-sm">
            <strong>💡 How it works:</strong> Once you send an invite, the team member will receive an invitation link.
            They can accept the invite to join your workspace.
          </p>
        </div>
      </div>
    </>
  );
};

export default ClientEmployeeInvite;
