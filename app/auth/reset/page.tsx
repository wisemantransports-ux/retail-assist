"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        }
      );

      if (resetError) throw resetError;

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-card-bg">
        <div className="w-full max-w-md">
          <div className="card text-center space-y-4">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold">Check Your Email</h2>
            <p className="text-muted">
              We've sent password reset instructions to {email}. Check your inbox and follow the link to reset your password.
            </p>
            <Link href="/auth/login">
              <button className="w-full btn-primary mt-6">Back to Login</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-card-bg">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
          <p className="text-muted">Enter your email and we'll send you a reset link</p>
        </div>

        {/* Card */}
        <div className="card space-y-6">
          {error && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-background border border-card-border rounded-lg px-4 py-2 text-foreground placeholder-muted focus:outline-none focus:border-primary transition-colors"
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2 font-semibold disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          {/* Back to Login */}
          <div className="text-center">
            <Link href="/auth/login" className="text-primary hover:underline text-sm">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
