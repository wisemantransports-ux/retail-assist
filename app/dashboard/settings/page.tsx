'use client';

import { useState, useEffect } from 'react';

interface Settings {
  auto_reply_enabled: boolean;
  comment_to_dm_enabled: boolean;
  greeting_message: string;
  away_message: string;
  keywords: string[];
  ai_enabled: boolean;
  system_prompt: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    auto_reply_enabled: true,
    comment_to_dm_enabled: true,
    greeting_message: '',
    away_message: '',
    keywords: [],
    ai_enabled: true,
    system_prompt: ''
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !settings.keywords.includes(keywordInput.trim().toLowerCase())) {
      setSettings({
        ...settings,
        keywords: [...settings.keywords, keywordInput.trim().toLowerCase()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setSettings({
      ...settings,
      keywords: settings.keywords.filter(k => k !== keyword)
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-card-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-foreground">Automation Settings</h1>
          <p className="text-muted mt-2">Configure your AI assistant to handle customers 24/7</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {success && (
          <div className="card p-4 bg-green-500/10 border-green-500/20 text-green-400">
            Settings saved successfully!
          </div>
        )}
        {error && (
          <div className="card p-4 bg-red-500/10 border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        <div className="card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Auto-Reply Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_reply_enabled}
                onChange={(e) => setSettings({ ...settings, auto_reply_enabled: e.target.checked })}
                className="w-5 h-5 rounded border-card-border accent-primary"
              />
              <div>
                <span className="text-foreground font-medium">Enable Auto-Reply</span>
                <p className="text-muted text-sm">Automatically respond to comments and messages</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.comment_to_dm_enabled}
                onChange={(e) => setSettings({ ...settings, comment_to_dm_enabled: e.target.checked })}
                className="w-5 h-5 rounded border-card-border accent-primary"
              />
              <div>
                <span className="text-foreground font-medium">Comment-to-DM</span>
                <p className="text-muted text-sm">Send a private message when someone comments on your posts</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.ai_enabled}
                onChange={(e) => setSettings({ ...settings, ai_enabled: e.target.checked })}
                className="w-5 h-5 rounded border-card-border accent-primary"
              />
              <div>
                <span className="text-foreground font-medium">AI-Powered Responses</span>
                <p className="text-muted text-sm">Use AI to generate personalized, context-aware replies</p>
              </div>
            </label>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Message Templates</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-foreground font-medium mb-2">Greeting Message</label>
              <input
                type="text"
                value={settings.greeting_message}
                onChange={(e) => setSettings({ ...settings, greeting_message: e.target.value })}
                placeholder="Hi! Thanks for reaching out. How can we help?"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
              <p className="text-muted text-sm mt-1">First message sent to new customers</p>
            </div>

            <div>
              <label className="block text-foreground font-medium mb-2">Away Message</label>
              <input
                type="text"
                value={settings.away_message}
                onChange={(e) => setSettings({ ...settings, away_message: e.target.value })}
                placeholder="Thanks for your message! We'll get back to you shortly."
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
              <p className="text-muted text-sm mt-1">Sent when AI can't generate a response</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Trigger Keywords</h2>
          <p className="text-muted mb-4">The bot will prioritize responding to messages containing these keywords</p>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="Add keyword (e.g., price, order, buy)"
              className="flex-1 border border-card-border rounded px-4 py-2 bg-background text-foreground"
            />
            <button onClick={addKeyword} className="btn-secondary px-4 py-2">
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.keywords.map((keyword) => (
              <span
                key={keyword}
                className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="hover:text-red-400"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">AI Personality & Instructions</h2>
          <p className="text-muted mb-4">
            Tell your AI assistant how to respond. Include your business info, products/services, and sales approach.
          </p>
          <textarea
            value={settings.system_prompt}
            onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
            rows={12}
            placeholder="You are a friendly sales assistant for [Your Business]. Your goal is to help customers and close sales..."
            className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground font-mono text-sm"
          />
          <p className="text-muted text-sm mt-2">
            Tip: Include product names, prices, and common questions to help AI give accurate answers.
          </p>
        </div>

        <div className="card p-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <h2 className="text-xl font-bold text-foreground mb-2">How It Works</h2>
          <ul className="text-muted space-y-2">
            <li>1. Customer comments on your Facebook/Instagram post</li>
            <li>2. AI instantly replies to the comment publicly</li>
            <li>3. Bot sends a private DM to capture the lead</li>
            <li>4. AI continues the conversation, guiding toward a sale</li>
            <li>5. You close deals while you sleep!</li>
          </ul>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-8 py-3 text-lg w-full"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
