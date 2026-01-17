'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Message, EmployeeMessageStatus, MessageChannel } from '@/lib/types/database';

/**
 * Employee Message Queue Page
 * 
 * Accessible only to: employee (client business staff)
 * Displays: Messages assigned to this employee's workspace
 * Actions: Reply to messages, mark as resolved, escalate to admin
 * 
 * Security:
 * - Middleware enforces only employee role can access /employees/*
 * - RPC provides authoritative workspace_id
 * - API /api/messages filters by assigned_to_employee_id
 * - Employees can only see messages assigned to their workspace
 */
export default function EmployeeMessagesPage() {
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

  // ===== PAGINATION =====
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  /**
   * Validate user role and workspace before rendering
   * Only employees can access this page
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
    if (user.role !== 'employee') {
      setError(`Access denied. Expected role: employee, got: ${user.role}`);
      return;
    }

    // ===== WORKSPACE VALIDATION =====
    // Employees must have a workspace_id (not NULL, not platform workspace)
    if (!user.workspace_id || user.workspace_id === '00000000-0000-0000-0000-000000000001') {
      setError('Invalid workspace assignment. Employees must belong to exactly one workspace.');
      return;
    }
  }, [user, authLoading, authError]);

  /**
   * Fetch messages assigned to this employee's workspace
   * Uses API /api/messages with workspace_id filter
   */
  const fetchMessages = useCallback(async () => {
    if (!user?.workspace_id) return;

    setLoading(true);
    setError(null);

    try {
      // ===== BUILD QUERY PARAMS =====
      // For employees, we fetch messages for their workspace_id
      const params = new URLSearchParams({
        businessId: user.workspace_id,
        limit: String(ITEMS_PER_PAGE),
        offset: String(page * ITEMS_PER_PAGE),
      });

      // Add status filter
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      // ===== FETCH FROM API =====
      // The API /api/messages with businessId will return ALL messages for the workspace
      // In a production system, you might want:
      // 1. Separate endpoint /api/messages/assigned that returns only assigned messages
      // 2. Or use employeeId param to filter only their queue
      // For now, we'll let the frontend filter or use businessId with the understanding that
      // auto-queueing assigns new messages to all active employees in the workspace
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
  }, [user?.workspace_id, filterStatus, page]);

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
      alert('Please enter a reply');
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
   * Handle escalation of message to admin
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
   * Mark message as resolved
   */
  const handleMarkResolved = async () => {
    if (!selectedMessageId) return;

    try {
      const response = await fetch('/api/messages/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selectedMessageId,
          response: '', // Empty response = just mark as resolved
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to mark as resolved');
      }

      // ===== SUCCESS =====
      setSelectedMessageId(null);
      // Refresh message list
      await fetchMessages();
    } catch (err) {
      alert(`Failed to mark as resolved: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /**
   * Get channel display name with emoji
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
        <h1 className="text-3xl font-bold text-white">My Messages</h1>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
          <p className="text-gray-400">Loading your messages...</p>
        </div>
      </div>
    );
  }

  // ===== ERROR STATE =====
  if (authError || error) {
    const errorMsg = error || authError?.message;
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">My Messages</h1>
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
          <p className="text-red-200">
            {errorMsg === 'Access denied. Expected role: employee, got: admin'
              ? 'Admins should use the Messages dashboard (/dashboard/messages) instead'
              : errorMsg === 'Access denied. Expected role: employee, got: super_admin'
                ? 'Platform admins access support escalations via /admin'
                : errorMsg === 'Access denied. Expected role: employee, got: platform_staff'
                  ? 'Platform staff access escalated messages via /admin/support'
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
        <div>
          <h1 className="text-3xl font-bold text-white">My Messages</h1>
          <p className="text-sm text-gray-400 mt-1">
            Assigned to your workspace: {user?.workspace_id?.slice(0, 8)}...
          </p>
        </div>
        <p className="text-sm text-gray-400">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {(() => {
          const newCount = messages.filter((m) => m.status === 'new').length;
          const inProgressCount = messages.filter((m) => m.status === 'in_progress').length;
          const escalatedCount = messages.filter((m) => m.status === 'escalated').length;
          const completedCount = messages.filter((m) => m.status === 'completed').length;

          return (
            <>
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-xs font-medium mb-1">New</p>
                <p className="text-blue-100 text-2xl font-bold">{newCount}</p>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-300 text-xs font-medium mb-1">In Progress</p>
                <p className="text-yellow-100 text-2xl font-bold">{inProgressCount}</p>
              </div>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-300 text-xs font-medium mb-1">Escalated</p>
                <p className="text-red-100 text-2xl font-bold">{escalatedCount}</p>
              </div>
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-300 text-xs font-medium mb-1">Resolved</p>
                <p className="text-green-100 text-2xl font-bold">{completedCount}</p>
              </div>
            </>
          );
        })()}
      </div>

      {/* Status Filter */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Filter by Status
        </label>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'new', 'in_progress', 'escalated', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status);
                setPage(0);
              }}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {status === 'all'
                ? 'All'
                : status === 'new'
                  ? 'New'
                  : status === 'in_progress'
                    ? 'In Progress'
                    : status === 'escalated'
                      ? 'Escalated'
                      : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-400">Loading your messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-400">
                {filterStatus !== 'all'
                  ? 'No messages with this status'
                  : 'No messages assigned yet. Great job! 🎉'}
              </p>
            </div>
          ) : (
            messages.map((message) => (
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
                            {(message.ai_confidence * 100).toFixed(0)}% confident
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
            ))
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
              <span className="text-sm text-gray-400">Page {page + 1}</span>
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
                      <p className="text-white text-sm">{formatTime(selected.created_at)}</p>
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
                    <p className="text-gray-400 text-sm mb-2">Message Content</p>
                    <div className="bg-gray-700/50 rounded p-3 text-white text-sm break-words max-h-32 overflow-y-auto">
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
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleReply}
                        disabled={isReplying || !replyText.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium text-sm transition-colors"
                      >
                        {isReplying ? 'Sending...' : 'Send Reply'}
                      </button>

                      <button
                        onClick={handleMarkResolved}
                        disabled={isReplying}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium text-sm transition-colors"
                        title="Mark message as resolved"
                      >
                        Mark Resolved
                      </button>

                      <button
                        onClick={handleEscalate}
                        disabled={isReplying}
                        className="col-span-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium text-sm transition-colors"
                        title="Escalate to business admin"
                      >
                        {isReplying ? 'Sending...' : 'Escalate to Admin'}
                      </button>
                    </div>
                  </div>

                  {/* Note */}
                  <p className="text-xs text-gray-400 text-center border-t border-gray-700 pt-4">
                    Escalate complex issues to your business admin
                  </p>
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
