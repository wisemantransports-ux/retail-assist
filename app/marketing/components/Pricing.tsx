"use client";

import Link from "next/link";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$22",
    period: "/month",
    description: "Perfect for small businesses getting started",
    features: [
      "Facebook Messenger auto-reply",
      "Comment-to-DM automation (100/month)",
      "1 Facebook Page",
      "Basic AI responses",
      "Email support",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$45",
    period: "/month",
    description: "For growing businesses with higher volume",
    features: [
      "Facebook + Instagram automation",
      "Comment-to-DM automation (500/month)",
      "3 Pages/Accounts",
      "AI-powered responses",
      "Priority support",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$75",
    period: "/month",
    description: "Enterprise solution with full customization",
    features: [
      "All features unlocked",
      "Unlimited pages/accounts",
      "Unlimited Comment-to-DM",
      "Priority support",
      "Custom automation rules",
      "Dedicated account manager",
    ],
    cta: "Get Started",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section className="py-20">
      <div className="container-max">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Choose the perfect plan for your business. No hidden fees, cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`card relative flex flex-col ${
                plan.popular ? "md:scale-105 border-primary" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-primary to-accent text-background px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted">{plan.period}</span>
                </div>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="text-secondary">&#10003;</span>
                    <span className="text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={`/auth/signup?plan=${plan.id}`}>
                <button
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                    plan.popular
                      ? "btn-primary"
                      : "bg-card-border text-foreground hover:bg-card-border/80"
                  }`}
                >
                  {plan.cta}
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
