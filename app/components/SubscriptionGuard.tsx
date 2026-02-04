"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  business_name: string;
  payment_status?: string;
  subscription_status?: string;
  plan_type?: string;
  plan_name?: string;
  plan_limits?: {
    maxPages: number;
    hasInstagram: boolean;
    hasAiResponses: boolean;
    commentToDmLimit: number;
  };
  role: string;
}

interface SubscriptionGuardProps {
  children: React.ReactNode;
  requiredFeature?: "instagram" | "ai" | "comment_to_dm";
}

export default function SubscriptionGuard({ children, requiredFeature }: SubscriptionGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [userStatus, setUserStatus] = useState<"unpaid" | "awaiting_approval" | "active" | "suspended" | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const res = await fetch("/api/auth/me", { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        router.push("/auth/login");
        return;
      }

      const userData = data.user;
      setUser(userData);

      if (userData.role === "admin" || userData.role === "super_admin") {
        setLoading(false);
        return;
      }

      const paymentStatus = userData.payment_status || "unpaid";
      const subStatus = userData.subscription_status || "pending";

      if (paymentStatus === "unpaid" || subStatus === "pending") {
        // allow free/pending users into the dashboard but mark as limited access
        setUserStatus("unpaid");
        setLoading(false);
        // don't return — let them access the dashboard with limited features
      }

      if (subStatus === "awaiting_approval") {
        // payment received but awaiting admin approval — allow access with notice
        setUserStatus("awaiting_approval");
        setLoading(false);
        // don't return — show info banner instead of blocking
      }

      if (subStatus === "suspended") {
        setUserStatus("suspended");
        setAccessDenied(true);
        setDenialReason("Your account has been suspended. Please contact support.");
        setLoading(false);
        return;
      }

      if (subStatus !== "active") {
        setAccessDenied(true);
        setDenialReason("Your subscription is inactive. Please contact support.");
        setLoading(false);
        return;
      }

      if (requiredFeature && userData.plan_limits) {
        const limits = userData.plan_limits;
        if (requiredFeature === "instagram" && !limits.hasInstagram) {
          setAccessDenied(true);
          setDenialReason("Instagram automation is only available on Pro and Enterprise plans.");
        } else if (requiredFeature === "ai" && !limits.hasAiResponses) {
          setAccessDenied(true);
          setDenialReason("AI responses require a paid plan.");
        }
      }

      setLoading(false);
    } catch {
      router.push("/auth/login");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (userStatus === "unpaid") {
    // show a non-blocking banner and let the user access the dashboard with limited features
    return (
      <>
        <div className="w-full bg-yellow-900/90 text-yellow-200 py-3">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-2xl">�</div>
              <div>
                <div className="font-semibold">View-only Dashboard</div>
                <div className="text-sm text-yellow-200/90">Products are locked until you subscribe — you can browse and inspect the dashboard, but creation/actions are disabled. We'll follow up by email or phone to help you subscribe.</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/pricing" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md font-semibold">View Plans</Link>
              <a href="mailto:sales@retailassist.com" className="text-sm text-white/90 underline">Contact Sales</a>
            </div>
          </div>
        </div>

        {children}
      </>
    );
  }

  if (userStatus === "awaiting_approval") {
    // show an info banner while still allowing access
    return (
      <>
        <div className="w-full bg-blue-900/90 text-blue-200 py-3">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-2xl">⏳</div>
              <div>
                <div className="font-semibold">Awaiting Approval</div>
                <div className="text-sm text-blue-200/90">Payment received — your account is under review. Some features may be pending activation.</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/dashboard/billing" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md font-semibold">Billing</Link>
            </div>
          </div>
        </div>

        {children}
      </>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4 text-yellow-400">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Access Restricted</h1>
          <p className="text-gray-400 mb-6">{denialReason}</p>
          <div className="space-y-3">
            <Link
              href="/pricing"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
            >
              View Plans & Upgrade
            </Link>
            <a
              href="mailto:support@retailassist.com"
              className="block text-gray-400 hover:text-white text-sm"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useSubscription() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me", { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setUser(data.user);
        }
      } catch {
        console.error("Failed to fetch user");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const canUseFeature = (feature: "instagram" | "ai" | "unlimited_pages") => {
    if (!user || user.role === "admin" || user.role === "super_admin") return true;
    const subStatus = user.subscription_status;
    if (subStatus !== "active") return false;

    const limits = user.plan_limits;
    if (!limits) return true;
    if (feature === "instagram") return limits.hasInstagram;
    if (feature === "ai") return limits.hasAiResponses;
    if (feature === "unlimited_pages") return limits.maxPages === -1;
    return true;
  };

  const readOnly = !!user && user.role !== "admin" && user.role !== "super_admin" && user.subscription_status !== "active";

  return { user, loading, canUseFeature, readOnly };
}
