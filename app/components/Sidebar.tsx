"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface User {
  id: string;
  role: string;
  workspace_id?: string;
}

interface NavLink {
  href: string;
  label: string;
  icon: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract workspaceId from pathname (e.g., /dashboard/uuid/employees -> uuid)
  // Only extracts if parts[2] contains hyphens (characteristic of UUIDs)
  const getWorkspaceId = (): string | null => {
    const parts = pathname.split("/");
    if (parts[2] && parts[2].includes("-")) {
      return parts[2];
    }
    return null;
  };

  const workspaceId = getWorkspaceId();

  // Fetch user data from /api/auth/me
  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          console.log("[Sidebar] User fetched successfully:", {
            role: data.user?.role,
            workspace_id: data.user?.workspace_id
          });
        } else {
          console.warn("[Sidebar] Failed to fetch user, status:", res.status);
        }
      } catch (error) {
        console.error("[Sidebar] Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, []);

  // Determine which Employees link to show based on role
  const getEmployeesLink = (): NavLink | null => {
    if (!user) return null;

    // CASE 1: super_admin - Always show Employees link to /admin/employees
    // (super_admin is on /admin routes, not /dashboard routes)
    if (user.role === "super_admin") {
      console.log("[Sidebar] super_admin detected: showing Employees link to /admin/employees");
      return { href: "/admin/employees", label: "Employees", icon: "👥" };
    }

    // CASE 2: admin (client_admin) - Show Employees link only if workspaceId exists
    // (client_admin is on /dashboard/[workspaceId] routes)
    if (user.role === "admin" && workspaceId) {
      console.log("[Sidebar] client_admin detected with workspace:", {
        workspace_id: workspaceId,
        employees_route: `/dashboard/${workspaceId}/employees`
      });
      return {
        href: `/dashboard/${workspaceId}/employees`,
        label: "Employees",
        icon: "👥"
      };
    }

    if (user.role === "admin" && !workspaceId) {
      console.log("[Sidebar] client_admin detected but NO workspaceId found in pathname");
      return null;
    }

    // CASE 3: Other roles (employee, agent) - Don't show Employees link
    console.log("[Sidebar] Role", user.role, "does not have access to Employees link");
    return null;
  };

  const employeesLink = getEmployeesLink();

  // Debug logging
  console.log("[Sidebar] Render state:", {
    pathname,
    workspaceId,
    userRole: user?.role,
    employeesLinkShown: !!employeesLink,
    employeesHref: employeesLink?.href,
    loading
  });

  // Base links - same for all users
  const baseLinks: NavLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
    { href: "/dashboard/agents", label: "AI Agents", icon: "🤖" },
    { href: "/dashboard/integrations", label: "Integrations", icon: "🔗" },
    { href: "/dashboard/billing", label: "Billing", icon: "💳" },
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" }
  ];

  // Build final links array: insert Employees link after Billing if applicable
  const links: NavLink[] = employeesLink
    ? [
        ...baseLinks.slice(0, 5), // Dashboard, Analytics, Agents, Integrations, Billing
        employeesLink, // Employees (conditional)
        ...baseLinks.slice(5) // Settings
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
