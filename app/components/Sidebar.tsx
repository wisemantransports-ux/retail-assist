"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
    { href: "/dashboard/agents", label: "AI Agents", icon: "🤖" },
    { href: "/dashboard/integrations", label: "Integrations", icon: "🔗" },
    { href: "/dashboard/billing", label: "Billing", icon: "💳" },
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <aside className="w-64 bg-card-bg border-r border-card-border p-6 hidden md:flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center font-bold">
          S
        </div>
        <span className="font-bold text-xl">Samuel</span>
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
