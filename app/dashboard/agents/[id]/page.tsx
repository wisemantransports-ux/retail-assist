"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CommentBox from '@/components/CommentBox';

export default function AgentChatPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [messages, setMessages] = useState<Array<{ from: 'user'|'assistant'; text: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // load recent logs (placeholder)
    setMessages([{ from: 'assistant', text: 'This is a sample assistant reply. Start the conversation by sending a message.' }]);
  }, [id]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`/api/agent/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((m) => [...m, { from: 'assistant', text: data.reply }]);
      } else {
        setMessages((m) => [...m, { from: 'assistant', text: 'No reply (error)' }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { from: 'assistant', text: 'Error sending message' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Agent Chat</h2>
          <p className="text-muted">Testing playground for agent {id}</p>
        </div>
      </div>

      <div className="card flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`p-3 rounded-lg ${m.from === 'user' ? 'bg-background text-foreground self-end' : 'bg-card-border text-muted'} max-w-[80%]` }>
              {m.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-4 border-t border-card-border flex gap-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-background border border-card-border rounded-lg px-4 py-2 text-foreground" />
          <button type="submit" disabled={loading} className="btn-secondary px-4 py-2">{loading ? 'Sending...' : 'Send'}</button>
        </form>
      </div>
      {/* Public comments */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold">Public comments</h3>
        <p className="text-sm text-muted">Post a public comment — the bot will reply privately to the commenter.</p>
        <CommentBox agentId={id} />
      </div>
    </div>
  );
}
