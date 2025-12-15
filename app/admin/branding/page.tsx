'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BrandConfig {
  name: string;
  tagline: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  domain: string;
  company: string;
  socialLinks: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
}

export default function AdminBrandingPage() {
  const router = useRouter();
  const [brand, setBrand] = useState<BrandConfig>({
    name: '',
    tagline: '',
    logo: '/logo.png',
    favicon: '/favicon.ico',
    primaryColor: '#2563EB',
    accentColor: '#10B981',
    supportEmail: '',
    domain: '',
    company: '',
    socialLinks: { twitter: '', facebook: '', linkedin: '' }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/branding');
      if (res.ok) {
        const data = await res.json();
        setBrand(data);
      }
    } catch (err) {
      console.error('Failed to fetch branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand)
      });
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save branding');
      }
    } catch (err) {
      setError('Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted">Loading branding settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-card-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-muted hover:text-foreground">
              ← Back to Admin
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-foreground mt-4">White-Label Branding</h1>
          <p className="text-muted mt-2">Customize the app branding for your business</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {success && (
          <div className="card p-4 bg-green-500/10 border-green-500/20 text-green-400">
            Branding saved successfully! Refresh the page to see changes.
          </div>
        )}
        {error && (
          <div className="card p-4 bg-red-500/10 border-red-500/20 text-red-400">
            {error}
          </div>
        )}

        <div className="card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Basic Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-foreground font-medium mb-2">App Name</label>
              <input
                type="text"
                value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                placeholder="Your App Name"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">Company Name</label>
              <input
                type="text"
                value={brand.company}
                onChange={(e) => setBrand({ ...brand, company: e.target.value })}
                placeholder="Your Company"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-foreground font-medium mb-2">Tagline</label>
              <input
                type="text"
                value={brand.tagline}
                onChange={(e) => setBrand({ ...brand, tagline: e.target.value })}
                placeholder="AI-Powered Customer Automation"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">Support Email</label>
              <input
                type="email"
                value={brand.supportEmail}
                onChange={(e) => setBrand({ ...brand, supportEmail: e.target.value })}
                placeholder="support@example.com"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">Domain</label>
              <input
                type="text"
                value={brand.domain}
                onChange={(e) => setBrand({ ...brand, domain: e.target.value })}
                placeholder="example.com"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Visual Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-foreground font-medium mb-2">Logo URL</label>
              <input
                type="text"
                value={brand.logo}
                onChange={(e) => setBrand({ ...brand, logo: e.target.value })}
                placeholder="/logo.png"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
              <p className="text-muted text-sm mt-1">Place your logo in the /public folder</p>
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">Favicon URL</label>
              <input
                type="text"
                value={brand.favicon}
                onChange={(e) => setBrand({ ...brand, favicon: e.target.value })}
                placeholder="/favicon.ico"
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">Primary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brand.primaryColor}
                  onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                  className="w-12 h-12 rounded border border-card-border cursor-pointer"
                />
                <input
                  type="text"
                  value={brand.primaryColor}
                  onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                  className="flex-1 border border-card-border rounded px-4 py-3 bg-background text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">Accent Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brand.accentColor}
                  onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                  className="w-12 h-12 rounded border border-card-border cursor-pointer"
                />
                <input
                  type="text"
                  value={brand.accentColor}
                  onChange={(e) => setBrand({ ...brand, accentColor: e.target.value })}
                  className="flex-1 border border-card-border rounded px-4 py-3 bg-background text-foreground"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Social Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-foreground font-medium mb-2">Twitter</label>
              <input
                type="text"
                value={brand.socialLinks.twitter || ''}
                onChange={(e) => setBrand({ 
                  ...brand, 
                  socialLinks: { ...brand.socialLinks, twitter: e.target.value }
                })}
                placeholder="https://twitter.com/..."
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">Facebook</label>
              <input
                type="text"
                value={brand.socialLinks.facebook || ''}
                onChange={(e) => setBrand({ 
                  ...brand, 
                  socialLinks: { ...brand.socialLinks, facebook: e.target.value }
                })}
                placeholder="https://facebook.com/..."
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-foreground font-medium mb-2">LinkedIn</label>
              <input
                type="text"
                value={brand.socialLinks.linkedin || ''}
                onChange={(e) => setBrand({ 
                  ...brand, 
                  socialLinks: { ...brand.socialLinks, linkedin: e.target.value }
                })}
                placeholder="https://linkedin.com/..."
                className="w-full border border-card-border rounded px-4 py-3 bg-background text-foreground"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-8 py-3 text-lg w-full"
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  );
}
