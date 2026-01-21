'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserData {
  id: string;
  email: string;
  business_name: string;
  phone: string;
  subscription_status: string;
  plan_type: string;
  plan_name: string;
  plan_limits: {
    maxPages: number;
    hasInstagram: boolean;
    hasAiResponses: boolean;
    commentToDmLimit: number;
    price: number;
  };
  billing_end_date?: string;
  workspace_id?: string | null;
}

interface ChannelStatus {
  facebook: {
    connected: boolean;
    pages: number;
  };
  instagram: {
    connected: boolean;
    available: boolean;
  };
}

export default function ClientDashboard() {
  const [user, setUser] = useState<UserData | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelStatus>({
    facebook: { connected: false, pages: 0 },
    instagram: { connected: false, available: false },
  });
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [counts, setCounts] = useState({
    inbox: 0,
    rules: 0,
    pages: 0,
    aiUsage: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        setUserRole(data.user.role);
        console.log('[Dashboard] User role from API:', data.user.role);

        const hasInstagram =
          data.user.plan_limits?.hasInstagram ||
          ['pro', 'advanced', 'enterprise'].includes(data.user.plan_type);

        setChannels({
          facebook: { connected: false, pages: 0 },
          instagram: { connected: false, available: hasInstagram },
        });

        setSetupComplete(false);

        const [
          inboxRes,
          rulesRes,
          pagesRes,
          aiUsageRes,
        ] = await Promise.all([
          fetch('/api/inbox'),
          fetch('/api/automation-rules'),
          fetch('/api/meta/pages'),
          fetch('/api/ai/usage'),
        ]);

        const inboxData = inboxRes.ok ? await inboxRes.json() : { conversations: [] };
        const rulesData = rulesRes.ok ? await rulesRes.json() : [];
        const pagesData = pagesRes.ok ? await pagesRes.json() : { pages: [] };
        const aiUsageData = aiUsageRes.ok ? await aiUsageRes.json() : { count: 0 };

        setCounts({
          inbox: inboxData.conversations?.length || 0,
          rules: rulesData.length || 0,
          pages: pagesData.pages?.length || 0,
          aiUsage: aiUsageData.count || 0,
        });
      }
    } catch (error) {
      console.error('[Dashboard] Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function getPlanPrice(planType: string): number {
    const prices: Record<string, number> = {
      starter: 25,
      pro: 36,
      advanced: 72,
      enterprise: 0,
    };
    return prices[planType] ?? prices.starter;
  }

  function getPlanBadgeColor(planType: string): string {
    const colors: Record<string, string> = {
      starter: 'bg-gray-600',
      pro: 'bg-blue-600',
      enterprise: 'bg-purple-600',
    };
    return colors[planType] || 'bg-gray-600';
  }

  if (loading) {
    return <div className="p-8 text-gray-400">Loading your dashboard...</div>;
  }

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-red-400">Unable to load dashboard.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Refresh
        </button>
      </div>
    );
  }

  const planPrice = user.plan_limits?.price || getPlanPrice(user.plan_type);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome, {user.business_name}!
        </h1>
        <p className="text-gray-400">
          Your inbox, automation rules, and integrations are ready.
        </p>
      </div>

      {!setupComplete && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            Complete Your Setup
          </h3>
          <p className="text-blue-200 text-sm mb-4">
            Connect your Facebook Page to start automating conversations.
          </p>
          <Link
            href="/dashboard/integrations"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Connect Facebook Page
          </Link>
        </div>
      )}

      {/* KPI COUNTS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Inbox Messages" value={counts.inbox} />
        <Stat label="Automation Rules" value={counts.rules} />
        <Stat label="Connected Pages" value={counts.pages} />
        <Stat label="AI Messages" value={counts.aiUsage} />
      </div>

      {/* BUSINESS OVERVIEW */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Business Overview</h2>
          <span
            className={`px-3 py-1 rounded-full text-sm text-white ${getPlanBadgeColor(
              user.plan_type
            )}`}
          >
            {user.plan_type.toUpperCase()} Plan
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info label="Business Name" value={user.business_name} />
          <Info label="Email" value={user.email} />
          <Info label="Monthly Plan" value={`$${planPrice}/month`} />
          <Info label="Status" value="Active" />
        </div>
      </div>

      {/* QUICK ACTIONS (EMPLOYEES ADDED HERE) */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>

        <div className="space-y-2">
          <QuickLink href="/dashboard/inbox" label="📨 View Inbox" />
          <QuickLink href="/dashboard/settings" label="⚙️ Settings" />
          <QuickLink href="/dashboard/analytics" label="📊 Analytics" />
          {userRole === "admin" && user?.id && (
            <Link
              href={`/dashboard/${user.workspace_id || 'workspace'}/employees`}
              className="block w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
            >
              👥 Employees
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-gray-400 text-sm">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
    >
      {label}
    </Link>
  );
}