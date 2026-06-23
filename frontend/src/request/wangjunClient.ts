import axios from "axios";
import { getWangjunAccessToken } from "@/utils/wangjunAuth";

/** 本地开发 / 生产环境下的 /wangjun 代理前缀（仅浏览器侧，第三方真实路径不含此前缀） */
export function getWangjunProxyPrefix(): string {
  const prefix = import.meta.env.DEV
    ? "/wangjun"
    : (import.meta.env.VITE_WANGJUN_API_BASE_URL ?? "/wangjun");
  return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

/** 拼接完整请求路径，例如 /wangjun/api/v1/bidding/projects */
export function buildWangjunUrl(apiPath: string): string {
  const normalized = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${getWangjunProxyPrefix()}${normalized}`;
}

export const wangjunClient = axios.create({
  baseURL: "",
  timeout: 120_000,
});

wangjunClient.interceptors.request.use((config) => {
  const token = getWangjunAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

wangjunClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return Promise.reject(new Error(detail));
    }
    if (Array.isArray(detail)) {
      return Promise.reject(new Error(detail.map((item) => item.msg).join("; ")));
    }
    const message = error.response?.data?.message;
    if (typeof message === "string") {
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);
