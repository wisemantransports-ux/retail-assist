"use client";

import { useState, useEffect } from 'react';
import createBrowserSupabaseClient from '@/lib/supabase/client';
import ChatWidget from '@/components/ChatWidget';

export default function Page() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  useEffect(() => {
    const loadAgents = async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', userData.user.id)
        .single();

      if (workspaceData) {
        const { data: agentsData } = await supabase
          .from('agents')
          .select('id, name')
          .eq('workspace_id', workspaceData.id)
          .eq('enabled', true);

        setAgents(agentsData || []);
        if (agentsData && agentsData.length > 0) {
          setSelectedAgentId(agentsData[0].id);
        }
      }
    };

    loadAgents();
  }, []);

  const embedCode = selectedAgentId ? `
<!-- Retail Assist Chat Widget -->
<div id="retail-assist-chat"></div>
<script>
(function() {
  const script = document.createElement('script');
  script.src = '${window.location.origin}/chat-widget.js?agent=${selectedAgentId}';
  script.async = true;
  document.head.appendChild(script);
})();
</script>
`.trim() : '';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Website Integration</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Embed Instructions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Add Chat to Your Website</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Agent</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {selectedAgentId && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Embed Code</label>
              <textarea
                value={embedCode}
                readOnly
                rows={8}
                className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm"
              />
              <p className="text-sm text-gray-600 mt-2">
                Copy and paste this code into your website's HTML, just before the closing &lt;/body&gt; tag.
              </p>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
          {selectedAgentId ? (
            <div className="max-w-sm">
              <ChatWidget agentId={selectedAgentId} />
            </div>
          ) : (
            <p className="text-gray-500">Select an agent to preview the chat widget.</p>
          )}
        </div>
      </div>
    </div>
  );
}
