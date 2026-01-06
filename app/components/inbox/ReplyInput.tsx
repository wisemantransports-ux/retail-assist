'use client';

import { useState } from 'react';

interface ReplyInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ReplyInput({
  onSend,
  placeholder = "Type your reply...",
  disabled = false
}: ReplyInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!content.trim() || sending || disabled) return;

    try {
      setSending(true);
      await onSend(content.trim());
      setContent('');
    } catch (err) {
      console.error('Failed to send reply:', err);
      // Error handling could be improved with user feedback
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-700 pt-4">
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          disabled={sending || disabled}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || disabled}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
      <p className="text-gray-500 text-xs mt-1">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}