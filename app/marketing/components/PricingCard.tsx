"use client";

import Link from "next/link";
import React from "react";
import { trackPricingCTA } from "@/lib/analytics";

// Type for a single plan. Keep this exportable so plans can be built/updated elsewhere.
export type Plan = {
  id: string;
  name: string;
  price: string; // formatted price (e.g., "BWP 350")
  period?: string;
  description: string;
  features: string[];
  channels: string[]; // channels supported, e.g., ['Facebook Messenger', 'Instagram']
  aiLimits?: string; // e.g., "10k messages/month"
  support: string; // e.g., 'Email support'
  cta: string;
  popular?: boolean;
  note?: string; // e.g., 'WhatsApp automation coming soon'
};

export default function PricingCard({ plan }: { plan: Plan }) {
  // Accessible button label
  const buttonLabel = `${plan.cta} - ${plan.name}`;

  return (
    <article
      aria-labelledby={`plan-${plan.id}-title`}
      className={`flex flex-col rounded-lg border transition-transform transform hover:-translate-y-2 hover:shadow-xl focus-within:-translate-y-2 focus-within:shadow-xl outline-none 
        ${plan.popular ? "ring-2 ring-primary scale-102" : ""} bg-white text-background`}
      tabIndex={0}
    >
      {/* Badge */}
      <div className="relative p-6">
        {plan.popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center bg-primary text-white text-sm font-semibold px-3 py-1 rounded-full">
              Most Popular
            </span>
          </div>
        )}

        <header className="mb-4">
          <h3 id={`plan-${plan.id}-title`} className="text-2xl font-semibold">
            {plan.name}
          </h3>
          <p className="text-sm text-muted mt-1">{plan.description}</p>
        </header>

        <div className="flex items-baseline gap-3 mb-6">
          <p className="text-3xl font-bold tracking-tight">{plan.price}</p>
          {plan.period && <span className="text-sm text-muted">{plan.period}</span>}
        </div>

        {/* Channels */}
        <div className="mb-4" aria-hidden>
          <div className="flex items-center gap-2 text-sm">
            {plan.channels.map((c) => (
              <span key={c} className="inline-flex items-center gap-2 bg-blue-50 text-primary px-2 py-1 rounded-md">
                {/* simple check / channel icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-medium">{c}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Key features list */}
        <ul className="mb-6 space-y-3" aria-label={`${plan.name} features`}>
          {plan.features.map((f, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586l-3.293-3.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="text-sm text-muted">{f}</span>
            </li>
          ))}
        </ul>

        {/* Meta row */}
        <div className="mb-6 text-sm text-muted">
          <div>
            <strong className="text-base text-background">AI Usage:</strong> <span className="ml-2">{plan.aiLimits ?? "—"}</span>
          </div>
          <div>
            <strong className="text-base text-background">Support:</strong> <span className="ml-2">{plan.support}</span>
          </div>
        </div>

        {/* Note for enterprise */}
        {plan.note && (
          <div className="mb-4 text-sm text-muted">{plan.note}</div>
        )}

        {/* CTA */}
        <div className="space-y-2">
          {plan.id === "enterprise" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={`mailto:samuelhelp80@gmail.com`}
                onClick={() => trackPricingCTA(plan.id, plan.name, 'email')}
                className="inline-block w-full text-center py-3 px-4 rounded-md bg-transparent border border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors"
                aria-label={`${buttonLabel} via email`}
              >
                {plan.cta}
              </a>

              {/* WhatsApp contact button (opens WhatsApp chat) */}
              <a
                href={`https://wa.me/26775902379`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPricingCTA(plan.id, plan.name, 'whatsapp')}
                className="inline-block w-full text-center py-3 px-4 rounded-md bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors"
                aria-label={`Chat on WhatsApp +267 759 02379`}
              >
                WhatsApp +267 759 02379
              </a>
            </div>
          ) : (
            <Link
              href={`/auth/signup?plan=${plan.id}`}
              onClick={() => trackPricingCTA(plan.id, plan.name, 'signup')}
              className="inline-block w-full text-center py-3 px-4 rounded-md bg-primary text-white font-semibold hover:bg-primary/90 focus:ring-2 focus:ring-primary/30 transition-colors"
              aria-label={buttonLabel}
            >
              {plan.cta}
            </Link>
          )}
        </div>
      </div>

      {/* Visual footer (subtle) */}
      <footer className="mt-auto px-6 py-3 bg-blue-50 text-sm text-muted rounded-b-lg">
        <p className="text-center">Start free trial · No credit card required</p>
      </footer>
    </article>
  );
}
