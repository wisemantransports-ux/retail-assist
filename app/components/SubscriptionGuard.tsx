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
      const res = await fetch("/api/auth/me");
      const data = await res.json();

      if (!res.ok) {
        router.push("/auth/login");
        return;
      }

      const userData = data.user;
      setUser(userData);

      if (userData.role === "admin") {
        setLoading(false);
        return;
      }

      const paymentStatus = userData.payment_status || "unpaid";
      const subStatus = userData.subscription_status || "pending";

      if (paymentStatus === "unpaid" || subStatus === "pending") {
        setUserStatus("unpaid");
        setLoading(false);
        return;
      }

      if (subStatus === "awaiting_approval") {
        setUserStatus("awaiting_approval");
        setLoading(false);
        return;
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">💳</div>
          <h1 className="text-2xl font-bold text-white mb-4">Payment Required</h1>
          <p className="text-gray-400 mb-6">
            Please complete your payment to activate your account and access all features.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/dashboard/billing/payment-required")}
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg cursor-pointer"
            >
              Complete Payment
            </button>
            <button
              onClick={() => router.push("/auth/login")}
              className="block w-full text-gray-400 hover:text-white text-sm cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userStatus === "awaiting_approval") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-white mb-4">Awaiting Admin Approval</h1>
          <p className="text-gray-400 mb-6">
            Thank you for your payment! Your account is being reviewed and will be activated within 24 hours.
          </p>
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 mb-6">
            <p className="text-green-200 text-sm">
              <strong>Payment Status:</strong> Confirmed<br />
              <strong>Next Step:</strong> Admin review in progress
            </p>
          </div>
          <Link
            href="/auth/login"
            className="block text-gray-400 hover:text-white text-sm"
          >
            Back to Login
          </Link>
        </div>
      </div>
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
        const res = await fetch("/api/auth/me");
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
    if (!user || user.role === "admin") return true;
    const subStatus = user.subscription_status;
    if (subStatus !== "active") return false;

    const limits = user.plan_limits;
    if (!limits) return true;
    if (feature === "instagram") return limits.hasInstagram;
    if (feature === "ai") return limits.hasAiResponses;
    if (feature === "unlimited_pages") return limits.maxPages === -1;
    return true;
  };

  return { user, loading, canUseFeature };
}
