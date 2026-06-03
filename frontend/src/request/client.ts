import axios from "axios";
import { getAccessToken, clearAllTokens, clearUsername } from "@/utils/cookie";
import { ROUTE_PATHS } from "@/constants/common";

const baseURL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");

export const apiClient = axios.create({
  baseURL,
  timeout: 60_000,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAllTokens();
      clearUsername();
      if (!window.location.pathname.startsWith(ROUTE_PATHS.login)) {
        window.location.href = ROUTE_PATHS.login;
      }
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return Promise.reject(new Error(detail));
    }
    if (Array.isArray(detail)) {
      return Promise.reject(new Error(detail.map((item) => item.msg).join("; ")));
    }
    return Promise.reject(error);
  },
);
