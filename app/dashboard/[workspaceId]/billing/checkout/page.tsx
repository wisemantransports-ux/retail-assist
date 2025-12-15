'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAllPlans, getPlanById } from '@/lib/supabase/queries';
import type { Plan } from '@/lib/types/database';

interface CheckoutPageProps {
  params: { workspaceId: string };
}

export default function CheckoutPage({ params }: CheckoutPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId;
  const planId = searchParams.get('plan');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'momo'>('paypal');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoading(true);
      const result = await getAllPlans();
      if (result.data) {
        setPlans(result.data);
        if (planId) {
          const plan = result.data.find((p) => p.id === planId);
          if (plan) {
            setSelectedPlan(plan);
          } else if (result.data.length > 0) {
            setSelectedPlan(result.data[0]);
          }
        } else if (result.data.length > 0) {
          setSelectedPlan(result.data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading plans:', err);
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (!selectedPlan) {
      setError('Please select a plan');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (paymentMethod === 'paypal') {
        // Initiate PayPal checkout
        const response = await fetch('/api/billing/checkout/paypal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: selectedPlan.id,
            billingCycle,
            workspaceId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create PayPal order');
        }

        const data = await response.json();
        if (data.approvalUrl) {
          // Redirect to PayPal
          window.location.href = data.approvalUrl;
        }
      } else {
        // Initiate Mobile Money checkout
        if (!phoneNumber) {
          setError('Please enter your phone number');
          return;
        }

        const response = await fetch('/api/billing/checkout/momo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: selectedPlan.id,
            phoneNumber,
            billingCycle,
            workspaceId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to initiate mobile money payment');
        }

        const data = await response.json();
        // Show success message with reference code
        alert(`Payment Reference: ${data.referenceCode}\n\n${data.message}`);
        router.push(`/dashboard/${workspaceId}/billing`);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'An error occurred during checkout');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Loading plans...</div>
      </div>
    );
  }

  const amount = billingCycle === 'yearly' ? selectedPlan?.price_yearly : selectedPlan?.price_monthly;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Choose Your Plan</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Plan Selection */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => setSelectedPlan(plan)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition ${
              selectedPlan?.id === plan.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <h3 className="font-semibold text-gray-900">{plan.display_name}</h3>
            <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
            <div className="mt-3">
              <p className="text-lg font-bold text-gray-900">
                ${plan.price_monthly}
                <span className="text-sm text-gray-600"> /month</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Billing Cycle */}
      <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing Cycle</h2>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="monthly"
              checked={billingCycle === 'monthly'}
              onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
              className="mr-2"
            />
            <span className="text-gray-900">Monthly - ${selectedPlan?.price_monthly}</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="yearly"
              checked={billingCycle === 'yearly'}
              onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
              className="mr-2"
            />
            <span className="text-gray-900">
              Yearly - ${selectedPlan?.price_yearly} <span className="text-green-600 text-sm">(Save 20%)</span>
            </span>
          </label>
        </div>
      </div>

      {/* Payment Method */}
      <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
        <div className="space-y-4">
          <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              value="paypal"
              checked={paymentMethod === 'paypal'}
              onChange={(e) => setPaymentMethod(e.target.value as 'paypal' | 'momo')}
              className="mt-1 mr-3"
            />
            <div>
              <p className="font-semibold text-gray-900">PayPal</p>
              <p className="text-sm text-gray-600">Fast, secure payment processing</p>
            </div>
          </label>

          <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              value="momo"
              checked={paymentMethod === 'momo'}
              onChange={(e) => setPaymentMethod(e.target.value as 'paypal' | 'momo')}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Mobile Money</p>
              <p className="text-sm text-gray-600">MTN, Vodacom, or Airtel</p>
            </div>
          </label>
        </div>

        {/* Mobile Money Phone Input */}
        {paymentMethod === 'momo' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <label className="block mb-2">
              <span className="text-sm font-semibold text-gray-900">Phone Number</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="267 71 123 456"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-600 mt-2">Botswana mobile numbers starting with +267</p>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-gray-900">
            <span>{selectedPlan?.display_name}</span>
            <span>${amount}</span>
          </div>
          <div className="flex justify-between text-gray-900">
            <span>Billing Cycle</span>
            <span className="capitalize">{billingCycle}</span>
          </div>
          <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span>${amount}</span>
          </div>
        </div>
      </div>

      {/* Checkout Button */}
      <button
        onClick={handleCheckout}
        disabled={submitting || !selectedPlan}
        className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
      >
        {submitting ? 'Processing...' : `Proceed to ${paymentMethod === 'paypal' ? 'PayPal' : 'Payment'}`}
      </button>

      <button
        onClick={() => router.back()}
        className="w-full mt-3 px-6 py-3 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300 transition"
      >
        Cancel
      </button>
    </div>
  );
}
