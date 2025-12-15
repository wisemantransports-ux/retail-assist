'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getWorkspaceSubscription, getAllPlans, getBillingPaymentHistory, getPendingMobileMoneyPayments } from '@/lib/supabase/queries';
import type { Subscription, Plan, BillingPayment, MobileMoneyPayment } from '@/lib/types/database';

interface BillingPageProps {
  params: { workspaceId: string };
}

export default function BillingPage({ params }: BillingPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<BillingPayment[]>([]);
  const [pendingMomoPayments, setPendingMomoPayments] = useState<MobileMoneyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const status = searchParams.get('status');

  useEffect(() => {
    loadBillingData();
  }, [workspaceId]);

  async function loadBillingData() {
    try {
      setLoading(true);
      setError(null);

      const [subResult, plansResult, historyResult, momoResult] = await Promise.all([
        getWorkspaceSubscription(workspaceId),
        getAllPlans(),
        getBillingPaymentHistory(workspaceId),
        getPendingMobileMoneyPayments(workspaceId),
      ]);

      if (subResult.data) {
        setSubscription(subResult.data);
      }

      if (plansResult.data) {
        setPlans(plansResult.data);
      }

      if (historyResult.data) {
        setPaymentHistory(historyResult.data);
      }

      if (momoResult.data) {
        setPendingMomoPayments(momoResult.data);
      }
    } catch (err) {
      console.error('Error loading billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading billing information...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and payment methods</p>
      </div>

      {/* Status messages */}
      {status === 'success' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          Payment completed successfully! Your subscription is now active.
        </div>
      )}

      {status === 'cancelled' && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
          Payment was cancelled. You can try again anytime.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Current Subscription */}
      {subscription && (
        <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Plan</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-600 text-sm">Plan Name</p>
              <p className="text-lg font-semibold text-gray-900">
                {plans.find((p) => p.id === subscription.plan_id)?.display_name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Billing Cycle</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{subscription.billing_cycle}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Status</p>
              <p className={`text-lg font-semibold capitalize ${
                subscription.status === 'active' ? 'text-green-600' :
                subscription.status === 'past_due' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {subscription.status}
              </p>
            </div>
          </div>
          {subscription.renewal_date && (
            <div className="mt-4 text-sm text-gray-600">
              Renews on {new Date(subscription.renewal_date).toLocaleDateString()}
            </div>
          )}
          <Link
            href={`/dashboard/${workspaceId}/billing/checkout`}
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Change Plan
          </Link>
        </div>
      )}

      {/* Available Plans */}
      {!subscription && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Choose a Plan</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="p-6 border border-gray-200 rounded-lg hover:shadow-lg transition">
                <h3 className="text-lg font-semibold text-gray-900">{plan.display_name}</h3>
                <p className="text-gray-600 text-sm mt-2">{plan.description}</p>
                <div className="mt-4">
                  {plan.price_monthly && (
                    <div className="text-2xl font-bold text-gray-900">
                      ${plan.price_monthly} <span className="text-sm text-gray-600">/month</span>
                    </div>
                  )}
                </div>
                <Link
                  href={`/dashboard/${workspaceId}/billing/checkout?plan=${plan.id}`}
                  className="mt-4 block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Select Plan
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Mobile Money Approvals (Admin) */}
      {pendingMomoPayments.length > 0 && (
        <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Pending Mobile Money Approvals ({pendingMomoPayments.length})
          </h2>
          <div className="space-y-3">
            {pendingMomoPayments.map((payment) => (
              <div key={payment.id} className="p-4 bg-white rounded border border-gray-200 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{payment.reference_code}</p>
                  <p className="text-sm text-gray-600">{payment.phone_number} - {payment.amount} {payment.currency}</p>
                </div>
                <Link
                  href={`/dashboard/${workspaceId}/billing/admin`}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Method</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {payment.amount} {payment.currency}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 capitalize">{payment.provider}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
