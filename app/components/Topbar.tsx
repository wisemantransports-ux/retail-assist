"use client";

import { useState } from "react";
import Link from "next/link";

export default function Topbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="bg-card-bg border-b border-card-border px-6 lg:px-8 py-4 flex items-center justify-between">
      {/* Left side */}
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-xs text-muted">Welcome back to Samuel</p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center bg-background border border-card-border rounded-lg px-3 py-2 w-64">
          <span className="text-muted">🔍</span>
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent ml-2 outline-none text-sm flex-1"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-background rounded-lg transition-colors">
          <span className="text-xl">🔔</span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-2 hover:bg-background rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-semibold">
              A
            </div>
            <span className="text-sm hidden sm:inline">Account</span>
            <span className="text-xs text-muted">▼</span>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-card-bg border border-card-border rounded-lg shadow-lg p-2 z-50">
              <Link href="/dashboard/settings">
                <button className="w-full text-left px-3 py-2 hover:bg-background rounded-lg text-sm transition-colors">
                  Settings
                </button>
              </Link>
              <button className="w-full text-left px-3 py-2 hover:bg-background rounded-lg text-sm transition-colors">
                Profile
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-background rounded-lg text-sm transition-colors">
                Help
              </button>
              <div className="border-t border-card-border my-2"></div>
              <button className="w-full text-left px-3 py-2 hover:bg-error/10 text-error rounded-lg text-sm transition-colors">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
