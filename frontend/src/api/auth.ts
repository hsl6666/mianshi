import { apiClient } from "@/request/client";
import type { UserRole } from "@/store/authStore";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  username: string;
  role: UserRole;
  display_name?: string | null;
}

export interface CurrentUserResponse {
  username: string;
  role: UserRole;
  display_name?: string | null;
  is_super_admin: boolean;
}

export interface UserItem {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
  display_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserFormValues {
  username: string;
  password?: string;
  role: UserRole;
  display_name?: string;
  is_active: boolean;
}

export interface OperationLogItem {
  id: number;
  username: string;
  action: string;
  module: string;
  resource_type?: string | null;
  resource_id?: number | null;
  summary: string;
  detail?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface PaginatedOperationLogs {
  items: OperationLogItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/auth/login", { username, password });
  return data;
}

export async function fetchMe(): Promise<CurrentUserResponse> {
  const { data } = await apiClient.get<CurrentUserResponse>("/api/auth/me");
  return data;
}

export async function fetchUsers(): Promise<UserItem[]> {
  const { data } = await apiClient.get<UserItem[]>("/api/users");
  return data;
}

export async function createUser(values: UserFormValues): Promise<UserItem> {
  const { data } = await apiClient.post<UserItem>("/api/users", values);
  return data;
}

export async function updateUser(id: number, values: Partial<UserFormValues>): Promise<UserItem> {
  const { data } = await apiClient.patch<UserItem>(`/api/users/${id}`, values);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/api/users/${id}`);
}

export async function fetchOperationLogs(params: {
  page?: number;
  page_size?: number;
  keyword?: string;
  module?: string;
  username?: string;
}): Promise<PaginatedOperationLogs> {
  const { data } = await apiClient.get<PaginatedOperationLogs>("/api/operation-logs", { params });
  return data;
}
