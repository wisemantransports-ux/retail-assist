'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getAllPlans, getWorkspaceSubscription, getBillingPaymentHistory } from '@/lib/supabase/queries';
import type { Plan, Subscription, BillingPayment } from '@/lib/types/database';

export default function BillingPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [subRes, plansRes, paymentRes] = await Promise.all([
          getWorkspaceSubscription(workspaceId),
          getAllPlans(),
          getBillingPaymentHistory(workspaceId),
        ]);

        if (!subRes.error) setSubscription(subRes.data);
        if (!plansRes.error) setPlans(plansRes.data || []);
        if (!paymentRes.error) setPayments(paymentRes.data || []);
      } catch (e) {
        console.error('Failed to load billing data:', e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [workspaceId]);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading billing information...</div>;
  }

  return (
    <div className="space-y-8 p-8">
      {/* Current Subscription */}
      {subscription ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Current Subscription</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-semibold">{subscription.plan_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className={`font-semibold ${subscription.status === 'active' ? 'text-green-600' : 'text-orange-600'}`}>
                {subscription.status.toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Billing Cycle</p>
              <p className="font-semibold">{subscription.billing_cycle}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Renewal Date</p>
              <p className="font-semibold">{subscription.renewal_date ? new Date(subscription.renewal_date).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/${workspaceId}/billing/checkout`} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Change Plan
            </Link>
            <button className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
              Manage Subscription
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">No Active Subscription</h2>
          <p className="text-gray-600 mb-6">Choose a plan below to get started.</p>
          <Link href={`/dashboard/${workspaceId}/billing/checkout`} className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Select a Plan
          </Link>
        </div>
      )}

      {/* Available Plans */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="border border-gray-200 rounded p-4 hover:border-blue-400">
              <h3 className="font-semibold text-lg mb-2">{plan.display_name}</h3>
              <p className="text-gray-600 text-sm mb-2">{plan.description}</p>
              <p className="text-2xl font-bold mb-4">${plan.price_monthly}/mo</p>
              <Link href={`/dashboard/${workspaceId}/billing/checkout?planId=${plan.id}`} className="text-blue-600 hover:text-blue-700 text-sm">
                Select Plan →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4">Payment History</h2>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Provider</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 10).map((payment) => (
                <tr key={payment.id} className="border-b">
                  <td className="py-2">{new Date(payment.created_at).toLocaleDateString()}</td>
                  <td className="py-2">${payment.amount} {payment.currency}</td>
                  <td className="py-2 capitalize">{payment.provider}</td>
                  <td className={`py-2 capitalize font-semibold ${payment.status === 'completed' ? 'text-green-600' : payment.status === 'pending' ? 'text-orange-600' : 'text-red-600'}`}>
                    {payment.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
