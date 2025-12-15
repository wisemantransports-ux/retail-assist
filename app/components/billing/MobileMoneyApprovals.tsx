'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MobileMoneyPayment {
  id: string;
  user_id: string;
  phone_number: string;
  amount: number;
  reference_code: string;
  proof_url?: string;
  created_at: string;
}

export default function MobileMoneyApprovals({ payments }: { payments: MobileMoneyPayment[] }) {
  const router = useRouter();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleApprove = async (paymentId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments/mobile-money/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, notes }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Payment approved');
        setSelectedPaymentId(null);
        setNotes('');
        router.refresh();
      } else {
        alert('Failed to approve payment');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error approving payment');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (paymentId: string, reason: string) => {
    if (!reason) {
      alert('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/payments/mobile-money/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, reason }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Payment rejected');
        setSelectedPaymentId(null);
        setNotes('');
        router.refresh();
      } else {
        alert('Failed to reject payment');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error rejecting payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {payments.map((payment) => (
        <div key={payment.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">User ID: {payment.user_id}</p>
              <p className="text-sm font-medium">Phone: {payment.phone_number}</p>
              <p className="text-sm text-gray-600">Reference: {payment.reference_code}</p>
              <p className="text-lg font-semibold mt-2">BWP {payment.amount.toFixed(2)}</p>
              <p className="text-xs text-gray-500">
                Submitted: {new Date(payment.created_at).toLocaleString()}
              </p>
            </div>

            {payment.proof_url && (
              <a
                href={payment.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View Proof
              </a>
            )}
          </div>

          {selectedPaymentId === payment.id ? (
            <div className="space-y-3 bg-gray-50 p-3 rounded">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes for approval..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(payment.id)}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
                >
                  {loading ? 'Processing...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(payment.id, notes || 'Payment rejected by admin')}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-2 rounded font-semibold hover:bg-red-700 disabled:bg-gray-400 transition"
                >
                  {loading ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={() => {
                    setSelectedPaymentId(null);
                    setNotes('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-900 py-2 rounded font-semibold hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSelectedPaymentId(payment.id)}
              className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
            >
              Review
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
