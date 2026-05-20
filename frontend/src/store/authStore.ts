import { create } from "zustand";
import { setAccessToken, setRefreshToken, clearAllTokens, getAccessToken } from "@/utils/cookie";

interface AuthState {
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  // 初始状态：检查Cookie中是否有AccessToken
  isAuthenticated: !!getAccessToken(),

  login: (accessToken, refreshToken) => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    set({ isAuthenticated: true });
  },

  // 登出：清除Cookie中的Token
  logout: () => {
    clearAllTokens();
    set({ isAuthenticated: false });
    window.location.href = "/login";
  },

  // 检查认证状态
  checkAuth: () => {
    const isAuth = !!getAccessToken();
    set({ isAuthenticated: isAuth });
    return isAuth;
  },
}));
