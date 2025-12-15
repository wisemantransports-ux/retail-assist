"use client";

import { useState } from 'react';

export default function CommentBox({ agentId }: { agentId: string }) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(`/api/agent/${agentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_email: undefined, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setStatus('sent');
      setContent('');
    } catch (e: any) {
      setStatus('error');
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a public comment..."
          className="w-full p-3 rounded border bg-card-bg text-foreground"
          rows={4}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={!content.trim() || status === 'sending'}
          >
            Post Comment
          </button>
          {status === 'sending' && <span>Sending…</span>}
          {status === 'sent' && <span className="text-green-400">Sent</span>}
          {status === 'error' && <span className="text-red-400">Error</span>}
        </div>
      </form>
    </div>
  );
}
