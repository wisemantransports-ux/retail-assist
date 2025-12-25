"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$22/month',
    features: ['Facebook Messenger', 'Comment-to-DM (100/month)', '1 Page', 'Basic AI']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$45/month',
    features: ['Facebook + Instagram', 'Comment-to-DM (500/month)', '3 Pages', 'AI Responses']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$75/month',
    features: ['All Features', 'Unlimited Pages', 'Priority Support', 'Custom Rules']
  }
];

function SignupForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  // keep a selectedPlan in state so we can honour ?plan= links but keep UI minimal
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const planFromUrl = searchParams.get('plan');
    if (planFromUrl && ['starter', 'pro', 'enterprise'].includes(planFromUrl)) {
      setSelectedPlan(planFromUrl);
    }
  }, [searchParams]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!phone) {
      setError("Phone number is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          business_name: businessName,
          phone,
          plan_type: selectedPlan
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // automatically go to dashboard (session created server-side)
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="w-full max-w-md text-center">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8">
            <div className="text-6xl mb-4 text-green-400">&#10003;</div>
            <h1 className="text-2xl font-bold text-white mb-4">Account Created!</h1>
            <p className="text-gray-400 mb-4">
              Your account has been created. You can access the dashboard now — some premium features are locked until you upgrade.
            </p>
            <div className="space-y-3">
              <Link href="/dashboard" className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg">Go to Dashboard</Link>
              <Link href="/pricing" className="block w-full text-gray-400 hover:text-white text-sm">View Plans & Upgrade</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white mb-2">Get Started — It’s Free</h1>
          <p className="text-gray-400">Sign up to access your dashboard. Upgrade anytime to unlock premium features.</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business name"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+267 7X XXX XXX"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>


            </div>





            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="text-center text-gray-400 text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-blue-400 hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/pricing" className="text-gray-400 hover:text-white text-sm">
            View detailed pricing &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <SignupForm />
    </Suspense>
  );
}
