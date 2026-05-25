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

export type UserRole = "super_admin" | "user";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
  login: (accessToken: string, refreshToken: string, username: string, role: UserRole) => void;
  logout: () => void;
  checkAuth: () => boolean;
  hydrateProfile: () => Promise<void>;
}

function resolveSuperAdmin(role: UserRole | null, username: string | null) {
  return role === "super_admin" || username === "cqzsxh";
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!getAccessToken(),
  username: getUsername(),
  role: (getUserRole() as UserRole) || null,
  isSuperAdmin: resolveSuperAdmin(getUserRole() as UserRole, getUsername()),

  login: (accessToken, refreshToken, username, role) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setUsername(username);
    setUserRole(role);
    set({
      isAuthenticated: true,
      username,
      role,
      isSuperAdmin: resolveSuperAdmin(role, username),
    });
  },

  logout: () => {
    clearAllTokens();
    clearUsername();
    clearUserRole();
    set({ isAuthenticated: false, username: null, role: null, isSuperAdmin: false });
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
    });
    return isAuth;
  },

  hydrateProfile: async () => {
    if (!get().isAuthenticated) return;
    try {
      const me = await fetchMe();
      setUserRole(me.role);
      setUsername(me.username);
      set({
        username: me.username,
        role: me.role,
        isSuperAdmin: me.is_super_admin,
      });
    } catch {
      get().logout();
    }
  },
}));
