"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import PlatformStaffPage from "@/admin/platform-staff/page"; // same component super admin uses

export default function ClientPlatformStaffWrapper() {
  return (
    <ProtectedRoute allowedRoles={["super_admin", "client_admin"]} redirectTo="/dashboard">
      <PlatformStaffPage />
    </ProtectedRoute>
  );
}
