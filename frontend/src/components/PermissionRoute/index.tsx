import { Navigate } from "react-router-dom";
import type { PermissionActionMap, PermissionModule } from "@/constants/permissions";
import { ROUTE_PATHS } from "@/constants/common";
import { useAuthStore } from "@/store/authStore";

interface PermissionRouteProps {
  module: PermissionModule;
  action: PermissionActionMap[PermissionModule];
  children: React.ReactNode;
  fallback?: string;
}

export default function PermissionRoute({
  module,
  action,
  children,
  fallback = ROUTE_PATHS.biddingProjects,
}: PermissionRouteProps) {
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const profileHydrated = useAuthStore((s) => s.profileHydrated);
  const allowed =
    isSuperAdmin || Boolean(permissions[module]?.[action as keyof (typeof permissions)[typeof module]]);

  if (!profileHydrated) {
    return null;
  }

  if (!allowed) {
    return <Navigate to={fallback} replace />;
  }

  return children;
}
