"use client";

import Link from "next/link";

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center pt-20 pb-20">
      <div className="container-max text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-card-bg border border-card-border">
          <span className="w-2 h-2 bg-secondary rounded-full"></span>
          <span className="text-sm text-muted">AI-Powered Customer Automation</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          Automate Customer{" "}
          <span className="text-gradient">Conversations Effortlessly</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-muted max-w-2xl mx-auto mb-12">
          Deploy AI agents across Messenger, Instagram DM, and your website. Handle
          unlimited conversations with your custom AI personality powered by OpenAI.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/auth/signup">
            <button className="btn-primary px-8 py-3 text-lg font-semibold">
              Get Started Free
            </button>
          </Link>
          <Link href="#features">
            <button className="btn-secondary px-8 py-3 text-lg font-semibold">
              Learn More
            </button>
          </Link>
        </div>

        {/* Hero Image Placeholder */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-20 blur-3xl rounded-full"></div>
          <div className="relative bg-card-bg border border-card-border rounded-lg p-12 sm:p-16">
            <div className="aspect-video bg-card-border rounded-lg flex items-center justify-center">
              <span className="text-muted text-lg">Dashboard Preview</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
