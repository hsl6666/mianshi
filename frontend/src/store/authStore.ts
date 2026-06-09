import { create } from "zustand";
import {
  setAccessToken,
  setRefreshToken,
  clearAllTokens,
  getAccessToken,
  getUsername,
  setUsername,
  clearUsername,
  getUserRole,
  setUserRole,
  clearUserRole,
} from "@/utils/cookie";
import { fetchMe } from "@/api/auth";
import type { PermissionsMap } from "@/constants/permissions";
import {
  clearWangjunAuth,
  getWangjunAuth,
  setWangjunAuth,
  type WangjunLoginResponse,
} from "@/utils/wangjunAuth";

export type UserRole = "super_admin" | "user";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
  permissions: PermissionsMap;
  profileHydrated: boolean;
  wangjunAuth: WangjunLoginResponse | null;
  login: (
    accessToken: string,
    refreshToken: string,
    username: string,
    role: UserRole,
    wangjunAuth?: WangjunLoginResponse | null,
  ) => void;
  logout: () => void;
  checkAuth: () => boolean;
  hydrateProfile: () => Promise<void>;
  updateWangjunAuth: (wangjunAuth: WangjunLoginResponse) => void;
  hasPermission: (module: keyof PermissionsMap, action: string) => boolean;
}

function resolveSuperAdmin(role: UserRole | null, username: string | null) {
  return role === "super_admin" || username === "cqzsxh";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!getAccessToken(),
  username: getUsername(),
  role: (getUserRole() as UserRole) || null,
  isSuperAdmin: resolveSuperAdmin(getUserRole() as UserRole, getUsername()),
  permissions: {},
  profileHydrated: false,
  wangjunAuth: getWangjunAuth(),

  hasPermission: (module, action) => {
    const state = get();
    if (state.isSuperAdmin) return true;
    return Boolean(state.permissions[module]?.[action as never]);
  },

  login: (accessToken, refreshToken, username, role, wangjunAuth = null) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setUsername(username);
    setUserRole(role);
    if (wangjunAuth) {
      setWangjunAuth(wangjunAuth);
    } else {
      clearWangjunAuth();
    }
    set({
      isAuthenticated: true,
      username,
      role,
      isSuperAdmin: resolveSuperAdmin(role, username),
      wangjunAuth: wangjunAuth ?? null,
    });
  },

  logout: () => {
    clearAllTokens();
    clearUsername();
    clearUserRole();
    clearWangjunAuth();
    set({
      isAuthenticated: false,
      username: null,
      role: null,
      isSuperAdmin: false,
      permissions: {},
      profileHydrated: false,
      wangjunAuth: null,
    });
    window.location.href = "/login";
  },

  checkAuth: () => {
    const isAuth = !!getAccessToken();
    const role = getUserRole() as UserRole | null;
    const username = getUsername();
    set({
      isAuthenticated: isAuth,
      role,
      username,
      isSuperAdmin: resolveSuperAdmin(role, username),
      wangjunAuth: getWangjunAuth(),
    });
    return isAuth;
  },

  updateWangjunAuth: (wangjunAuth) => {
    setWangjunAuth(wangjunAuth);
    set({ wangjunAuth });
  },

  hydrateProfile: async () => {
    if (!get().isAuthenticated) {
      set({ profileHydrated: true });
      return;
    }
    try {
      const me = await fetchMe();
      setUserRole(me.role);
      setUsername(me.username);
      set({
        username: me.username,
        role: me.role,
        isSuperAdmin: me.is_super_admin,
        permissions: me.permissions ?? {},
        profileHydrated: true,
      });
    } catch {
      get().logout();
    }
  },
}));
