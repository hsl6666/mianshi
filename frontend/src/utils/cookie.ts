import Cookies from "js-cookie";

// Token存储的键名
export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
export const USERNAME_KEY = "username";
export const USER_ROLE_KEY = "user_role";

/**
 * 存储Token到Cookie
 * @param key Token键名
 * @param value Token值
 * @param expires 过期时间(天)
 * @param secure 是否仅HTTPS传输
 */
export const setTokenCookie = (
  key: string,
  value: string,
  expires: number = 7,
  secure: boolean = false,
) => {
  Cookies.set(key, value, {
    expires,
    path: "/", // 所有路径可见
    secure, // 生产环境启用HTTPS传输
    sameSite: "strict", // 防止CSRF攻击
  });
};

/**
 * 从Cookie获取Token
 * @param key Token键名
 * @returns Token值或undefined
 */
export const getTokenCookie = (key: string): string | undefined => {
  return Cookies.get(key);
};

/**
 * 从Cookie移除Token
 * @param key Token键名
 */
export const removeTokenCookie = (key: string) => {
  Cookies.remove(key, { path: "/" });
};

/**
 * 存储访问令牌
 * @param token 访问令牌
 * @param expires 过期时间(小时)，默认2小时
 */
export const setAccessToken = (token: string, expires: number = 2) => {
  // 转换为天单位
  setTokenCookie(ACCESS_TOKEN_KEY, token, expires / 24);
};

/**
 * 存储刷新令牌
 * @param token 刷新令牌
 * @param expires 过期时间(天)，默认7天
 */
export const setRefreshToken = (token: string, expires: number = 7) => {
  setTokenCookie(REFRESH_TOKEN_KEY, token, expires);
};

/**
 * 获取访问令牌
 */
export const getAccessToken = () => {
  return getTokenCookie(ACCESS_TOKEN_KEY);
};

/**
 * 获取刷新令牌
 */
export const getRefreshToken = () => {
  return getTokenCookie(REFRESH_TOKEN_KEY);
};

/**
 * 清除所有令牌
 */
export const clearAllTokens = () => {
  removeTokenCookie(ACCESS_TOKEN_KEY);
  removeTokenCookie(REFRESH_TOKEN_KEY);
};

export const setUsername = (username: string) => {
  setTokenCookie(USERNAME_KEY, username, 7);
};

export const getUsername = (): string | null => {
  return getTokenCookie(USERNAME_KEY) ?? null;
};

export const clearUsername = () => {
  removeTokenCookie(USERNAME_KEY);
};

export const setUserRole = (role: string) => {
  setTokenCookie(USER_ROLE_KEY, role, 7);
};

export const getUserRole = (): string | null => {
  return getTokenCookie(USER_ROLE_KEY) ?? null;
};

export const clearUserRole = () => {
  removeTokenCookie(USER_ROLE_KEY);
};
