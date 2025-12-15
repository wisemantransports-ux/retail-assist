"use client";

import { useState } from "react";
import { maskApiKey } from "@/lib/utils/helpers";

export default function ApiKeyDisplay({ apiKey }: { apiKey?: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!apiKey) return <span className="text-sm text-muted">No API key</span>;

  const masked = maskApiKey(apiKey, 10);

  async function copyKey() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('copy failed', e);
      alert('Could not copy API key');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm font-mono text-xs bg-background border border-card-border px-3 py-2 rounded">
        {revealed ? apiKey : masked}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRevealed((s) => !s)}
          className="text-sm px-3 py-2 border border-card-border rounded bg-card-bg"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>

        <button
          type="button"
          onClick={copyKey}
          className="text-sm px-3 py-2 border border-card-border rounded bg-white text-background"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
