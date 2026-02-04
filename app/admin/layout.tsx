"use client";

import "@/globals.css";
import Topbar from "@/components/Topbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Topbar />
      <main className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
