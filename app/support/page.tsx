"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SupportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/auth/login');
          return;
        }
        const data = await res.json();
        if (data.role !== 'platform_staff') {
          router.push('/unauthorized');
          return;
        }
        setAuthorized(true);
      } catch (err) {
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!authorized) return null;

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Platform Support Dashboard</h1>
        <p className="text-gray-600 mb-6">Placeholder support dashboard. Authentication is required to access this page.</p>
      </div>
    </div>
  );
}
