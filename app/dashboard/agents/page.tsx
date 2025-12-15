'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Agent {
  id: string;
  agent_name: string;
  system_prompt?: string;
  created_at?: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: '1',
      agent_name: 'Sales Assistant',
      system_prompt: 'You are a friendly sales representative who helps customers find the perfect product...',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      agent_name: 'Support Bot',
      system_prompt: 'You are a helpful customer support agent who resolves issues quickly...',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      setAgents(agents.filter((a) => a.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Agents</h1>
          <p className="text-gray-400">Create and manage your AI agents</p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Create New Agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <p className="text-gray-400 mb-4">No agents created yet.</p>
          <Link
            href="/dashboard/agents/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium inline-block"
          >
            Create Your First Agent
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{agent.agent_name}</h3>
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
