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
}

interface ChannelStatus {
  facebook: { connected: boolean; pages: number };
  instagram: { connected: boolean; available: boolean };
}

export default function ClientDashboard() {
  const [user, setUser] = useState<UserData | null>(null);
  const [channels, setChannels] = useState<ChannelStatus>({
    facebook: { connected: false, pages: 0 },
    instagram: { connected: false, available: false }
  });
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        
        const hasInstagram = data.user.plan_limits?.hasInstagram || 
          data.user.plan_type === 'pro' || 
          data.user.plan_type === 'enterprise';
        
        setChannels({
          facebook: { connected: false, pages: 0 },
          instagram: { connected: false, available: hasInstagram }
        });
        
        setSetupComplete(false);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function getPlanPrice(planType: string): number {
    const prices: Record<string, number> = {
      starter: 22,
      pro: 45,
      enterprise: 75
    };
    return prices[planType] ?? prices.starter;
  }

  function getPlanBadgeColor(planType: string): string {
    const colors: Record<string, string> = {
      starter: 'bg-gray-600',
      pro: 'bg-blue-600',
      enterprise: 'bg-purple-600'
    };
    return colors[planType] || 'bg-gray-600';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-400">Unable to load dashboard. Please try refreshing.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const planPrice = user.plan_limits?.price || getPlanPrice(user.plan_type);

  return (
    <div className="space-y-8">
      {!setupComplete && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🚀</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Complete Your Setup</h3>
              <p className="text-blue-200 text-sm mb-4">
                Connect your Facebook Page to start automating customer conversations.
              </p>
              <Link
                href="/dashboard/integrations"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Connect Facebook Page
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Business Overview</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getPlanBadgeColor(user.plan_type)}`}>
                {user.plan_type?.charAt(0).toUpperCase() + user.plan_type?.slice(1)} Plan
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Business Name</p>
                <p className="text-white font-medium">{user.business_name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Monthly Plan</p>
                <p className="text-white font-medium">${planPrice}/month</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Status</p>
                <span className="inline-block px-2 py-1 bg-green-900/50 text-green-400 rounded text-sm">
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Connected Channels</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl">
                    f
                  </div>
                  <div>
                    <p className="text-white font-medium">Facebook Messenger</p>
                    <p className="text-gray-400 text-sm">
                      {channels.facebook.connected 
                        ? `${channels.facebook.pages} page(s) connected` 
                        : 'Not connected'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/integrations"
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    channels.facebook.connected
                      ? 'bg-gray-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {channels.facebook.connected ? 'Manage' : 'Connect'}
                </Link>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-lg flex items-center justify-center text-white text-xl">
                    📷
                  </div>
                  <div>
                    <p className="text-white font-medium">Instagram DM</p>
                    <p className="text-gray-400 text-sm">
                      {!channels.instagram.available 
                        ? 'Upgrade to Pro to unlock' 
                        : channels.instagram.connected 
                          ? 'Connected' 
                          : 'Not connected'}
                    </p>
                  </div>
                </div>
                {channels.instagram.available ? (
                  <Link
                    href="/dashboard/integrations"
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      channels.instagram.connected
                        ? 'bg-gray-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {channels.instagram.connected ? 'Manage' : 'Connect'}
                  </Link>
                ) : (
                  <Link
                    href="/pricing"
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">AI Agent Status</h2>
            
            <div className="p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white text-xl">
                    🤖
                  </div>
                  <div>
                    <p className="text-white font-medium">Auto-Reply Bot</p>
                    <p className="text-gray-400 text-sm">Responds to customer messages automatically</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-yellow-900/50 text-yellow-400 rounded-full text-sm">
                  Pending Setup
                </span>
              </div>
            </div>
            
            <div className="mt-4">
              <Link
                href="/dashboard/settings"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Configure AI Settings →
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Your Plan</h3>
            
            <div className="text-center mb-4">
              <p className="text-4xl font-bold text-white">${planPrice}</p>
              <p className="text-gray-400">/month</p>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400">✓</span>
                <span className="text-gray-300">Facebook Messenger</span>
              </div>
              {user.plan_type !== 'starter' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">Instagram DM</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400">✓</span>
                <span className="text-gray-300">
                  {user.plan_type === 'enterprise' ? 'Unlimited' : user.plan_type === 'pro' ? '3' : '1'} Page(s)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400">✓</span>
                <span className="text-gray-300">AI Responses</span>
              </div>
            </div>
            
            {user.plan_type !== 'enterprise' && (
              <Link
                href="/pricing"
                className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium"
              >
                Upgrade Plan
              </Link>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            
            <div className="space-y-2">
              <Link
                href="/dashboard/inbox"
                className="block w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
              >
                📨 View Inbox
              </Link>
              <Link
                href="/dashboard/settings"
                className="block w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
              >
                ⚙️ Settings
              </Link>
              <Link
                href="/dashboard/analytics"
                className="block w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
              >
                📊 Analytics
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
