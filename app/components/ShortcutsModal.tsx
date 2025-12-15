"use client";

import { useEffect } from "react";

export default function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?") {
        onClose();
      }
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-card-bg border border-card-border rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h3>
        <ul className="space-y-3 text-sm text-muted">
          <li><strong>?</strong> — Toggle this shortcuts modal</li>
          <li><strong>G A</strong> — Go to Agents</li>
          <li><strong>G D</strong> — Go to Dashboard</li>
          <li><strong>G S</strong> — Go to Settings</li>
          <li><strong>Ctrl/Cmd + K</strong> — Quick search</li>
        </ul>
        <div className="mt-6 text-right">
          <button onClick={onClose} className="btn-primary">Close</button>
        </div>
      </div>
    </div>
  );
}
