"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, allowedRoles, redirectTo = "/unauthorized" }: ProtectedRouteProps) {
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function checkRole() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/admin/login");
          return;
        }

        const data = await res.json();
        const role = data.user?.role;

        if (!allowedRoles.includes(role)) {
          router.push(redirectTo);
          return;
        }

        setAuthorized(true);
      } catch (err) {
        router.push("/admin/login");
      }
    }

    checkRole();
  }, [allowedRoles, redirectTo, router]);

  if (!authorized) return null;

  return <>{children}</>;
}
