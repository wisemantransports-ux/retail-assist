"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  business_name: string;
  phone: string;
  plan_type: string;
  plan_name: string;
  plan_price: number;
  payment_status: string;
  subscription_status: string;
  billing_start_date?: string;
  billing_end_date?: string;
  paypal_subscription_id?: string;
  role: string;
  created_at: string;
}

interface Stats {
  total: number;
  pending: number;
  awaiting_approval: number;
  active: number;
  suspended: number;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, awaiting_approval: 0, active: 0, suspended: 0 });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchUsers();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (!res.ok) {
        router.push('/admin/login');
        return;
      }
      
      // Role is at top level, user data is nested
      const role = data.role || data.user?.role;
      const workspaceId = data.workspaceId || data.user?.workspace_id;
      
      console.log('[Admin Page] Resolved role:', role);
      console.log('[Admin Page] Workspace ID:', workspaceId);
      
      if (role !== 'super_admin') {
        console.log('[Admin Page] Access denied for role:', role, 'redirecting to login');
        router.push('/admin/login');
        return;
      }
      
      setCurrentUser(data.user);
    } catch {
      router.push('/admin/login');
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      
      if (res.ok) {
        setUsers(data.users || []);
        setStats(data.stats || { total: 0, pending: 0, awaiting_approval: 0, active: 0, suspended: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateUserStatus(userId: string, subscription_status: string) {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription_status })
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  }

  async function handleLogout() {
    try {
      console.log('[Admin] Initiating logout...');
      const response = await fetch('/api/auth/logout', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        console.error('[Admin] Logout failed with status:', response.status);
      }
      
      console.log('[Admin] Logout complete, redirecting to /login');
      router.push('/login');
    } catch (error) {
      console.error('[Admin] Logout error:', error);
      router.push('/login');
    }
  }

  const filteredUsers = filter === 'all' 
    ? users 
    : users.filter(u => u.subscription_status === filter);

  const totalRevenue = users
    .filter(u => u.subscription_status === 'active')
    .reduce((sum, u) => sum + (u.plan_price || 0), 0);

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
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link href="/admin/logs" className="text-gray-400 hover:text-white">Logs</Link>
            <Link href="/admin/settings" className="text-gray-400 hover:text-white">Settings</Link>
            <button 
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="p-6">
        {/* QUICK ACTIONS */}
        <div className="flex gap-4 mb-6">
          <Link
            href="/admin/platform-staff"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            🏢 Employees
          </Link>
          {/* Add other quick action buttons here */}
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4">
            <p className="text-blue-400 text-sm">Trial Users</p>
            <p className="text-2xl font-bold text-blue-400">{stats.pending + stats.awaiting_approval}</p>
          </div>
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
            <p className="text-green-400 text-sm">Active Subscriptions</p>
            <p className="text-2xl font-bold text-green-400">{stats.active}</p>
          </div>
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
            <p className="text-red-400 text-sm">Suspended</p>
            <p className="text-2xl font-bold text-red-400">{stats.suspended}</p>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
            <p className="text-yellow-400 text-sm">Pending Approvals</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.awaiting_approval}</p>
          </div>
          <div className="bg-purple-900/30 border border-purple-600 rounded-lg p-4">
            <p className="text-purple-400 text-sm">Monthly Revenue</p>
            <p className="text-2xl font-bold text-purple-400">${totalRevenue}</p>
          </div>
        </div>

        {/* USERS TABLE */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">All Users</h2>
            <div className="flex gap-2">
              {['all', 'pending', 'awaiting_approval', 'active', 'suspended'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-sm ${
                    filter === f 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f === 'awaiting_approval' ? 'Awaiting Approval' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left p-4 text-gray-300 font-medium">Business</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Email</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Plan</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Payment</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Status</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Billing End</th>
                  <th className="text-left p-4 text-gray-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-gray-700">
                      <td className="p-4 text-white">{user.business_name}</td>
                      <td className="p-4 text-gray-300">{user.email}</td>
                      <td className="p-4">
                        <div>
                          <span className="px-2 py-1 bg-blue-900/50 text-blue-400 rounded text-xs">
                            {user.plan_name}
                          </span>
                          <span className="text-gray-400 text-xs ml-2">${user.plan_price}/mo</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          user.payment_status === 'paid' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {user.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs capitalize ${
                          user.subscription_status === 'active' ? 'bg-green-900/50 text-green-400' :
                          user.subscription_status === 'pending' ? 'bg-yellow-900/50 text-yellow-400' :
                          user.subscription_status === 'awaiting_approval' ? 'bg-orange-900/50 text-orange-400' :
                          'bg-red-900/50 text-red-400'
                        }`}>
                          {user.subscription_status === 'awaiting_approval' ? 'Awaiting Approval' : user.subscription_status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400 text-sm">
                        {user.billing_end_date 
                          ? new Date(user.billing_end_date).toLocaleDateString()
                          : '-'
                        }
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {user.subscription_status === 'pending' && (
                            <span className="text-gray-400 text-xs">Waiting for payment</span>
                          )}
                          {user.subscription_status === 'awaiting_approval' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'active')}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                            >
                              Approve
                            </button>
                          )}
                          {user.subscription_status === 'active' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'suspended')}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                            >
                              Suspend
                            </button>
                          )}
                          {user.subscription_status === 'suspended' && (
                            <button
                              onClick={() => updateUserStatus(user.id, 'active')}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                            >
                              Reactivate
                            </button>
                          )}
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* RECENT SIGNUPS */}
        <div className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Signups</h2>
          <div className="space-y-3">
            {users
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 5)
              .map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{user.business_name}</p>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-300 text-sm">{new Date(user.created_at).toLocaleDateString()}</p>
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.subscription_status === 'active' ? 'bg-green-900/50 text-green-400' :
                      user.subscription_status === 'pending' ? 'bg-blue-900/50 text-blue-400' :
                      user.subscription_status === 'awaiting_approval' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {user.subscription_status === 'awaiting_approval' ? 'Awaiting Approval' : user.subscription_status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
