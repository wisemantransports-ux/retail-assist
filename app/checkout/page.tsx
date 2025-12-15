"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useBrand, type BrandConfig } from "@/config/branding.client";

const PAYPAL_PLAN_IDS = {
  starter: "P-5UR06154M6627520CNE64LUY",
  pro: "P-1UV77920V62315442NE64TUQ",
  enterprise: "P-1AS84342BJ038470VNE64XHI"
};

const plans = {
  starter: {
    id: "starter",
    name: "Starter Plan",
    price: 22,
    features: ["1 Facebook Page", "100 Comment-to-DM/month", "Basic AI responses"]
  },
  pro: {
    id: "pro",
    name: "Pro Plan",
    price: 45,
    features: ["3 Pages/Accounts", "Instagram included", "500 Comment-to-DM/month"]
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise Plan",
    price: 75,
    features: ["Unlimited pages", "Priority support", "Unlimited automation"]
  }
};

type PlanType = keyof typeof plans;

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") as PlanType | null;
  const cancelled = searchParams.get("cancelled");
  const brand = useBrand();
  
  const [currentPlan, setCurrentPlan] = useState<PlanType>(planParam && plans[planParam] ? planParam : "starter");
  const [error] = useState<string | null>(
    cancelled ? "Payment was cancelled. You can try again when ready." : null
  );

  function handleSubscribe() {
    const planId = PAYPAL_PLAN_IDS[currentPlan];
    window.location.href = `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${planId}`;
  }

  const plan = plans[currentPlan];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-gray-800 border border-gray-700 rounded-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Subscribe to {brand.name}</h1>
          <p className="text-gray-400">Select your plan and complete payment with PayPal</p>
        </div>

        <div className="flex gap-2 mb-6">
          {(Object.keys(plans) as PlanType[]).map((key) => (
            <button
              key={key}
              onClick={() => setCurrentPlan(key)}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                currentPlan === key
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-600 text-gray-400 hover:border-blue-400 hover:text-white"
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-white font-semibold">{plan.name}</span>
            <span className="text-2xl font-bold text-blue-400">
              ${plan.price}<span className="text-sm text-gray-400">/mo</span>
            </span>
          </div>
          <ul className="space-y-2">
            {plan.features.map((feature, i) => (
              <li key={i} className="text-gray-300 text-sm flex items-center gap-2">
                <span className="text-green-400">✓</span> {feature}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          className="w-full bg-[#FFC439] hover:bg-[#f0b72f] text-[#003087] font-bold py-4 rounded-lg text-lg flex items-center justify-center gap-3 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23A.78.78 0 0 1 5.715 1.5h6.265c2.773 0 4.669.746 5.64 2.217.453.688.681 1.434.694 2.28.014.913-.206 2.012-.66 3.267l-.018.053v.01c-.633 1.996-1.701 3.513-3.177 4.513-1.418.96-3.19 1.447-5.27 1.447H7.304a.641.641 0 0 0-.633.545l-.595 3.505z"/>
          </svg>
          Subscribe with PayPal - ${plan.price}/mo
        </button>

        <p className="text-center text-gray-500 text-sm mt-4">
          You will be redirected to PayPal to complete your subscription.
          After payment, your account will be activated by our admin team.
        </p>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <Link
            href="/dashboard/billing/payment-required"
            className="block text-center text-gray-400 hover:text-white text-sm"
          >
            Back to App
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
