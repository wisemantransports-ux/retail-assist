import { useState, useEffect } from 'react';
import { AutomationRule } from '@/lib/meta/types';

export default function CommentToDmAutomationSettings({ workspaceId }: { workspaceId: string }) {
  const [rule, setRule] = useState<AutomationRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    enabled: false,
    trigger_words: '',
    auto_reply_message: '',
    send_public_reply: false,
    public_reply_template: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/automation/comments?workspaceId=${workspaceId}`)
      .then(r => r.json())
      .then(data => {
        if (data.rule) {
          setRule(data.rule);
          setForm({
            enabled: data.rule.enabled,
            trigger_words: (data.rule.trigger_words || []).join(','),
            auto_reply_message: data.rule.auto_reply_message || '',
            send_public_reply: data.rule.send_public_reply || false,
            public_reply_template: data.rule.public_reply_template || '',
          });
        }
        setLoading(false);
      });
  }, [workspaceId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await fetch('/api/automation/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        enabled: form.enabled,
        trigger_words: form.trigger_words.split(',').map(w => w.trim()).filter(Boolean),
        auto_reply_message: form.auto_reply_message,
        send_public_reply: form.send_public_reply,
        public_reply_template: form.public_reply_template,
      }),
    });
    if (res.ok) {
      setSuccess(true);
    } else {
      setError('Failed to save');
    }
    setSaving(false);
  }

  if (loading) return <div>Loading automation settings...</div>;

  return (
    <form className="space-y-4 p-4 border rounded bg-white max-w-xl" onSubmit={handleSave}>
      <h2 className="text-lg font-bold">Comment → DM Automation</h2>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="enabled" checked={form.enabled} onChange={handleChange} />
        Enable automation
      </label>
      <div>
        <label className="block font-medium">Trigger words (comma separated)</label>
        <input
          type="text"
          name="trigger_words"
          value={form.trigger_words}
          onChange={handleChange}
          className="input input-bordered w-full"
        />
      </div>
      <div>
        <label className="block font-medium">Auto-DM message</label>
        <textarea
          name="auto_reply_message"
          value={form.auto_reply_message}
          onChange={handleChange}
          className="textarea textarea-bordered w-full"
        />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="send_public_reply" checked={form.send_public_reply} onChange={handleChange} />
        Send public reply?
      </label>
      <div>
        <label className="block font-medium">Public reply template (optional)</label>
        <input
          type="text"
          name="public_reply_template"
          value={form.public_reply_template}
          onChange={handleChange}
          className="input input-bordered w-full"
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-600">Saved!</div>}
    </form>
  );
}
