'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAutomationRule } from '@/lib/supabase/queries';
import { createClient } from '@/lib/supabase/client';
import type { Agent } from '@/lib/types/database';

export default function NewAutomationRulePage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<any>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    agentId: '',
    triggerWords: '',
    triggerPlatforms: ['facebook'],
    sendPublicReply: true,
    publicReplyTemplate: '',
    sendPrivateReply: true,
    privateReplyTemplate: '',
    autoSkipReplies: false,
    delaySeconds: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated');
        return;
      }

      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single();

      if (!workspaceData) {
        setError('No workspace found');
        return;
      }

      setWorkspace(workspaceData);

      const { data: agentsData } = await supabase
        .from('agents')
        .select('*')
        .eq('workspace_id', workspaceData.id)
        .eq('enabled', true)
        .is('deleted_at', null);

      if (agentsData) {
        setAgents(agentsData);
        if (agentsData.length > 0) {
          setForm(f => ({ ...f, agentId: agentsData[0].id }));
        }
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err.message || 'Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!form.name.trim()) {
        setError('Rule name is required');
        return;
      }

      if (!form.agentId) {
        setError('Please select an agent');
        return;
      }

      const triggerWords = form.triggerWords
        .split(',')
        .map(w => w.trim())
        .filter(w => w.length > 0);

      if (triggerWords.length === 0 && !form.sendPublicReply) {
        setError('Please enter trigger keywords or enable public reply');
        return;
      }

      if (form.sendPublicReply && !form.publicReplyTemplate.trim()) {
        setError('Public reply template is required when reply is enabled');
        return;
      }

      if (form.sendPrivateReply && !form.privateReplyTemplate.trim()) {
        setError('Private reply template is required when DM is enabled');
        return;
      }

      const rule = await createAutomationRule(workspace.id, form.agentId, {
        name: form.name,
        description: form.description || undefined,
        trigger_words: triggerWords.length > 0 ? triggerWords : undefined,
        trigger_platforms: form.triggerPlatforms as any,
        send_public_reply: form.sendPublicReply,
        public_reply_template: form.publicReplyTemplate || undefined,
        send_private_reply: form.sendPrivateReply,
        private_reply_template: form.privateReplyTemplate || undefined,
        auto_skip_replies: form.autoSkipReplies,
        delay_seconds: form.delaySeconds > 0 ? form.delaySeconds : undefined,
      });

      if (!rule) {
        setError('Failed to create automation rule');
        return;
      }

      router.push('/dashboard/inbox-automation');
    } catch (err: any) {
      console.error('Error creating rule:', err);
      setError(err.message || 'Failed to create automation rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlatformChange = (platform: string, checked: boolean) => {
    setForm(f => {
      const platforms = f.triggerPlatforms.includes(platform as any)
        ? f.triggerPlatforms.filter(p => p !== (platform as any))
        : [...f.triggerPlatforms, platform as any];
      return { ...f, triggerPlatforms: platforms };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-gray-300 border-t-indigo-600 rounded-full"></div>
          </div>
          <p className="mt-4 text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-card-border">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link href="/dashboard/inbox-automation" className="text-indigo-600 hover:text-indigo-700 text-sm">
            ← Back to Rules
          </Link>
          <h1 className="text-3xl font-bold text-foreground mt-3">Create Automation Rule</h1>
          <p className="text-muted mt-2">Set up a rule to automatically reply to comments</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., 'Reply to shipping inquiries'"
                  className="w-full px-4 py-2 border border-card-border rounded bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what this rule does..."
                  rows={3}
                  className="w-full px-4 py-2 border border-card-border rounded bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Agent to Use *
                </label>
                <select
                  value={form.agentId}
                  onChange={e => setForm({ ...form, agentId: e.target.value })}
                  className="w-full px-4 py-2 border border-card-border rounded bg-background text-foreground"
                >
                  <option value="">Select an agent...</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                {agents.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    No agents available. Please create an agent first.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Trigger Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Trigger Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.triggerWords}
                  onChange={e => setForm({ ...form, triggerWords: e.target.value })}
                  placeholder="e.g., 'shipping, delivery, when will it arrive'"
                  className="w-full px-4 py-2 border border-card-border rounded bg-background text-foreground"
                />
                <p className="text-xs text-muted mt-2">
                  Leave empty to trigger on all comments
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Trigger on Platforms
                </label>
                <div className="space-y-2">
                  {['facebook', 'instagram'].map(platform => (
                    <label key={platform} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.triggerPlatforms.includes(platform as any)}
                        onChange={e => handlePlatformChange(platform, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-foreground capitalize">{platform}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Reply Configuration */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Reply Configuration</h2>
            <div className="space-y-6">
              {/* Public Reply */}
              <div className="border-b border-card-border pb-6">
                <label className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={form.sendPublicReply}
                    onChange={e => setForm({ ...form, sendPublicReply: e.target.checked })}
                    className="rounded"
                  />
                  <span className="font-semibold text-foreground">Send Public Reply to Comment</span>
                </label>

                {form.sendPublicReply && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Reply Template *
                    </label>
                    <textarea
                      value={form.publicReplyTemplate}
                      onChange={e => setForm({ ...form, publicReplyTemplate: e.target.value })}
                      placeholder="Enter the reply template. The AI will personalize this using the customer's comment."
                      rows={4}
                      className="w-full px-4 py-2 border border-card-border rounded bg-background text-foreground"
                    />
                    <p className="text-xs text-muted mt-2">
                      The AI will use this template along with your agent's knowledge to generate a personalized reply.
                    </p>
                  </div>
                )}
              </div>

              {/* Private Reply (DM) */}
              <div className="pb-6">
                <label className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={form.sendPrivateReply}
                    onChange={e => setForm({ ...form, sendPrivateReply: e.target.checked })}
                    className="rounded"
                  />
                  <span className="font-semibold text-foreground">Send Private Message (DM) to Author</span>
                </label>

                {form.sendPrivateReply && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      DM Template *
                    </label>
                    <textarea
                      value={form.privateReplyTemplate}
                      onChange={e => setForm({ ...form, privateReplyTemplate: e.target.value })}
                      placeholder="Enter the DM template. The AI will personalize this for each customer."
                      rows={4}
                      className="w-full px-4 py-2 border border-card-border rounded bg-background text-foreground"
                    />
                    <p className="text-xs text-muted mt-2">
                      This message will be sent as a direct message to the comment author.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Advanced Options</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.autoSkipReplies}
                  onChange={e => setForm({ ...form, autoSkipReplies: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-foreground">Skip replies that are replies to other replies</span>
              </label>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Delay before sending reply (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={form.delaySeconds}
                  onChange={e => setForm({ ...form, delaySeconds: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-card-border rounded bg-background text-foreground"
                />
                <p className="text-xs text-muted mt-2">
                  Add a delay to make responses feel more natural (0-3600 seconds)
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || !form.agentId}
              className="btn-primary px-8 py-2 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Rule'}
            </button>
            <Link href="/dashboard/inbox-automation" className="btn-secondary px-8 py-2">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
