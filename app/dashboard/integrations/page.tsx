'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  canConnectFacebook, 
  canUseInstagram, 
  isFreeUser,
  canConnectAccount,
  getPageCapacityMessage,
  getMaxPages
} from '@/lib/feature-gates';

interface ConnectedPage {
  id: string;
  page_id: string;
  page_name: string;
  platform: string;
  connected_at: string;
}

interface PendingPage {
  id: string;
  name: string;
  category?: string;
}

interface PendingAccount {
  id: string;
  name: string;
  username?: string;
}

interface UserData {
  id: string;
  email: string;
  business_name: string;
  subscription_status?: string;
  payment_status?: string;
  plan_type?: string;
  plan_limits?: {
    maxPages: number;
    hasInstagram: boolean;
    hasAiResponses: boolean;
    commentToDmLimit: number;
    aiTokenLimitMonthly: number;
    price: number;
  };
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserData | null>(null);
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);
  const [pendingPages, setPendingPages] = useState<PendingPage[]>([]);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingIgAccounts, setPendingIgAccounts] = useState<PendingAccount[]>([]);
  const [pendingIgToken, setPendingIgToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [igLoading, setIgLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectedIgAccounts, setSelectedIgAccounts] = useState<string[]>([]);

  useEffect(() => {
    loadUserAndPages();
    
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const token = searchParams.get('token');
    const pagesCount = searchParams.get('pages');
    const igSuccess = searchParams.get('ig_success');
    const igToken = searchParams.get('ig_token');
    const igAccountsCount = searchParams.get('ig_accounts');

    if (success === 'true' && token) {
      setPendingToken(token);
      try {
        const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
        setPendingPages(tokenData.pages || []);
        setSelectedPages(tokenData.pages?.map((p: any) => p.id) || []);
        setMessage({ type: 'success', text: `Found ${pagesCount} page(s). Select which ones to connect.` });
      } catch {
        setMessage({ type: 'error', text: 'Failed to parse page data' });
      }
    } else if (igSuccess === 'true' && igToken) {
      setPendingIgToken(igToken);
      try {
        const tokenData = JSON.parse(Buffer.from(igToken, 'base64').toString());
        setPendingIgAccounts(tokenData.accounts || []);
        setSelectedIgAccounts(tokenData.accounts?.map((a: any) => a.id) || []);
        setMessage({ type: 'success', text: `Found ${igAccountsCount} Instagram account(s). Select which ones to connect.` });
      } catch {
        setMessage({ type: 'error', text: 'Failed to parse Instagram account data' });
      }
    } else if (error) {
      const errorMessages: Record<string, string> = {
        auth_denied: 'Facebook authorization was denied',
        missing_params: 'Missing authorization parameters',
        invalid_state: 'Invalid session state',
        token_exchange_failed: 'Failed to exchange authorization code',
        pages_fetch_failed: 'Failed to fetch your Facebook pages',
        unexpected: 'An unexpected error occurred'
      };
      setMessage({ type: 'error', text: errorMessages[error] || 'Connection failed' });
    }
  }, [searchParams]);

  async function loadUserAndPages() {
    try {
      const [userRes, pagesRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/meta/pages')
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setConnectedPages(pagesData.pages || []);
      }
    } catch (error) {
      console.error('[Integrations Page] Failed to load user/pages:', error);
    }
  }

  async function handleConnectFacebook() {
    // Feature gate: Only paid users can connect Facebook
    if (!user) {
      setMessage({ type: 'error', text: 'User data not loaded. Please refresh.' });
      return;
    }

    if (!canConnectFacebook(user)) {
      setMessage({ 
        type: 'error', 
        text: 'Facebook integration requires a paid subscription. Upgrade to connect your Facebook page.' 
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    try {
      const res = await fetch('/api/meta/oauth');
      const data = await res.json();
      
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error });
        return;
      }
      
      window.location.href = data.authUrl;
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadConnectedPages() {
    try {
      const res = await fetch('/api/meta/pages');
      const data = await res.json();
      if (res.ok) {
        setConnectedPages(data.pages || []);
      }
    } catch (error) {
      console.error('Failed to load pages:', error);
    }
  }

  async function handleSavePages() {
    if (!pendingToken || selectedPages.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one page' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/meta/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: pendingToken,
          selectedPageIds: selectedPages
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error });
        return;
      }
      
      setMessage({ type: 'success', text: `Connected ${data.pages.length} page(s) successfully!` });
      setPendingPages([]);
      setPendingToken(null);
      setSelectedPages([]);
      loadConnectedPages();
      
      window.history.replaceState({}, '', '/dashboard/integrations');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect(pageId: string) {
    if (!confirm('Are you sure you want to disconnect this page?')) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/meta/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId })
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Page disconnected' });
        loadConnectedPages();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectInstagram() {
    if (!user) {
      setMessage({ type: 'error', text: 'User data not loaded. Please refresh.' });
      return;
    }

    if (!canUseInstagram(user)) {
      setMessage({ 
        type: 'error', 
        text: 'Instagram integration requires a Pro or Enterprise plan. Upgrade to connect your Instagram account.' 
      });
      return;
    }

    setIgLoading(true);
    setMessage(null);
    
    try {
      const res = await fetch('/api/meta/instagram/oauth');
      const data = await res.json();
      
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error });
        return;
      }
      
      window.location.href = data.authUrl;
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIgLoading(false);
    }
  }

  async function handleSaveIgAccounts() {
    if (!pendingIgToken || selectedIgAccounts.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one Instagram account' });
      return;
    }

    setIgLoading(true);
    try {
      const res = await fetch('/api/meta/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: pendingIgToken,
          platform: 'instagram',
          selectedPageIds: selectedIgAccounts
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error });
        return;
      }
      
      setMessage({ type: 'success', text: `Connected ${data.pages.length} Instagram account(s) successfully!` });
      setPendingIgAccounts([]);
      setPendingIgToken(null);
      setSelectedIgAccounts([]);
      loadConnectedPages();
      
      window.history.replaceState({}, '', '/dashboard/integrations');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIgLoading(false);
    }
  }

  function toggleIgAccountSelection(accountId: string) {
    setSelectedIgAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  }

  function togglePageSelection(pageId: string) {
    setSelectedPages(prev => 
      prev.includes(pageId) 
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-gray-400">Connect your Facebook and Instagram accounts</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-900/50 border border-green-600 text-green-200' 
            : 'bg-red-900/50 border border-red-600 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Plan Capacity Display */}
      {user && !isFreeUser(user) && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-4">
          <p className="text-blue-200 text-sm">
            <strong>Account Capacity:</strong> {getPageCapacityMessage(user, connectedPages.length)}
          </p>
        </div>
      )}

      {pendingPages.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Select Facebook Pages to Connect</h2>
          <div className="space-y-3 mb-4">
            {pendingPages.map(page => (
              <label 
                key={page.id} 
                className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selectedPages.includes(page.id)}
                  onChange={() => togglePageSelection(page.id)}
                  className="w-5 h-5 rounded"
                />
                <div className="flex-1">
                  <p className="text-white font-medium">{page.name}</p>
                  {page.category && <p className="text-gray-400 text-sm">{page.category}</p>}
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSavePages}
              disabled={loading || selectedPages.length === 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
            >
              {loading ? 'Connecting...' : `Connect ${selectedPages.length} Page(s)`}
            </button>
            <button
              onClick={() => {
                setPendingPages([]);
                setPendingToken(null);
                window.history.replaceState({}, '', '/dashboard/integrations');
              }}
              className="px-6 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pendingIgAccounts.length > 0 && (
        <div className="bg-purple-900/30 border border-purple-600 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Select Instagram Accounts to Connect</h2>
          <div className="space-y-3 mb-4">
            {pendingIgAccounts.map(account => (
              <label 
                key={account.id} 
                className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selectedIgAccounts.includes(account.id)}
                  onChange={() => toggleIgAccountSelection(account.id)}
                  className="w-5 h-5 rounded"
                />
                <div className="flex-1">
                  <p className="text-white font-medium">{account.name}</p>
                  {account.username && <p className="text-gray-400 text-sm">@{account.username}</p>}
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveIgAccounts}
              disabled={igLoading || selectedIgAccounts.length === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
            >
              {igLoading ? 'Connecting...' : `Connect ${selectedIgAccounts.length} Account(s)`}
            </button>
            <button
              onClick={() => {
                setPendingIgAccounts([]);
                setPendingIgToken(null);
                window.history.replaceState({}, '', '/dashboard/integrations');
              }}
              className="px-6 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={`border border-gray-700 rounded-xl p-6 ${!user || !canConnectFacebook(user) ? 'bg-gray-800/50 opacity-60' : 'bg-gray-800'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl">
              f
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Facebook Pages</h2>
              <p className="text-gray-400 text-sm">Connect your Facebook pages for auto-reply</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && !canConnectFacebook(user) && (
              <span className="px-3 py-1 bg-red-900/30 text-red-400 text-sm rounded-lg border border-red-700">
                🔒 Paid only
              </span>
            )}
            {user && canConnectFacebook(user) && !canConnectAccount(user, connectedPages.length) && (
              <span className="px-3 py-1 bg-orange-900/30 text-orange-400 text-sm rounded-lg border border-orange-700">
                ⚠️ Limit reached
              </span>
            )}
            <button
              onClick={handleConnectFacebook}
              disabled={loading || !user || !canConnectFacebook(user) || !canConnectAccount(user, connectedPages.length)}
              title={
                !user ? 'Loading...' : 
                !canConnectFacebook(user) ? 'Upgrade to a paid plan to connect Facebook' : 
                !canConnectAccount(user, connectedPages.length) ? `You\'ve reached your ${user.plan_type} plan limit. Upgrade to add more.` : 
                ''
              }
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium"
            >
              {loading ? 'Connecting...' : 'Connect Facebook'}
            </button>
          </div>
        </div>

        {connectedPages.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400">Connected Pages</h3>
            {connectedPages.map(page => (
              <div key={page.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                    f
                  </div>
                  <div>
                    <p className="text-white font-medium">{page.page_name}</p>
                    <p className="text-gray-400 text-sm">
                      Connected {new Date(page.connected_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded">Active</span>
                  <button
                    onClick={() => handleDisconnect(page.page_id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No Facebook pages connected yet.</p>
            <p className="text-sm mt-1">Click "Connect Facebook" to get started.</p>
          </div>
        )}
      </div>

      <div className={`border border-gray-700 rounded-xl p-6 ${!user || isFreeUser(user) || !canUseInstagram(user) ? 'bg-gray-800/50 opacity-60' : 'bg-gray-800'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
              IG
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Instagram Business Accounts</h2>
              <p className="text-gray-400 text-sm">Connect Instagram accounts for DM automation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && !canUseInstagram(user) && (
              <span className="px-3 py-1 bg-red-900/30 text-red-400 text-sm rounded-lg border border-red-700">
                🔒 Pro plan required
              </span>
            )}
            {user && canUseInstagram(user) && !canConnectAccount(user, connectedPages.length) && (
              <span className="px-3 py-1 bg-orange-900/30 text-orange-400 text-sm rounded-lg border border-orange-700">
                ⚠️ Limit reached
              </span>
            )}
            <button
              onClick={handleConnectInstagram}
              disabled={igLoading || !user || !canUseInstagram(user) || !canConnectAccount(user, connectedPages.length)}
              title={
                !user ? 'Loading...' : 
                !canUseInstagram(user) ? 'Upgrade to Pro plan to connect Instagram' : 
                !canConnectAccount(user, connectedPages.length) ? `You\'ve reached your ${user.plan_type} plan limit. Upgrade to add more.` : 
                ''
              }
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium"
            >
              {igLoading ? 'Connecting...' : 'Connect Instagram'}
            </button>
          </div>
        </div>

        {connectedPages.filter(p => p.platform === 'instagram').length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400">Connected Instagram Accounts</h3>
            {connectedPages.filter(p => p.platform === 'instagram').map(account => (
              <div key={account.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold">
                    IG
                  </div>
                  <div>
                    <p className="text-white font-medium">{account.page_name}</p>
                    <p className="text-gray-400 text-sm">
                      Connected {new Date(account.connected_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded">Active</span>
                  <button
                    onClick={() => handleDisconnect(account.page_id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No Instagram accounts connected yet.</p>
            <p className="text-sm mt-1">Click "Connect Instagram" to get started.</p>
          </div>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-white text-xl">
              WA
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">WhatsApp</h2>
              <p className="text-gray-400 text-sm">Connect WhatsApp for automated responses</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-yellow-600 text-yellow-200 text-sm rounded-lg font-semibold">
            Coming Soon
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-4">
          WhatsApp integration is coming soon. We're working to bring secure, compliant WhatsApp automation to your dashboard.
        </p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Webhook Information</h2>
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Webhook URL</p>
            <code className="block bg-gray-900 p-3 rounded-lg text-blue-400 text-sm overflow-x-auto">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/facebook` : 'Loading...'}
            </code>
          </div>
          <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4">
            <p className="text-blue-200 text-sm">
              <strong>Note:</strong> Webhooks are automatically configured when you connect your Facebook page. 
              No manual setup required!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
