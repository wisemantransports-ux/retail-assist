"use client";

// AdminProtectedRoute is intentionally a no-op passthrough.
// Per current auth policy, do not add additional client-side guards
// — the layout-level Gate (`app/dashboard/layout.tsx`) is the single source of truth.
export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

