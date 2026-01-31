import { ROLE_IDS } from "@/lib/roles";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Suspense } from "react";
import { MinimalRouteFallback } from "@/components/ui/skeletons";

export function SuperAdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoleIds={[ROLE_IDS.SUPER_ADMIN]}>
      <SuperAdminLayout>
        <Suspense fallback={<MinimalRouteFallback />}>
          {children}
        </Suspense>
      </SuperAdminLayout>
    </ProtectedRoute>
  );
}
