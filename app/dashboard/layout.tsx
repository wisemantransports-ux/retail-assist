"use client";

import "@/globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import SubscriptionGuard from "@/components/SubscriptionGuard";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";

/**
 * Dashboard Layout
 *
 * Role-Based Access:
 * - admin: Full access (client business admin)
 * - super_admin: Full access (platform owner)
 * 
 * Other roles are redirected by middleware before reaching this layout.
 * SubscriptionGuard ensures subscription status is validated.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
      <SubscriptionGuard>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </SubscriptionGuard>
    </ProtectedRoute>
  );
}
