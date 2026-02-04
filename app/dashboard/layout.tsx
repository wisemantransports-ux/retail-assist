"use client";

import "@/globals.css";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

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
  const { status, user } = useAuth();
  const router = useRouter();


  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
    }

    if (status === 'unauthorized') {
      router.replace('/unauthorized');
    }
  }, [status, router]);

  // ⛔ Never block authenticated users
  if (status === 'loading') return null;

  // While redirecting
  if (status === 'unauthenticated' || status === 'unauthorized') {
    return null;
  }

  // ✅ AUTHORIZED — ALWAYS RENDER
  // Presentational layout: Sidebar (left) + Topbar + main content area
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
