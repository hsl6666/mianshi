import { useCallback } from "react";
import type { PermissionActionMap, PermissionModule } from "@/constants/permissions";
import { useAuthStore } from "@/store/authStore";

export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const can = useCallback(
    <M extends PermissionModule>(module: M, action: PermissionActionMap[M]) => {
      if (isSuperAdmin) return true;
      return Boolean((permissions[module] as Record<string, boolean> | undefined)?.[action]);
    },
    [permissions, isSuperAdmin],
  );

  const hasPermission = useCallback(
    <M extends PermissionModule>(module: M, action: PermissionActionMap[M]) => can(module, action),
    [can],
  );

  return { can, isSuperAdmin, hasPermission };
}
