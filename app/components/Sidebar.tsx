"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface User {
  id: string;
  role: string;
  workspace_id?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract workspaceId from pathname (e.g., /dashboard/[uuid]/employees -> [uuid])
  const getWorkspaceId = (): string | null => {
    const parts = pathname.split("/");
    // Check if we're in /dashboard/[workspaceId]/* route
    if (parts[2] && parts[2] !== "analytics" && parts[2] !== "agents" && 
        parts[2] !== "integrations" && parts[2] !== "billing" && 
        parts[2] !== "settings" && parts[2] !== "inbox" && 
        parts[2] !== "messages" && parts[2] !== "support-ai" &&
        parts[2] !== "policy-ai" && parts[2] !== "inbox-automation" &&
        parts[2] !== "website-integration" && parts[2] !== "visual-search" &&
        !parts[2].startsWith("[")) {
      return parts[2];
    }
    return null;
  };

  const workspaceId = getWorkspaceId();

  // Fetch user data to check role
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, []);

  // Check if user is admin or super_admin
  const isAdmin = user && (user.role === "admin" || user.role === "super_admin");

  const baseLinks = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
    { href: "/dashboard/agents", label: "AI Agents", icon: "🤖" },
    { href: "/dashboard/integrations", label: "Integrations", icon: "🔗" },
    { href: "/dashboard/billing", label: "Billing", icon: "💳" },
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  ];

  // Add Employees link only if user is admin/super_admin and we have a workspaceId
  const links = isAdmin && workspaceId
    ? [
        ...baseLinks.slice(0, 5), // Dashboard, Analytics, Agents, Integrations, Billing
        { href: `/dashboard/${workspaceId}/employees`, label: "Employees", icon: "👥" },
        ...baseLinks.slice(5), // Settings
      ]
    : baseLinks;

  return (
    <aside className="w-64 bg-card-bg border-r border-card-border p-6 hidden md:flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center font-bold">
          R
        </div>
        <span className="font-bold text-xl">Retail Pro</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <button
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                pathname === link.href
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-background"
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              <span className="font-medium">{link.label}</span>
            </button>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="pt-6 border-t border-card-border">
        <p className="text-xs text-muted mb-4">v1.0.0</p>
        <Link href="/dashboard/settings">
          <button className="w-full text-left px-3 py-2 text-sm text-muted hover:text-foreground transition-colors">
            ? Help & Support
          </button>
        </Link>
      </div>
    </aside>
  );
}
