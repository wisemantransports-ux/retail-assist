'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserData {
  plan_type: string;
  plan_name: string;
  subscription_status: string;
  billing_end_date?: string;
  plan_limits?: {
    price: number;
  };
}

export default function BillingPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const getPlanPrice = (planType: string): number => {
    const prices: Record<string, number> = {
      starter: 22,
      pro: 45,
      enterprise: 75
    };
    return prices[planType] ?? 22;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const planPrice = user?.plan_limits?.price ?? getPlanPrice(user?.plan_type || 'starter');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Current Plan</h2>
        {user ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Plan</p>
                <p className="text-white font-medium capitalize">{user.plan_type}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Price</p>
                <p className="text-white font-medium">${planPrice}/month</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <span className={`inline-block px-2 py-1 rounded text-sm ${
                  user.subscription_status === 'active' 
                    ? 'bg-green-900/50 text-green-400' 
                    : 'bg-yellow-900/50 text-yellow-400'
                }`}>
                  {user.subscription_status?.toUpperCase()}
                </span>
              </div>
              {user.billing_end_date && (
                <div>
                  <p className="text-gray-400 text-sm">Next Billing Date</p>
                  <p className="text-white font-medium">
                    {new Date(user.billing_end_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No subscription information available</p>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Upgrade Plan</h2>
        <p className="text-gray-400 mb-4">
          Want more features? Upgrade your plan to unlock more pages, Instagram automation, and more.
        </p>
        <Link
          href="/pricing"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
        >
          View Plans
        </Link>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Payment Method</h2>
        <p className="text-gray-400 mb-4">
          Payments are processed via PayPal. Your subscription will be activated after payment verification.
        </p>
        <a
          href="https://paypal.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-lg font-medium"
        >
          Pay with PayPal
        </a>
      </div>
    </div>
  );
}
