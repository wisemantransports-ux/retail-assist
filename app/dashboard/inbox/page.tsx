'use client';

import { useState, useEffect } from 'react';
import ConversationsList from '@/components/inbox/ConversationsList';
import ConversationDetail from '@/components/inbox/ConversationDetail';

export default function InboxPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // For triggering refreshes

  // Fetch workspace ID for the current user
  useEffect(() => {
    async function fetchWorkspaceId() {
      try {
        // Try to get workspace from agents API (which determines workspace by owner)
        const agentsRes = await fetch('/api/agents');
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          // If we can fetch agents, assume workspace exists
          // For now, we'll use a placeholder. In production, you'd want an endpoint to get workspace ID
          // Let's try to infer from the user session
          const authRes = await fetch('/api/auth/me', { credentials: 'include' });
          if (authRes.ok) {
            const authData = await authRes.json();
            // Use the user's workspace_id from auth context
            // This ensures workspace scoping is maintained
            const workspace = authData.user.workspace_id;
            if (!workspace) {
              throw new Error('User is not assigned to a workspace');
            }
            setWorkspaceId(workspace);
          } else {
            throw new Error('Unable to authenticate');
          }
        } else {
          throw new Error('Unable to access workspace');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspaceId();
  }, []);

  const handleReply = async (content: string) => {
    if (!selectedConversationId) return;

    try {
      const res = await fetch(`/api/inbox/${encodeURIComponent(selectedConversationId)}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send reply');
      }

      // Trigger refresh of conversations and conversation detail
      setRefreshKey(prev => prev + 1);

    } catch (err: any) {
      alert(`Failed to send reply: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Inbox</h1>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <p className="text-gray-400">Loading inbox...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Inbox</h1>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Inbox</h1>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <p className="text-gray-400">No workspace found. Please set up your account first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Inbox</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations List */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Conversations</h2>
          <ConversationsList
            key={`conversations-${refreshKey}`}
            workspaceId={workspaceId}
            onSelectConversation={setSelectedConversationId}
            selectedConversationId={selectedConversationId || undefined}
          />
        </div>

        {/* Conversation Detail */}
        <div>
          {selectedConversationId ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">Messages</h2>
              <ConversationDetail
                key={`conversation-${selectedConversationId}-${refreshKey}`}
                conversationId={selectedConversationId}
                onReply={handleReply}
              />
            </>
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
              <p className="text-gray-400">Select a conversation to view messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
