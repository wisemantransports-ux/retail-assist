"use client";

import React from "react";
import PricingCard, { Plan } from "./PricingCard";

// Sample pricing data with default props — easy to update later.
const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$25 / BWP 350",
    period: "/month",
    description: "For small businesses getting started",
    channels: ["1 Social Channel", "Website Chat"],
    features: [
      "Unified Inbox",
      "Automation Rules",
      "AI Auto-Replies",
    ],
    aiLimits: "50,000 AI tokens / month",
    support: "Community Support",
    cta: "Start Free",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$36 / BWP 600",
    period: "/month",
    description: "For growing businesses",
    channels: ["Facebook + Instagram", "Website Chat"],
    features: [
      "Unified Inbox",
      "Advanced Automation Rules",
      "AI Auto-Replies",
    ],
    aiLimits: "150,000 AI tokens / month",
    support: "Priority Support",
    cta: "Start Free",
    popular: true,
  },
  {
    id: "advanced",
    name: "Advanced",
    price: "$72 / BWP 900",
    period: "/month",
    description: "For high-volume businesses",
    channels: ["Facebook + Instagram", "Website Chat"],
    features: [
      "Unlimited Workspaces",
      "Full Automation",
      "AI Auto-Replies",
    ],
    aiLimits: "500,000 AI tokens / month",
    support: "Priority Support",
    cta: "Start Free",
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Custom limits",
    channels: ["Facebook + Instagram", "Website Chat"],
    features: [
      "Dedicated support",
      "Custom integrations",
    ],
    aiLimits: "Custom",
    support: "Dedicated support",
    cta: "Contact Sales",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section className="py-20">
      <div className="container-max">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold mb-3">Plans for every business</h2>
          <p className="text-muted max-w-2xl mx-auto">
            Transparent monthly pricing in Botswana Pula — simple, predictable billing and
            upgrades when you need them.
          </p>
        </div>

        {/* Responsive grid: 1 column on mobile, 2 on small screens, 4 on large */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>

        {/* WhatsApp Coming Soon Note */}
        <div className="mt-10 text-center">
          <h3 className="text-lg font-semibold mb-2">WhatsApp Automation — Coming Soon</h3>
          <p className="text-sm text-muted max-w-2xl mx-auto">
            We’re working on WhatsApp automation for businesses that engage customers on WhatsApp. Stay tuned.
          </p>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted max-w-3xl mx-auto">
            All plans include website chat and a unified inbox. Start free, explore your dashboard, and upgrade only when you’re ready.
          </p>
        </div>
      </div>
    </section>
  );
}
