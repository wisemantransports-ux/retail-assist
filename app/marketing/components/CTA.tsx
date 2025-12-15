"use client";

import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-20">
      <div className="container-max">
        <div className="card text-center relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-2xl"></div>

          {/* Content */}
          <div className="relative z-10">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Ready to Transform Your Customer Service?
            </h2>
            <p className="text-xl text-muted mb-8 max-w-2xl mx-auto">
              Get started in minutes. No credit card required. Start your free trial today.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <button className="btn-primary px-8 py-3 text-lg">
                  Start Free Trial
                </button>
              </Link>
              <Link href="mailto:support@samuel.dev">
                <button className="btn-secondary px-8 py-3 text-lg">
                  Schedule Demo
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
