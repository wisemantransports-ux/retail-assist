'use client';

import { useState, useEffect } from 'react';

// Types for API responses
interface Conversation {
  conversationId: string;
  platform: string;
  externalUserId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface ConversationsListProps {
  workspaceId: string;
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId?: string;
}

export default function ConversationsList({
  workspaceId,
  onSelectConversation,
  selectedConversationId
}: ConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch conversations from the API
  useEffect(() => {
    async function fetchConversations() {
      try {
        setLoading(true);
        const res = await fetch(`/api/inbox?workspaceId=${encodeURIComponent(workspaceId)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch conversations');
        }

        setConversations(data.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (workspaceId) {
      fetchConversations();
    }
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-24 mb-1"></div>
                <div className="h-3 bg-gray-700 rounded w-16"></div>
              </div>
            </div>
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-4">
        <p className="text-red-400 text-sm">Error loading conversations: {error}</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
        <p className="text-gray-400">No conversations yet.</p>
        <p className="text-gray-500 text-sm mt-2">
          Messages from your connected platforms will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conversation) => (
        <div
          key={conversation.conversationId}
          onClick={() => onSelectConversation(conversation.conversationId)}
          className={`bg-gray-800 border rounded-xl p-4 cursor-pointer transition-colors ${
            selectedConversationId === conversation.conversationId
              ? 'border-blue-500 bg-gray-750'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
                conversation.platform === 'facebook' ? 'bg-blue-600' :
                conversation.platform === 'instagram' ? 'bg-gradient-to-br from-purple-600 to-pink-500' :
                'bg-gray-600'
              }`}>
                {conversation.platform === 'facebook' ? 'f' :
                 conversation.platform === 'instagram' ? '📷' :
                 '🌐'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white font-medium truncate">
                    {conversation.externalUserId}
                  </p>
                  <span className="text-xs text-gray-400 capitalize flex-shrink-0">
                    {conversation.platform}
                  </span>
                </div>
                <p className="text-gray-300 text-sm truncate">
                  {conversation.lastMessage || 'No messages yet'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-gray-500 text-xs">
                {new Date(conversation.lastMessageAt).toLocaleDateString()}
              </span>
              {conversation.unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}