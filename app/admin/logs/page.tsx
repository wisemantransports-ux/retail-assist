"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LogEntry {
  id: string;
  user_id?: string;
  level: string;
  message: string;
  meta?: Record<string, any>;
  created_at: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchLogs();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (!res.ok || data.user.role !== 'admin') {
        router.push('/admin/login');
      }
    } catch {
      router.push('/admin/login');
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      
      if (res.ok) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-white">Dashboard</Link>
            <span className="text-white">/</span>
            <h1 className="text-xl font-bold text-white">System Logs</h1>
          </div>
          <div className="flex gap-4">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-1"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
            <button 
              onClick={fetchLogs}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
            >
              Refresh
            </button>
          </div>
        </div>
      </nav>

      <main className="p-6">
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">Time</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Level</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Message</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-400">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t border-gray-700">
                      <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs uppercase ${
                          log.level === 'error' ? 'bg-red-900/50 text-red-400' :
                          log.level === 'warn' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-blue-900/50 text-blue-400'
                        }`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="p-4 text-white">{log.message}</td>
                      <td className="p-4 text-gray-400 text-sm max-w-xs truncate">
                        {log.meta ? JSON.stringify(log.meta) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
