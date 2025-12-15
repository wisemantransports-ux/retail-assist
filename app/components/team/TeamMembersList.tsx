'use client';

import { useState } from 'react';
import { WorkspaceMember } from '@/lib/types/database';

interface TeamMembersListProps {
  members: WorkspaceMember[];
  currentUserId: string;
  userRole: string;
  workspaceId: string;
}

/**
 * TeamMembersList Component
 * Displays workspace members with role management and removal options
 */
export default function TeamMembersList({
  members,
  currentUserId,
  userRole,
  workspaceId,
}: TeamMembersListProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const canManageRoles = userRole === 'owner' || userRole === 'admin';
  const canRemoveMembers = userRole === 'owner' || userRole === 'admin';

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!canManageRoles) {
      alert('You do not have permission to change roles');
      return;
    }

    setUpdating(memberId);
    try {
      const response = await fetch('/api/workspace/member/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          member_id: memberId,
          new_role: newRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      } else {
        alert('Role updated successfully');
        // Reload page to see changes
        window.location.reload();
      }
    } catch (error) {
      alert('Failed to update role');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!canRemoveMembers) {
      alert('You do not have permission to remove members');
      return;
    }

    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    setDeleting(memberId);
    try {
      const response = await fetch('/api/workspace/member/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          member_id: memberId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      } else {
        alert('Member removed successfully');
        // Reload page to see changes
        window.location.reload();
      }
    } catch (error) {
      alert('Failed to remove member');
    } finally {
      setDeleting(null);
    }
  };

  if (!members || members.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-muted text-center">No members in this workspace yet</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="bg-card-border border-b border-card-border">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-muted">Name</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-muted">Email</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-muted">Role</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-muted">Joined</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-muted">Status</th>
            {canManageRoles && <th className="px-6 py-3 text-left text-sm font-medium text-muted">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border">
          {members.map((member: any) => {
            const isCurrentUser = member.user_id === currentUserId;
            const isOwner = member.role === 'owner';
            const canChangeRole = canManageRoles && !isOwner && !isCurrentUser;
            const canRemove = canRemoveMembers && !isOwner && !isCurrentUser;

            return (
              <tr key={member.id} className="hover:bg-card-hover transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-foreground">
                  {member.user?.full_name || 'N/A'}
                  {isCurrentUser && <span className="ml-2 text-xs text-muted">(You)</span>}
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {member.user?.email || 'N/A'}
                </td>
                <td className="px-6 py-4 text-sm">
                  {canChangeRole ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={updating === member.id}
                      className="px-3 py-1 border border-card-border rounded-md text-sm bg-background text-foreground disabled:opacity-50"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {member.role}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {new Date(member.invited_at || member.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    member.accepted_at
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {member.accepted_at ? 'Active' : 'Pending'}
                  </span>
                </td>
                {canManageRoles && (
                  <td className="px-6 py-4 text-sm">
                    {canRemove && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={deleting === member.id}
                        className="text-red-600 hover:text-red-800 font-medium text-xs disabled:opacity-50"
                      >
                        {deleting === member.id ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
