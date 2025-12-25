"use client";

import Link from "next/link";

export default function UpsellModal({ open, onClose, reason }: { open: boolean; onClose: () => void; reason?: string }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      <div className="relative max-w-md w-full bg-gray-900 border border-gray-700 rounded-xl p-6 z-10">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🔒</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">Upgrade Required</h3>
            <p className="text-gray-300 mt-2">{reason || 'This action requires an active subscription.'}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link href="/pricing" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-center font-semibold">View Plans</Link>
          <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">Maybe later</button>
        </div>
      </div>
    </div>
  );
}
