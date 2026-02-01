"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchUserRoleWithRetry } from "@/lib/auth/fetchUserRole";

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

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length < 8 || /^[a-zA-Z]*$/.test(pwd)) {
      return "Weak";
    }
    if (pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /\d/.test(pwd)) {
      if (pwd.length >= 10 && /[^a-zA-Z\d]/.test(pwd)) {
        return "Strong";
      }
      return "Medium";
    }
    return "Weak";
  };

  const passwordStrength = getPasswordStrength(password);

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

      // ===== CRITICAL: Wait for auth context to be ready =====
      // After signup succeeds, the backend has set Supabase cookies
      // Give the browser a moment to ensure cookies are fully set
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log('[Signup Page] Waiting for auth context to initialize...');

      // Call /api/auth/me to ensure backend validates and auth context syncs
      // Retry up to 3 times with delays to ensure auth is ready
      let meResponse = null;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          meResponse = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include',
          });

          if (meResponse.ok) {
            console.log('[Signup Page] Auth validation succeeded on attempt', attempt);
            break;
          }

          console.warn('[Signup Page] Auth validation failed on attempt', attempt, '- retrying...');

          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (err) {
          lastError = err as Error;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

      if (!meResponse?.ok) {
        throw new Error(`Auth validation failed after signup${lastError ? ': ' + lastError.message : ''}`);
      }

      const meData = await meResponse.json();
      const role = meData.role;
      const workspaceId = meData.workspaceId;

      console.log('[Signup Page] Role from /api/auth/me:', role);
      console.log('[Signup Page] Workspace ID from /api/auth/me:', workspaceId);

      // Determine redirect target based on role
      let targetPath = '/unauthorized';

      if (role === 'super_admin') {
        targetPath = '/admin';
        console.log('[Signup Page] Super admin detected, redirecting to /admin');
      } else if (role === 'platform_staff') {
        targetPath = '/admin/support';
        console.log('[Signup Page] Platform staff detected, redirecting to /admin/support');
      } else if (role === 'admin') {
        targetPath = '/dashboard';
        console.log('[Signup Page] Client admin detected, redirecting to /dashboard');
      } else if (role === 'employee') {
        targetPath = '/employees/dashboard';
        console.log('[Signup Page] Employee detected, redirecting to /employees/dashboard');
      }

      console.log('[Signup Page] Final redirect target:', targetPath);
      // NOW redirect - auth context is confirmed ready
      // Use router.replace to prevent back button to signup page
      router.replace(targetPath);
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-white mb-2">Get Started Free — Explore Your Dashboard Today</h1>
          <p className="text-gray-400">Sign up in seconds and start seeing how Retail Assist automates your customer conversations. No credit card required. Experience your inbox, automation rules, and integrations immediately. Upgrade anytime to unlock full AI-powered features.</p>
          <p className="text-gray-400 mt-2">Providing your email and phone number helps us keep you connected and send tips to make the most of your dashboard.</p>
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
                {password && (
                  <p 
                    className={`text-sm mt-1 ${passwordStrength === 'Weak' ? 'text-red-400' : passwordStrength === 'Medium' ? 'text-yellow-400' : 'text-green-400'}`}
                    title="Use at least 1 uppercase letter, 1 number, and 1 symbol for stronger password."
                  >
                    Strength: {passwordStrength}
                  </p>
                )}
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
            By signing up, you agree to our <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a> and <a href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>.
          </div>

          <div className="text-center text-gray-400 text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-blue-400 hover:underline font-semibold">
              Log In
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
