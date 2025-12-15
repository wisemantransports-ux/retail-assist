'use client';

import { useState } from 'react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export default function TeamPage() {
  const [members] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'Business Owner',
      email: 'owner@example.com',
      role: 'owner',
      joined_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Invite sent to ${inviteEmail} as ${inviteRole}`);
    setInviteEmail('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Team Management</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Invite Team Member</h2>
        <form onSubmit={handleInvite} className="flex gap-4">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400"
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
            className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
          >
            Send Invite
          </button>
        </form>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Team Members ({members.length})
        </h2>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{member.name}</p>
                  <p className="text-gray-400 text-sm">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  member.role === 'owner' 
                    ? 'bg-purple-900/50 text-purple-400'
                    : member.role === 'admin'
                    ? 'bg-blue-900/50 text-blue-400'
                    : 'bg-gray-600 text-gray-300'
                }`}>
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </span>
                <span className="text-gray-500 text-sm">
                  Joined {new Date(member.joined_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-6">
        <h3 className="text-white font-medium mb-2">Pro Tip</h3>
        <p className="text-blue-200 text-sm">
          Team members can help manage your Facebook pages and respond to customer messages.
          Upgrade to Pro or Enterprise for more team features.
        </p>
      </div>
    </div>
  );
}
