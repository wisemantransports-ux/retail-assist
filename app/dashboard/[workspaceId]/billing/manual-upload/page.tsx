'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

/**
 * Manual Payment Upload Page
 * Users upload proof of payment for Mobile Money or bank transfer
 */
export default function ManualPaymentUploadPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState('orange');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !file) {
      setMessage({ type: 'error', text: 'Amount and proof file are required' });
      return;
    }

    setLoading(true);
    try {
      // TODO: Upload file to storage and get proof_url
      const proofUrl = '#'; // Placeholder

      const res = await fetch('/api/billing/manual/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          amount: Number(amount),
          currency: 'BWP',
          provider,
          proofUrl,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Submission failed' });
      } else {
        setMessage({ type: 'success', text: 'Payment submitted for approval. Our team will review it shortly.' });
        setAmount('');
        setNotes('');
        setFile(null);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Submit Manual Payment</h1>
      <p className="text-gray-600 mb-6">Pay us via Mobile Money and upload proof of payment</p>

      {message && (
        <div className={`p-4 rounded mb-6 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Payment Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Send Payment To:</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>🟠 <strong>Orange Money:</strong> +267 71 234 567</p>
            <p>🔴 <strong>Mascom MyZaka:</strong> +267 74 345 678</p>
            <p>⚫ <strong>BTC Smega:</strong> +267 72 456 789</p>
          </div>
        </div>

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-semibold mb-2">Payment Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="orange">Orange Money</option>
            <option value="mascom">Mascom MyZaka</option>
            <option value="btc">BTC Smega</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold mb-2">Amount (BWP)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 299"
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Proof Upload */}
        <div>
          <label className="block text-sm font-semibold mb-2">Proof of Payment (Screenshot or PDF)</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-2">Max 5MB. Accepts PNG, JPG, PDF</p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold mb-2">Additional Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Transaction reference number, phone used, etc."
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Payment'}
        </button>
      </form>
    </div>
  );
}
