"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from '@/lib/supabase/client';

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

      // After successful signup, perform client-side sign-in with Supabase
      try {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !signInData?.session) {
          throw new Error(signInError?.message || 'Sign in after signup failed');
        }

        // After client sign-in, mirror session to server cookies so /api/auth/me works
        try {
          const access_token = signInData.session.access_token;
          const refresh_token = signInData.session.refresh_token;

          if (!access_token || !refresh_token) {
            console.error('[Signup] Missing access or refresh token after sign-in - aborting sync');
            throw new Error('Missing access/refresh token from auth provider');
          }

          const syncRes = await fetch('/api/auth/sync', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token, refresh_token })
          });

          if (!syncRes.ok) {
            const body = await syncRes.json().catch(() => ({}));
            console.error('[Signup] /api/auth/sync failed', syncRes.status, body);
            if (syncRes.status === 400 && body?.error === 'Invalid refresh token') {
              // Invalid/rotated refresh token - clear local session and prompt user to re-authenticate
              try {
                await supabase.auth.signOut();
              } catch (signOutErr) {
                console.warn('[Signup] supabase.signOut() failed', signOutErr);
              }
              try { sessionStorage.removeItem('auth:recent-redirect'); } catch (e) {}
              setError('Your session expired or became invalid. Please sign in again.');
              setLoading(false);
              return;
            }
            console.warn('[Signup] session sync failed:', body || syncRes.status);
          }
        } catch (syncErr) {
          console.warn('[Signup] session sync failed:', syncErr);
          setError((syncErr as Error).message || 'Session sync failed');
          setLoading(false);
          return;
        }

        // ===== ROLE-BASED CLIENT-SIDE REDIRECT AFTER SIGNUP =====
        // Fetch role from RPC to determine redirect target
        const { data: userAccess } = await supabase.rpc('rpc_get_user_access');
        const role = userAccess?.[0]?.role;
        const workspaceId = userAccess?.[0]?.workspace_id;
        
        console.log('[Signup] User role:', role);
        console.log('[Signup] User workspace_id:', workspaceId);

        // New signups will typically be client admins (admin role)
        // But we handle all cases to be safe
        let targetPath = '/unauthorized'; // default fallback
        
        if (role === 'super_admin') {
          targetPath = '/admin';
          console.log('[Signup] Super admin detected, redirecting to /admin');
        }
        else if (role === 'platform_staff') {
          targetPath = '/support';
          console.log('[Signup] Platform staff detected, redirecting to /support');
        }
        else if (role === 'admin') {
          targetPath = '/dashboard';
          console.log('[Signup] Client admin detected, redirecting to /dashboard');
        }
        else if (role === 'employee') {
          targetPath = '/employees/dashboard';
          console.log('[Signup] Employee detected, redirecting to /employees/dashboard');
        }
        
        router.push(targetPath);
      } catch (signErr: any) {
        // If client-side sign-in fails, surface an error but do not modify backend
        setError(signErr?.message || 'Failed to sign in after signup');
      }
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
