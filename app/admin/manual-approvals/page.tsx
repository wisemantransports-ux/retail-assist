// FIXED: Client Component must use browser-safe Supabase client (createBrowserSupabaseClient)
'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { ManualPayment } from '@/lib/types/database';

/**
 * Admin Manual Payment Approvals Page
 * Allows workspace admins to review and approve manual payment submissions
 */
export default function AdminManualApprovalsPage() {
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<ManualPayment | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    async function loadPendingPayments() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase
          .from('manual_payments')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setPayments(data as ManualPayment[]);
        }
      } catch (e) {
        console.error('Failed to load payments:', e);
      } finally {
        setLoading(false);
      }
    }

    loadPendingPayments();
  }, []);

  async function handleApproveOrReject(paymentId: string, status: 'approved' | 'rejected') {
    try {
      const res = await fetch('/api/billing/manual/admin/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualPaymentId: paymentId,
          status,
          notes: approvalNotes,
        }),
      });

      if (res.ok) {
        // Remove from list
        setPayments(payments.filter((p) => p.id !== paymentId));
        setSelectedPayment(null);
        setApprovalNotes('');
      } else {
        alert('Failed to update payment status');
      }
    } catch (e) {
      console.error('Error:', e);
      alert('An error occurred');
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-500">Loading pending payments...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Manual Payment Approvals</h1>

      {payments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No pending payments to approve</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Payments List */}
          <div className="lg:col-span-2 space-y-4">
            {payments.map((payment) => (
              <div
                key={payment.id}
                onClick={() => setSelectedPayment(payment)}
                className={`p-4 border rounded cursor-pointer transition ${
                  selectedPayment?.id === payment.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{payment.amount} {payment.currency}</p>
                    <p className="text-sm text-gray-600 capitalize">{payment.provider}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(payment.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Pending</span>
                </div>
              </div>
            ))}
          </div>

          {/* Details & Approval Form */}
          {selectedPayment && (
            <div className="border border-gray-200 rounded p-6 bg-white">
              <h2 className="font-semibold mb-4">Review Payment</h2>

              <div className="space-y-3 mb-6 text-sm">
                <div>
                  <p className="text-gray-600">Amount</p>
                  <p className="font-semibold">{selectedPayment.amount} {selectedPayment.currency}</p>
                </div>
                <div>
                  <p className="text-gray-600">Provider</p>
                  <p className="font-semibold capitalize">{selectedPayment.provider}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone Number</p>
                  <p className="font-semibold">••••••••</p>
                </div>
                <div>
                  <p className="text-gray-600">Proof</p>
                  {selectedPayment.proof_url && (
                    <a href={selectedPayment.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      View Proof →
                    </a>
                  )}
                </div>
                {selectedPayment.notes && (
                  <div>
                    <p className="text-gray-600">User Notes</p>
                    <p className="text-sm italic">{selectedPayment.notes}</p>
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Notes for this approval (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none mb-4"
                rows={3}
              />

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApproveOrReject(selectedPayment.id, 'approved')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleApproveOrReject(selectedPayment.id, 'rejected')}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
