import request from "@/request";

export namespace authAPI {
  // 用户登录
  export const login = async (username: string, password: string) => {
    return await request.post("/auth/login", { username, password });
  };

  // 刷新Token
  export const refreshToken = (refreshToken: string) => {
    return request.post("/auth/refresh-token", { refreshToken });
  };

  // 退出登录
  export const logout = () => {
    return request.post("/auth/logout");
  };
}
