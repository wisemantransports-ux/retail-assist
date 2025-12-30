"use client";

import React from "react";
import PricingCard, { Plan } from "./PricingCard";

// Sample pricing data with default props — easy to update later.
const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "BWP 350",
    period: "/month",
    description: "Good for micro businesses and pilot projects",
    channels: ["Facebook Messenger"],
    features: [
      "Basic automation triggers & actions",
      "Comment-to-DM (200/month)",
      "1 Page / Account",
    ],
    aiLimits: "5,000 AI requests / month",
    support: "Email support",
    cta: "Get Started",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "BWP 600",
    period: "/month",
    description: "Recommended for growing stores (most popular)",
    channels: ["Facebook Messenger", "Instagram"],
    features: [
      "Advanced automation triggers & actions",
      "Comment-to-DM (1,000/month)",
      "3 Pages / Accounts",
      "AI-enhanced responses",
    ],
    aiLimits: "25,000 AI requests / month",
    support: "Priority support",
    cta: "Get Started",
    popular: true, // highlighted as recommended
  },
  {
    id: "advanced",
    name: "Advanced",
    price: "BWP 900",
    period: "/month",
    description: "For high-volume retailers and scaling operations",
    channels: ["Facebook Messenger", "Instagram"],
    features: [
      "All Pro automations + scheduled workflows",
      "Comment-to-DM (5,000/month)",
      "10 Pages / Accounts",
      "Custom integrations",
    ],
    aiLimits: "100,000 AI requests / month",
    support: "Dedicated support",
    cta: "Get Started",
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Custom enterprise plan with dedicated onboarding",
    channels: ["Facebook Messenger", "Instagram", "WhatsApp"],
    features: [
      "Unlimited pages/accounts",
      "Custom automation & SLAs",
      "Dedicated account manager",
    ],
    aiLimits: "Custom",
    support: "Dedicated account manager",
    cta: "Contact Sales",
    popular: false,
    note: "WhatsApp automation coming soon",
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

        <div className="mt-10 text-center">
          <p className="text-sm text-muted max-w-3xl mx-auto">
            All plans include Facebook and Instagram automation where available. Need a
            custom quote or pilot? <a className="text-primary font-semibold" href="mailto:samuelhelp80@gmail.com">Contact Sales</a> or <a className="text-primary font-semibold" href="https://wa.me/26775902379" target="_blank" rel="noopener noreferrer">WhatsApp +267 759 02379</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
