"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PAYPAL_PLAN_IDS = {
  starter: "P-5UR06154M6627520CNE64LUY",
  pro: "P-1UV77920V62315442NE64TUQ",
  enterprise: "P-1AS84342BJ038470VNE64XHI"
};

const PLAN_DETAILS = {
  starter: { name: "Starter", price: 22, features: ["1 Facebook Page", "100 Comment-to-DM/month", "Basic AI responses"] },
  pro: { name: "Pro", price: 45, features: ["3 Pages/Accounts", "Instagram included", "500 Comment-to-DM/month"] },
  enterprise: { name: "Enterprise", price: 75, features: ["Unlimited pages", "Priority support", "Unlimited automation"] }
};

interface User {
  id: string;
  email: string;
  business_name: string;
  plan_type: "starter" | "pro" | "enterprise";
  payment_status: string;
  subscription_status: string;
}

export default function PaymentRequiredPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me", { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        router.push("/auth/login");
        return;
      }
      setUser(data.user);
      
      if (data.user.subscription_status === "active") {
        router.push("/dashboard");
      }
    } catch {
      router.push("/auth/login");
    } finally {
      setLoading(false);
    }
  }

  function handleSubscribe() {
    if (!user) return;
    const planId = PAYPAL_PLAN_IDS[user.plan_type];
    window.location.href = `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${planId}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) return null;

  const plan = PLAN_DETAILS[user.plan_type] || PLAN_DETAILS.starter;

  if (user.subscription_status === "awaiting_approval") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-white mb-4">Awaiting Admin Approval</h1>
          <p className="text-gray-400 mb-6">
            Thank you for your payment! Your account is being reviewed by our team. 
            You will receive access within 24 hours.
          </p>
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 mb-6">
            <p className="text-green-200 text-sm">
              <strong>Payment Status:</strong> Confirmed<br />
              <strong>Plan:</strong> {plan.name} (${plan.price}/month)
            </p>
          </div>
          <Link
            href="/auth/login"
            className="block text-gray-400 hover:text-white text-sm"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-gray-800 border border-gray-700 rounded-xl p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💳</div>
          <h1 className="text-2xl font-bold text-white mb-2">Complete Your Payment</h1>
          <p className="text-gray-400">
            Your account will be activated after payment and admin approval.
          </p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-white font-semibold">{plan.name} Plan</span>
            <span className="text-2xl font-bold text-blue-400">${plan.price}<span className="text-sm text-gray-400">/mo</span></span>
          </div>
          <ul className="space-y-2">
            {plan.features.map((feature, i) => (
              <li key={i} className="text-gray-300 text-sm flex items-center gap-2">
                <span className="text-green-400">✓</span> {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleSubscribe}
            className="w-full bg-[#FFC439] hover:bg-[#f0b72f] text-[#003087] font-bold py-4 rounded-lg text-lg flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23A.78.78 0 0 1 5.715 1.5h6.265c2.773 0 4.669.746 5.64 2.217.453.688.681 1.434.694 2.28.014.913-.206 2.012-.66 3.267l-.018.053v.01c-.633 1.996-1.701 3.513-3.177 4.513-1.418.96-3.19 1.447-5.27 1.447H7.304a.641.641 0 0 0-.633.545l-.595 3.505z"/>
            </svg>
            Subscribe with PayPal
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700">
          <Link
            href="/pricing"
            className="block text-center text-gray-400 hover:text-white text-sm"
          >
            Change Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
