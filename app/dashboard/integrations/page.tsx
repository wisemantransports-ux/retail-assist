'use client';

import { useState, useEffect } from 'react';
import { useSubscription } from '@/components/SubscriptionGuard';
import UpsellModal from '@/components/UpsellModal';
import { useSearchParams } from 'next/navigation';

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

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([]);
  const [pendingPages, setPendingPages] = useState<PendingPage[]>([]);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const { readOnly } = useSubscription();
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    loadConnectedPages();
    
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const token = searchParams.get('token');
    const pagesCount = searchParams.get('pages');

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

  async function handleConnectFacebook() {
    // guard for read-only users
    if (readOnly) {
      setShowUpsell(true);
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

  function togglePageSelection(pageId: string) {
    setSelectedPages(prev => 
      prev.includes(pageId) 
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  }

  return (
    <>
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

      {pendingPages.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Select Pages to Connect</h2>
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

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
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
          <button
            onClick={handleConnectFacebook}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium"
          >
            {loading ? 'Connecting...' : 'Connect Facebook'}
          </button>
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

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center text-white text-xl">
              IG
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Instagram</h2>
              <p className="text-gray-400 text-sm">Manage Instagram DMs (Pro plan required)</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-gray-600 text-gray-300 text-sm rounded-lg">
            Coming with Facebook
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-4">
          Instagram is automatically connected when you link a Facebook Page with an Instagram Business account.
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
    <UpsellModal open={showUpsell} onClose={() => setShowUpsell(false)} reason="Connecting pages requires an active subscription." />
    </>
  );
}
