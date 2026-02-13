'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Message, EmployeeMessageStatus, MessageChannel } from '@/lib/types/database';

/**
 * Admin Message Dashboard
 * 
 * Accessible only to: admin (client business owner)
 * Displays: All messages for admin's workspace
 * Actions: Reply, escalate to platform_staff, mark as read/resolved
 * 
 * Security:
 * - Middleware enforces only admin role can access /dashboard/*
 * - RPC provides authoritative workspace_id
 * - API /api/messages filters by workspace_id
 */
export default function AdminMessagesPage() {
  // ===== AUTH STATE =====
  const { user, loading: authLoading, error: authError } = useAuth();

  // ===== MESSAGE STATE =====
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== UI STATE =====
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // ===== FILTERS =====
  const [filterStatus, setFilterStatus] = useState<EmployeeMessageStatus | 'all'>('all');
  const [filterChannel, setFilterChannel] = useState<MessageChannel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ===== PAGINATION =====
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  /**
   * Validate user role and workspace before rendering
   * Only admin (client business owner) can access this page
   */
  useEffect(() => {
    if (authLoading) return;

    if (authError) {
      setError(`Authentication error: ${authError.message}`);
      return;
    }

    if (!user) {
      setError('Failed to load user information');
      return;
    }

    // ===== ROLE VALIDATION =====
    // Middleware enforces this, but we double-check for security
    if (user.role !== 'admin') {
      setError(`Access denied. Expected role: admin, got: ${user.role}`);
      return;
    }

    // ===== WORKSPACE VALIDATION =====
    // Admin must have a workspace_id (not NULL)
    // Server-side API will enforce workspace scoping
    if (!user.workspace_id) {
      setError('Invalid workspace assignment');
      return;
    }
  }, [user, authLoading, authError]);

  /**
   * Fetch messages for admin's workspace
   * Uses API /api/messages with proper filtering
   */
  const fetchMessages = useCallback(async () => {
    if (!user?.workspace_id) return;

    setLoading(true);
    setError(null);

    try {
      // ===== BUILD QUERY PARAMS =====
      const params = new URLSearchParams({
        businessId: user.workspace_id, // Admin sees all messages in their workspace
        limit: String(ITEMS_PER_PAGE),
        offset: String(page * ITEMS_PER_PAGE),
      });

      // Add status filter
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      // Add channel filter
      if (filterChannel !== 'all') {
        params.append('channel', filterChannel);
      }

      // Add search query
      if (searchQuery.trim()) {
        params.append('search', searchQuery);
      }

      // ===== FETCH FROM API =====
      const response = await fetch(`/api/messages?${params.toString()}`);

      if (response.status === 401) {
        // Session expired
        window.location.href = '/login';
        return;
      }

      if (response.status === 403) {
        setError('You do not have permission to access these messages');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to fetch messages: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user?.workspace_id, filterStatus, filterChannel, searchQuery, page]);

  /**
   * Load messages when filters or pagination change
   */
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  /**
   * Handle reply to selected message
   */
  const handleReply = async () => {
    if (!selectedMessageId || !replyText.trim()) {
      alert('Please select a message and enter a reply');
      return;
    }

    setIsReplying(true);
    try {
      const response = await fetch('/api/messages/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selectedMessageId,
          response: replyText,
          escalate: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reply');
      }

      // ===== SUCCESS =====
      setReplyText('');
      setSelectedMessageId(null);
      // Refresh message list
      await fetchMessages();
    } catch (err) {
      alert(`Failed to send reply: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsReplying(false);
    }
  };

  /**
   * Handle escalation of message to platform_staff
   */
  const handleEscalate = async () => {
    if (!selectedMessageId) {
      alert('Please select a message to escalate');
      return;
    }

    setIsReplying(true);
    try {
      const response = await fetch('/api/messages/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selectedMessageId,
          escalate: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to escalate message');
      }

      // ===== SUCCESS =====
      setSelectedMessageId(null);
      // Refresh message list
      await fetchMessages();
    } catch (err) {
      alert(`Failed to escalate message: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsReplying(false);
    }
  };

  /**
   * Get channel display name
   */
  const getChannelLabel = (channel: MessageChannel): string => {
    const labels: Record<MessageChannel, string> = {
      facebook: '📘 Facebook',
      instagram: '📷 Instagram',
      whatsapp: '💬 WhatsApp',
      website_chat: '💻 Website',
    };
    return labels[channel] || channel;
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status: EmployeeMessageStatus): string => {
    const colors: Record<EmployeeMessageStatus, string> = {
      new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      in_progress: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      escalated: 'bg-red-500/20 text-red-300 border-red-500/30',
      completed: 'bg-green-500/20 text-green-300 border-green-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  /**
   * Get status display text
   */
  const getStatusLabel = (status: EmployeeMessageStatus): string => {
    const labels: Record<EmployeeMessageStatus, string> = {
      new: 'New',
      in_progress: 'In Progress',
      escalated: 'Escalated',
      completed: 'Resolved',
    };
    return labels[status] || status;
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  // ===== LOADING STATE =====
  if (authLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  // ===== ERROR STATE =====
  if (authError || error) {
    const errorMsg = error || authError?.message;
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
          <p className="text-red-200">
            {errorMsg === 'Access denied. Expected role: admin, got: employee'
              ? 'Employee accounts access messages via /employees/messages instead'
              : errorMsg === 'Access denied. Expected role: admin, got: platform_staff'
                ? 'Support staff access escalated messages via /support'
                : errorMsg}
          </p>
        </div>
      </div>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <p className="text-sm text-gray-400">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search Messages
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0); // Reset pagination on search
              }}
              placeholder="Search by sender, content..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value as EmployeeMessageStatus | 'all');
                setPage(0);
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
              <option value="completed">Resolved</option>
            </select>
          </div>

          {/* Channel Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Channel
            </label>
            <select
              value={filterChannel}
              onChange={(e) => {
                setFilterChannel(e.target.value as MessageChannel | 'all');
                setPage(0);
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Channels</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website_chat">Website</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-400">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-400">
                {searchQuery || filterStatus !== 'all' || filterChannel !== 'all'
                  ? 'No messages match your filters'
                  : 'No messages yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessageId(message.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedMessageId === message.id
                      ? 'bg-gray-700 border-blue-500'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Sender and Channel */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-white truncate">
                          {message.sender_id || 'Unknown Sender'}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {getChannelLabel(message.channel)}
                        </span>
                      </div>

                      {/* Message Preview */}
                      <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                        {message.content}
                      </p>

                      {/* AI Response Indicator */}
                      {message.ai_response && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                            🤖 AI Response
                          </span>
                          {message.ai_confidence && (
                            <span className="text-xs text-gray-400">
                              Confidence: {(message.ai_confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{formatTime(message.created_at)}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${getStatusColor(
                        message.status
                      )}`}
                    >
                      {getStatusLabel(message.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {messages.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page + 1}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={messages.length < ITEMS_PER_PAGE}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white text-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Message Detail and Reply */}
        {selectedMessageId ? (
          <div className="lg:col-span-1">
            {(() => {
              const selected = messages.find((m) => m.id === selectedMessageId);
              if (!selected) return null;

              return (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6 h-fit sticky top-6">
                  {/* Header */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Message Detail</h3>
                  </div>

                  {/* Message Info */}
                  <div className="space-y-4 text-sm border-b border-gray-700 pb-4">
                    <div>
                      <p className="text-gray-400 mb-1">From</p>
                      <p className="text-white font-medium">{selected.sender_id || 'Unknown'}</p>
                    </div>

                    <div>
                      <p className="text-gray-400 mb-1">Channel</p>
                      <p className="text-white font-medium">{getChannelLabel(selected.channel)}</p>
                    </div>

                    <div>
                      <p className="text-gray-400 mb-1">Status</p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border inline-block ${getStatusColor(
                          selected.status
                        )}`}
                      >
                        {getStatusLabel(selected.status)}
                      </span>
                    </div>

                    <div>
                      <p className="text-gray-400 mb-1">Received</p>
                      <p className="text-white">{formatTime(selected.created_at)}</p>
                    </div>

                    {/* AI Response Info */}
                    {selected.ai_response && (
                      <div>
                        <p className="text-gray-400 mb-1">🤖 AI Response</p>
                        <div className="bg-purple-900/30 border border-purple-500/30 rounded p-2">
                          <p className="text-purple-200 text-xs mb-2">{selected.ai_response}</p>
                          {selected.ai_confidence && (
                            <p className="text-purple-300 text-xs">
                              Confidence: {(selected.ai_confidence * 100).toFixed(0)}%
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Message</p>
                    <div className="bg-gray-700/50 rounded p-3 text-white text-sm break-words">
                      {selected.content}
                    </div>
                  </div>

                  {/* Reply Form */}
                  <div className="space-y-4 border-t border-gray-700 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Your Reply
                      </label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your response..."
                        disabled={isReplying}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm resize-none"
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleReply}
                        disabled={isReplying || !replyText.trim()}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium text-sm transition-colors"
                      >
                        {isReplying ? 'Sending...' : 'Send Reply'}
                      </button>

                      <button
                        onClick={handleEscalate}
                        disabled={isReplying}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium text-sm transition-colors"
                        title="Escalate to platform support staff"
                      >
                        {isReplying ? 'Sending...' : 'Escalate'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="lg:col-span-1 bg-gray-800 border border-gray-700 rounded-lg p-6 text-center text-gray-400">
            <p>Select a message to view details and reply</p>
          </div>
        )}
      </div>
    </div>
  );
}
