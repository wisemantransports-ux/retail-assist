'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { canManageAgents, isFreeUser } from '@/lib/feature-gates';

interface Agent {
  id: string;
  agent_name?: string;
  name?: string;  // Some API responses use 'name'
  system_prompt?: string;
  created_at?: string;
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  // TASK P0.1: Fetch agents from live API on mount
  useEffect(() => {
    loadUserAndAgents();
  }, []);

  const loadUserAndAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get user info for plan gating
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      // Fetch agents from API (replaces hardcoded mock data)
      const agentsRes = await fetch('/api/agents');
      if (!agentsRes.ok) {
        throw new Error(`Failed to fetch agents: ${agentsRes.statusText}`);
      }

      const data = await agentsRes.json();
      // Handle both 'agents' and 'data' response formats
      const agentsList = data.agents || data.data || [];
      setAgents(agentsList);
    } catch (err: any) {
      console.error('[Agents Page] Load error:', err.message);
      setError(err.message || 'Failed to load agents');
      setAgents([]); // Reset to empty on error
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete agent');
      }

      // Remove from local state after successful API call
      setAgents(agents.filter((a) => a.id !== id));
    } catch (err: any) {
      console.error('[Agents Page] Delete error:', err.message);
      setError(err.message || 'Failed to delete agent');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Agents</h1>
          <p className="text-gray-400">Create and manage your AI agents</p>
        </div>
        {!user || !canManageAgents(user) ? (
          <button
            disabled
            title={!user ? 'Loading...' : 'Upgrade to a paid plan to create agents'}
            className="bg-gray-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-50"
          >
            🔒 Create New Agent (Paid only)
          </button>
        ) : (
          <Link
            href="/dashboard/agents/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Create New Agent
          </Link>
        )}
      </div>

      {/* Subscription Warning */}
      {user && isFreeUser(user) && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4">
          <p className="text-yellow-200 text-sm">
            <strong>Free Account:</strong> You're using the dashboard in preview mode. Upgrade to a paid plan to create agents and automate your conversations.
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-400">Loading agents...</p>
          </div>
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
          <p className="text-red-400 font-semibold mb-2">Error loading agents</p>
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button
            onClick={loadUserAndAgents}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      ) : agents.length === 0 ? (
        /* Empty State */
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          {user && !canManageAgents(user) ? (
            <>
              <p className="text-gray-400 mb-4">Agent creation is only available on paid plans.</p>
              <p className="text-gray-500 text-sm mb-6">Upgrade your account to create custom AI agents and automate your customer conversations.</p>
              <Link
                href="/pricing"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium inline-block"
              >
                View Pricing Plans
              </Link>
            </>
          ) : (
            <>
              <p className="text-gray-400 mb-4">No agents created yet.</p>
              <Link
                href="/dashboard/agents/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium inline-block"
              >
                Create Your First Agent
              </Link>
            </>
          )}
        </div>
      ) : (
        /* Agents Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{agent.agent_name || agent.name || 'Unnamed'}</h3>
                <span className="px-2 py-1 bg-green-900/50 text-green-400 text-xs rounded">
                  Active
                </span>
              </div>
              <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                {agent.system_prompt || 'No description provided'}
              </p>
              <div className="text-xs text-gray-500 mb-4">
                Created {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : 'recently'}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/agents/${agent.id}`}
                  className="flex-1 text-center bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 text-sm font-medium rounded-lg"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(agent.id)}
                  className="flex-1 text-center px-3 py-2 text-sm font-medium border border-red-500 text-red-400 rounded-lg hover:bg-red-900/30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
