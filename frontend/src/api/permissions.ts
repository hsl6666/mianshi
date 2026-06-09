import { apiClient } from "@/request/client";
import type { PermissionsMap } from "@/constants/permissions";

export interface PermissionActionItem {
  action: string;
  label: string;
}

export interface PermissionModuleItem {
  module: string;
  label: string;
  actions: PermissionActionItem[];
}

export interface RoleItem {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_system: boolean;
  permissions: PermissionsMap;
  user_count: number;
}

export interface RoleFormValues {
  name: string;
  description?: string;
  permissions: PermissionsMap;
}

export async function fetchPermissionCatalog(): Promise<PermissionModuleItem[]> {
  const { data } = await apiClient.get<PermissionModuleItem[]>("/api/permissions/catalog");
  return data;
}

export async function fetchRoles(): Promise<RoleItem[]> {
  const { data } = await apiClient.get<RoleItem[]>("/api/permissions/roles");
  return data;
}

export async function createRole(values: RoleFormValues): Promise<RoleItem> {
  const { data } = await apiClient.post<RoleItem>("/api/permissions/roles", values);
  return data;
}

export async function updateRole(
  roleId: number,
  values: { name?: string; description?: string },
): Promise<RoleItem> {
  const { data } = await apiClient.put<RoleItem>(`/api/permissions/roles/${roleId}`, values);
  return data;
}

export async function updateRolePermissions(
  roleId: number,
  permissions: PermissionsMap,
): Promise<RoleItem> {
  const { data } = await apiClient.put<RoleItem>(`/api/permissions/roles/${roleId}/permissions`, {
    permissions,
  });
  return data;
}

export async function deleteRole(roleId: number): Promise<void> {
  await apiClient.delete(`/api/permissions/roles/${roleId}`);
}
