export interface WangjunLoginUser {
  id: string;
  local_username: string;
  display_name: string;
}

export interface WangjunLoginTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface WangjunLoginResponse {
  status: string;
  tokens: WangjunLoginTokens;
  user: WangjunLoginUser;
}

const WANGJUN_AUTH_KEY = "wangjun_auth";

export function setWangjunAuth(data: WangjunLoginResponse) {
  localStorage.setItem(WANGJUN_AUTH_KEY, JSON.stringify(data));
}

export function getWangjunAuth(): WangjunLoginResponse | null {
  const raw = localStorage.getItem(WANGJUN_AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WangjunLoginResponse;
  } catch {
    return null;
  }
}

export function getWangjunAccessToken(): string | null {
  return getWangjunAuth()?.tokens.access_token ?? null;
}

export function clearWangjunAuth() {
  localStorage.removeItem(WANGJUN_AUTH_KEY);
}

/** 是否尝试登录第三方（王军）平台；未开启时不会发起 local-login 请求。 */
export function isWangjunLoginEnabled(): boolean {
  return import.meta.env.VITE_WANGJUN_LOGIN_ENABLED === "true";
}
