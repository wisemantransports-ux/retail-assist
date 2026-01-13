"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBrand } from "@/config/branding.client";

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 350,
    priceAlt: 'BWP 25',
    period: '/month',
    description: 'Perfect for small businesses just getting started',
    features: [
      'Facebook OR Instagram + Website Chat',
      'Basic Automation',
      'AI Auto-Replies (50K tokens/month)',
      'Community Support'
    ],
    cta: 'Get Started',
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 600,
    priceAlt: 'BWP 36',
    period: '/month',
    description: 'For growing businesses with higher volume',
    features: [
      'Facebook + Instagram + Website Chat',
      'Advanced Automation',
      'AI Auto-Replies (150K tokens/month)',
      'Priority Support'
    ],
    cta: 'Get Started',
    popular: true
  },
  {
    id: 'advanced',
    name: 'Advanced',
    price: 900,
    priceAlt: 'BWP 72',
    period: '/month',
    description: 'For enterprises with maximum scale and flexibility',
    features: [
      'Facebook + Instagram + Website Chat',
      'Full Automation (Unlimited rules)',
      'AI Auto-Replies (500K tokens/month)',
      'Priority Support'
    ],
    cta: 'Get Started',
    popular: false
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    priceAlt: 'Contact Sales',
    period: '',
    description: 'White-labeled solution with dedicated support and enterprise-specific features',
    features: [
      'All Channels (Custom setup)',
      'Custom Automation',
      'AI Auto-Replies (Custom tokens)',
      'White-label capabilities',
      'Dedicated Support & Account Manager'
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

export default function PricingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const router = useRouter();
  const brand = useBrand();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(true);
        setUserPlan(data.user.plan_type);
      }
    } catch {
      // Not logged in
    }
  }

  async function handlePlanSelect(planId: string) {
    // Enterprise requires manual contact - don't allow direct selection
    if (planId === 'enterprise') {
      window.location.href = `mailto:${brand.supportEmail}`;
      return;
    }
    
    if (isLoggedIn) {
      // Update user's plan and go to payment
      await fetch("/api/billing/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_type: planId })
      });
      router.push("/dashboard/billing/payment-required");
    } else {
      router.push(`/auth/signup?plan=${planId}`);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <nav className="px-6 py-4 border-b border-gray-700">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-white">{brand.name}</Link>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-400 hover:text-white">Login</Link>
                <Link href="/auth/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Choose the perfect plan for your business. Automate your Facebook & Instagram 
            customer conversations and grow your sales.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-gray-800 rounded-xl p-8 border ${
                plan.popular ? 'border-blue-500 scale-105' : 'border-gray-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  {plan.price !== null ? (
                    <>
                      <span className="text-4xl font-bold text-white">${plan.price}</span>
                      <span className="text-gray-400">{plan.period}</span>
                      <span className="text-gray-500 text-sm ml-2">({plan.priceAlt})</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-blue-400">{plan.priceAlt}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="text-green-400">&#10003;</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanSelect(plan.id)}
                disabled={isLoggedIn && userPlan === plan.id}
                className={`block w-full text-center py-3 rounded-lg font-semibold transition-colors ${
                  isLoggedIn && userPlan === plan.id
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : plan.popular
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {isLoggedIn && userPlan === plan.id ? 'Current Plan' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Have Questions?</h2>
          <p className="text-gray-400 mb-6">
            Contact us for custom enterprise solutions or questions about our plans.
          </p>
          <a 
            href={`mailto:${brand.supportEmail}`} 
            className="text-blue-400 hover:text-blue-300 font-semibold"
          >
            {brand.supportEmail}
          </a>
        </div>
      </main>
    </div>
  );
}
