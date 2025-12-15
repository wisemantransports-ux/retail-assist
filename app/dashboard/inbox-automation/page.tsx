'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AutomationRule } from '@/lib/types/database';

function RulesList({ initialRules }: { initialRules: AutomationRule[] }) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules);
  const [deleting, setDeleting] = useState<string | null>(null);

  const toggleRule = async (ruleId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/automation/rule/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (response.ok) {
        setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: !currentEnabled } : r));
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      setDeleting(ruleId);
      const response = await fetch(`/api/automation/rule/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRules(rules.filter(r => r.id !== ruleId));
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <div key={rule.id} className={`card p-6 ${!rule.enabled ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-foreground text-lg">{rule.name}</h3>
                {!rule.enabled && (
                  <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                    Disabled
                  </span>
                )}
              </div>

              {rule.description && (
                <p className="text-sm text-muted mt-1">{rule.description}</p>
              )}

              {/* Rule details */}
              <div className="mt-4 space-y-2 text-sm text-muted">
                {rule.trigger_words && rule.trigger_words.length > 0 && (
                  <p>
                    <span className="font-semibold text-foreground">Keywords:</span>{' '}
                    {rule.trigger_words.join(', ')}
                  </p>
                )}
                {rule.trigger_platforms && rule.trigger_platforms.length > 0 && (
                  <p>
                    <span className="font-semibold text-foreground">Platforms:</span>{' '}
                    {rule.trigger_platforms.join(', ')}
                  </p>
                )}
                <p>
                  <span className="font-semibold text-foreground">Actions:</span>
                  {rule.send_public_reply && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      Public Reply
                    </span>
                  )}
                  {rule.send_private_reply && (
                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      DM
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <button
                onClick={() => toggleRule(rule.id, rule.enabled)}
                className={`px-4 py-2 rounded text-sm font-semibold ${
                  rule.enabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <Link
                href={`/dashboard/inbox-automation/${rule.id}`}
                className="px-4 py-2 rounded text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => deleteRule(rule.id)}
                disabled={deleting === rule.id}
                className="px-4 py-2 rounded text-sm border border-red-500 text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting === rule.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InboxAutomationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-card-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inbox Automation</h1>
            <p className="text-muted mt-2">Automatic replies and comment-to-DM flows</p>
          </div>
          <Link href="/dashboard/inbox-automation/new" className="btn-primary px-6 py-2">
            New Rule
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Empty state */}
        <div className="text-center py-12 border-2 border-dashed border-card-border rounded">
          <p className="text-muted mb-4">No automation rules configured yet</p>
          <Link href="/dashboard/inbox-automation/new" className="btn-primary px-6 py-2">
            Create Your First Rule
          </Link>
        </div>

        {/* Info section */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-3">How Automation Works</h3>
          <ol className="space-y-2 text-sm text-blue-900">
            <li>1. Comment is posted on your Facebook/Instagram post</li>
            <li>2. If it contains keywords from a rule, automation triggers</li>
            <li>3. AI generates a personalized reply using your agent</li>
            <li>4. Public reply is posted to the comment (if enabled)</li>
            <li>5. Direct message is sent to the author (if enabled)</li>
            <li>6. Action is logged for analytics</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

