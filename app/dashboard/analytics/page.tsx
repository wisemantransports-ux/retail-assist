'use client';

import { useState, useEffect } from 'react';
import { mockAnalytics } from '@/lib/mocks';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const statsData = await mockAnalytics.getStats();
        setStats(statsData);
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-card-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
          <p className="text-muted">Track your AI agents' performance and conversions</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-muted text-center py-12">Loading analytics...</p>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-6">
              <p className="text-sm text-muted">Total Messages</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.totalMessages}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-muted">Conversions</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.conversions}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-muted">Conversion Rate</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.conversionRate}%</p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-muted">Avg Response Time</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats.avgResponseTime}s</p>
            </div>
          </div>
        ) : (
          <p className="text-muted text-center">No data available</p>
        )}
      </div>
    </div>
  );
}
