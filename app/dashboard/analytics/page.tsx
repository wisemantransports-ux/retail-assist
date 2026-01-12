'use client';

import { useState, useEffect } from 'react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/analytics/summary?period=30d');
        
        if (!res.ok) {
          throw new Error(`Analytics API failed: ${res.statusText}`);
        }
        
        const statsData = await res.json();
        setStats(statsData);
      } catch (err: any) {
        console.error('[Analytics Page] Failed to load analytics:', err.message);
        setError(err.message || 'Failed to load analytics');
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6" role="alert">
            <p className="font-semibold">Failed to load analytics</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-red-600 underline text-sm mt-2 hover:text-red-700"
            >
              Try Again
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-border border-t-blue-500 rounded-full"></div>
          </div>
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
