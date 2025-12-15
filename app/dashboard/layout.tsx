"use client";

import "@/globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import SubscriptionGuard from "@/components/SubscriptionGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </SubscriptionGuard>
  );
}
