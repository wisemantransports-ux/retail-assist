"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';

export default function AgentForm({ onCreate }: { onCreate?: (data: any) => void }) {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [greeting, setGreeting] = useState("");
  const [fallback, setFallback] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, systemPrompt, greeting, fallback }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create agent');

      onCreate?.(data.agent);
      // redirect to agents list
      router.push('/dashboard/agents');
    } catch (err: any) {
      console.error('create agent error', err);
      alert(err.message || 'Error creating agent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Agent Name</label>
        <input
          className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">System Prompt</label>
        <textarea
          className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground h-28"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Describe the agent's behavior, tone, and rules"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Greeting Message</label>
          <input
            className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Fallback Message</label>
          <input
            className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground"
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating…" : "Create Agent"}
        </button>
        <button type="button" className="bg-card-border text-foreground px-3 py-2 rounded-lg">
          Save draft
        </button>
      </div>
    </form>
  );
}
