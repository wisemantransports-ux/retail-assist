'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    description: 'Perfect for small businesses',
    features: [
      'Up to 1,000 comments/month',
      'Basic automation rules',
      'Email support',
      'Single workspace',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 79,
    description: 'For growing businesses',
    features: [
      'Up to 10,000 comments/month',
      'Advanced automation',
      'Priority email & chat support',
      'Up to 5 workspaces',
      'Custom reports',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    description: 'For large organizations',
    features: [
      'Unlimited comments',
      'Full automation suite',
      '24/7 phone support',
      'Unlimited workspaces',
      'API access',
      'Custom integrations',
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'mobile-money' | null>(null);
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [workspaceId] = useState(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('workspace') : null
  );

  const planPrices: Record<string, number> = {
    starter: 29,
    professional: 79,
    enterprise: 199,
  };

  const handlePayPalPayment = async (planId: string) => {
    if (!workspaceId) {
      alert('Please select a workspace');
      return;
    }

    setLoading(true);
    try {
      const amount = planPrices[planId];
      const response = await fetch('/api/payments/paypal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'USD',
          workspaceId,
        }),
      });

      const data = await response.json();
      if (data.approvalUrl) {
        // Redirect to PayPal
        window.location.href = data.approvalUrl;
      } else {
        alert('Failed to create PayPal order');
      }
    } catch (error) {
      console.error('PayPal error:', error);
      alert('Failed to initiate PayPal payment');
    } finally {
      setLoading(false);
    }
  };

  const handleMobileMoneyPayment = async (planId: string) => {
    if (!workspaceId || !mobileMoneyPhone) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const amount = planPrices[planId];
      const response = await fetch('/api/payments/mobile-money/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          phoneNumber: mobileMoneyPhone,
          workspaceId,
          currency: 'BWP',
        }),
      });

      const data = await response.json();
      if (data.referenceCode) {
        alert(`Payment initiated! Reference: ${data.referenceCode}\n\n${data.message}`);
        setMobileMoneyPhone('');
        setPaymentMethod(null);
        // Redirect to billing page
        router.push('/dashboard/billing');
      } else {
        alert('Failed to initiate mobile money payment');
      }
    } catch (error) {
      console.error('Mobile money error:', error);
      alert('Failed to initiate mobile money payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600">Choose the plan that fits your business</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-lg border transition ${
                plan.popular
                  ? 'border-blue-500 shadow-lg scale-105'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {plan.popular && (
                <div className="bg-blue-500 text-white py-2 px-4 rounded-t-lg font-semibold text-center">
                  Most Popular
                </div>
              )}
              <div className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-6 text-sm">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-600">/month</span>
                </div>

                <button
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setPaymentMethod(null);
                  }}
                  className={`w-full py-2 px-4 rounded font-semibold transition ${
                    plan.popular
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {selectedPlan === plan.id ? 'Select Payment Method' : 'Choose Plan'}
                </button>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center text-gray-600">
                      <span className="text-green-500 mr-3">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Method Selection */}
        {selectedPlan && (
          <div className="max-w-2xl mx-auto bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Payment Method</h2>

            <div className="space-y-4 mb-8">
              <button
                onClick={() => setPaymentMethod('paypal')}
                className={`w-full p-4 border-2 rounded-lg font-semibold transition text-left ${
                  paymentMethod === 'paypal'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    P
                  </div>
                  <span>PayPal</span>
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('mobile-money')}
                className={`w-full p-4 border-2 rounded-lg font-semibold transition text-left ${
                  paymentMethod === 'mobile-money'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    M
                  </div>
                  <span>Mobile Money (MTN, Vodacom, Airtel)</span>
                </div>
              </button>
            </div>

            {/* PayPal Checkout */}
            {paymentMethod === 'paypal' && (
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  You will be redirected to PayPal to complete your payment securely.
                </p>
                <button
                  onClick={() => handlePayPalPayment(selectedPlan)}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {loading ? 'Processing...' : `Pay $${planPrices[selectedPlan]} with PayPal`}
                </button>
              </div>
            )}

            {/* Mobile Money Checkout */}
            {paymentMethod === 'mobile-money' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={mobileMoneyPhone}
                    onChange={(e) => setMobileMoneyPhone(e.target.value)}
                    placeholder="e.g., +267 71 234 567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your mobile money provider will receive a payment request
                  </p>
                </div>

                <button
                  onClick={() => handleMobileMoneyPayment(selectedPlan)}
                  disabled={loading || !mobileMoneyPhone}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
                >
                  {loading ? 'Processing...' : `Pay BWP ${planPrices[selectedPlan]} via Mobile Money`}
                </button>

                <p className="text-sm text-gray-600">
                  An admin will review and approve your payment. You'll receive a reference code to confirm your payment.
                </p>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedPlan(null);
                  setPaymentMethod(null);
                }}
                className="w-full text-gray-600 font-semibold hover:text-gray-900"
              >
                Back to Plans
              </button>
            </div>
          </div>
        )}

        {/* Footer Links */}
        <div className="mt-12 text-center text-gray-600">
          <p>
            Need help? <Link href="/dashboard/support-ai" className="text-blue-600 hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
