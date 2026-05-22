import axios from "axios";

const baseURL = import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8010";

export const apiClient = axios.create({
  baseURL,
  timeout: 60_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
