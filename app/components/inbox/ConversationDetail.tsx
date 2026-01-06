'use client';

import { useState, useEffect } from 'react';
import ReplyInput from './ReplyInput';

// Types for API responses
interface Message {
  id: string;
  sender: 'customer' | 'bot' | 'agent';
  content: string;
  platform: string;
  createdAt: string;
}

interface ConversationDetailProps {
  conversationId: string;
  onReply?: (content: string) => void;
}

export default function ConversationDetail({ conversationId, onReply }: ConversationDetailProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to parse message content and extract rule source
  const parseMessageContent = (content: string) => {
    if (content.startsWith('[Workspace Rule] ')) {
      return { ruleSource: 'workspace', cleanContent: content.slice('[Workspace Rule] '.length) };
    } else if (content.startsWith('[Default AI] ')) {
      return { ruleSource: 'default', cleanContent: content.slice('[Default AI] '.length) };
    }
    return { ruleSource: null, cleanContent: content };
  };

  // Fetch messages for the conversation
  useEffect(() => {
    async function fetchMessages() {
      try {
        setLoading(true);
        const res = await fetch(`/api/inbox/${encodeURIComponent(conversationId)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch messages');
        }

        setMessages(data.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId]);

  // Mark conversation as read when opened
  useEffect(() => {
    async function markAsRead() {
      if (conversationId && messages.length > 0) {
        try {
          await fetch(`/api/inbox/${encodeURIComponent(conversationId)}/read`, {
            method: 'POST',
          });
          // Note: We don't update local state here as the parent component
          // will refetch conversations to update unread counts
        } catch (err) {
          console.error('Failed to mark as read:', err);
        }
      }
    }

    markAsRead();
  }, [conversationId, messages.length]);

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className="bg-gray-700 rounded-lg p-3 max-w-xs animate-pulse">
                <div className="h-4 bg-gray-600 rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-4">
          <p className="text-red-400 text-sm">Error loading conversation: {error}</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="text-center py-12">
          <p className="text-gray-400">No messages in this conversation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      {/* Conversation Header */}
      <div className="border-b border-gray-700 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
            messages[0]?.platform === 'facebook' ? 'bg-blue-600' :
            messages[0]?.platform === 'instagram' ? 'bg-gradient-to-br from-purple-600 to-pink-500' :
            'bg-gray-600'
          }`}>
            {messages[0]?.platform === 'facebook' ? 'f' :
             messages[0]?.platform === 'instagram' ? '📷' :
             '🌐'}
          </div>
          <div>
            <p className="text-white font-medium">
              {conversationId.split(':')[1] || 'Unknown User'}
            </p>
            <p className="text-gray-400 text-sm capitalize">
              {messages[0]?.platform || 'Unknown Platform'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
        {messages.map((message) => {
          const { ruleSource, cleanContent } = parseMessageContent(message.content);
          return (
            <div
              key={message.id}
              className={`flex ${message.sender === 'customer' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`rounded-lg p-3 max-w-xs lg:max-w-md ${
                  message.sender === 'customer'
                    ? 'bg-gray-700 text-white'
                    : message.sender === 'agent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-green-600 text-white'
                }`}
              >
                {ruleSource && (
                  <div className={`text-xs mb-1 px-2 py-1 rounded text-center ${
                    ruleSource === 'workspace' ? 'bg-blue-800 text-blue-200' : 'bg-purple-800 text-purple-200'
                  }`}>
                    {ruleSource === 'workspace' ? 'Workspace Rule' : 'Default AI'}
                  </div>
                )}
                <p className="text-sm">{cleanContent}</p>
                <p className={`text-xs mt-1 ${
                  message.sender === 'customer' ? 'text-gray-400' : 'text-blue-100'
                }`}>
                  {new Date(message.createdAt).toLocaleTimeString()}
                  {message.sender !== 'customer' && (
                    <span className="ml-2 capitalize">({message.sender})</span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Input */}
      {onReply && (
        <ReplyInput onSend={onReply} />
      )}
    </div>
  );
}