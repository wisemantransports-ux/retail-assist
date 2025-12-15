"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AgentForm from "@/components/AgentForm";
import ApiKeyDisplay from '@/components/ApiKeyDisplay';

export default function NewAgentPage() {
  const router = useRouter();
  const [created, setCreated] = useState(false);
  const [agentData, setAgentData] = useState<any | null>(null);

  function handleCreate(data: any) {
    setAgentData(data);
    setCreated(true);
    // After create, redirect to agents list (placeholder)
    setTimeout(() => router.push("/dashboard/agents"), 700);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Create New Agent</h2>
      <p className="text-muted mb-6">Configure agent behavior and initial messages.</p>

      <div className="card">
        {!created ? (
          <AgentForm onCreate={handleCreate} />
        ) : (
          <div className="space-y-4">
            <h3 className="font-semibold">Agent Created</h3>
            <p className="text-sm text-muted">Your agent was created successfully. Keep your API key safe.</p>
            <div className="mt-2">
              <ApiKeyDisplay apiKey={agentData?.api_key} />
            </div>
            <p className="text-sm text-muted">Redirecting to agents list…</p>
          </div>
        )}
      </div>
    </div>
  );
}
