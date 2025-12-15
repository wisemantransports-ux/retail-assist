"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  business_name: string;
  phone: string;
  plan_type: string;
  subscription_status: string;
  billing_start_date?: string;
  billing_end_date?: string;
  paypal_subscription_id?: string;
  role: string;
  created_at: string;
}

interface Token {
  id: string;
  platform: string;
  page_id: string;
  page_name: string;
  created_at: string;
}

const PLANS = [
  { id: 'starter', name: 'Starter', price: 22 },
  { id: 'pro', name: 'Pro', price: 45 },
  { id: 'enterprise', name: 'Enterprise', price: 75 }
];

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [paypalId, setPaypalId] = useState('');
  const [billingEndDate, setBillingEndDate] = useState('');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchUser();
  }, [id]);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (!res.ok || data.user.role !== 'admin') {
        router.push('/admin/login');
      }
    } catch {
      router.push('/admin/login');
    }
  }

  async function fetchUser() {
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json();
      
      if (res.ok) {
        setUser(data.user);
        setTokens(data.tokens || []);
        setPaypalId(data.user.paypal_subscription_id || '');
        if (data.user.billing_end_date) {
          setBillingEndDate(data.user.billing_end_date.split('T')[0]);
        }
      } else {
        router.push('/admin');
      }
    } catch {
      router.push('/admin');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateUser(updates: Record<string, any>) {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, ...updates })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'User updated successfully' });
        fetchUser();
      } else {
        setMessage({ type: 'error', text: 'Failed to update user' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    }
  }

  function handleSaveBilling() {
    const updates: Record<string, any> = {};
    if (paypalId !== (user?.paypal_subscription_id || '')) {
      updates.paypal_subscription_id = paypalId;
    }
    if (billingEndDate) {
      updates.billing_end_date = new Date(billingEndDate).toISOString();
    }
    if (Object.keys(updates).length > 0) {
      handleUpdateUser(updates);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">User not found</div>
      </div>
    );
  }

  const currentPlan = PLANS.find(p => p.id === user.plan_type);

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-gray-400 hover:text-white">Dashboard</Link>
          <span className="text-white">/</span>
          <h1 className="text-xl font-bold text-white">Edit User</h1>
        </div>
      </nav>

      <main className="p-6 max-w-4xl">
        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.type === 'success' 
              ? 'bg-green-900/50 border border-green-600 text-green-200' 
              : 'bg-red-900/50 border border-red-600 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">User Information</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Business Name</label>
              <p className="text-white">{user.business_name}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <p className="text-white">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <p className="text-white">{user.phone || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Created</label>
              <p className="text-white">{new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Subscription Management</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Plan</label>
              <select
                value={user.plan_type}
                onChange={(e) => handleUpdateUser({ plan_type: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                {PLANS.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} (${plan.price}/mo)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Subscription Status</label>
              <select
                value={user.subscription_status}
                onChange={(e) => handleUpdateUser({ subscription_status: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-md font-medium text-white mb-4">Billing Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">PayPal Subscription ID</label>
                <input
                  type="text"
                  value={paypalId}
                  onChange={(e) => setPaypalId(e.target.value)}
                  placeholder="I-XXXXXXXXXXXXX"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Billing End Date</label>
                <input
                  type="date"
                  value={billingEndDate}
                  onChange={(e) => setBillingEndDate(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSaveBilling}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                Save Billing Info
              </button>
              {user.billing_start_date && (
                <p className="text-sm text-gray-400 self-center">
                  Billing started: {new Date(user.billing_start_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Connected Pages/Accounts</h2>
          
          {tokens.length === 0 ? (
            <p className="text-gray-400">No pages or accounts connected yet.</p>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <div>
                    <p className="text-white font-medium">{token.page_name}</p>
                    <p className="text-sm text-gray-400">{token.platform} - {token.page_id}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    Added {new Date(token.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-700/50 rounded">
            <p className="text-sm text-gray-400">
              <strong>Plan Limit:</strong> {currentPlan?.name} allows {
                user.plan_type === 'enterprise' ? 'unlimited' : 
                user.plan_type === 'pro' ? '3' : '1'
              } page(s). Currently using {tokens.length}.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
