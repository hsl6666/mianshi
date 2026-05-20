// @ts-nocheck
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import Cookies from "js-cookie";
axios.defaults.withCredentials = true;
import { message } from "antd";
import { refreshAndRetry } from "./useTokenRefresh";
interface RequestConfig extends AxiosRequestConfig {
  showLoading?: boolean;
}
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  status_code?: number;
  status_message?: string;
}

const customAxios: AxiosInstance = axios.create({
  // baseURL: "http://10.0.0.213:8020",
  // baseURL: import.meta.env.VITE_API_BASE_URL,
  // timeout: 10000,
  // headers: {
  //   "Content-Type": "application/json",
  // },
});

let tokenErrorShown = false;

customAxios.interceptors.request.use(
  (config: RequestConfig) => {
    const tstoken = Cookies.get("access_token_lf")
    if (!tstoken) {
      //清除所有cookie的数据
      Cookies.remove("access_token_lf");
      Cookies.remove("refresh_token_lf");
      Cookies.remove("user_info");

      if (!tokenErrorShown) {
        tokenErrorShown = true;
        message.error("登录已过期，请重新登录");
      }
      return Promise.reject("登录已过期，请重新登录");
    }

    tokenErrorShown = false;
    config.headers["Authorization"] = `${tstoken}`;
    if (
      config.url!.includes("/api/platform/auth/v1/refresh-token") ||
      config.url!.includes("openapi/application/loginByAccount")
    ) {
      config.headers["Authorization"] = "";
    }
    config.headers["Access-Control-Allow-Origin"] = "*";
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

customAxios.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (response.data.status_code === 200 || response.data.code === 200) {
      // if (!response.data.data) {
      //   return 200;
      // }
      return response.data;
    }
    if (response.data.code === 0) {
      return response.data;
    }

    if (response.data.code === 99999) {
      return response.data;
    }
    if (response?.data?.status_code == 500) {
      message.error(response?.data?.status_message);
      return Promise.reject(response?.data?.status_message);
    }
    if (response.data.code == 500) {
      if (response.data.message == "创建失败: 已经存在") {
        message.error("名称已存在！");
        return Promise.reject(response.data.status_message);
      }
      message.error(response.data.message || response.data.status_message);
      return Promise.reject(response.data.status_message);
    }
    if (!response.data.status_code && !response.data.code) {
      return response;
    }
    switch (response.data.code) {
      case 500:
        message.error(response.data.message);
        return Promise.reject(response.data.message);
      default:
        message.error(response.data.message);
        return Promise.reject(response.data.message);
    }
  },
  (error: AxiosError) => {
    // console.error('application error :>> ', error);
    if (error.response?.status === 401) {
      // cookie expires
      // console.error('登录过期 :>> ');
      // const UUR_INFO = 'UUR_INFO'
      // const infoStr = localStorage.getItem(UUR_INFO)
      // localStorage.removeItem(UUR_INFO)
      // infoStr && location.reload()
      if (error?.status === 401 && error && !error.config.headers._retry) {
        error.config.headers._retry = true; // 避免无限递归
        return refreshAndRetry(error.config);
      }
      return Promise.reject("登录过期,请重新登录");
    }
    /**
     * 功能:是否强制下线
     * 条件:
     * 409 强制下线,账号在其他客户端登录
     * 刷新token接口特殊处理,它在http层会返回400,但后端在结果里面还是会返回409
     */
    if (
      error?.response?.status === 409 ||
      (error?.response?.status === 400 && error?.response?.data?.code === 409)
    ) {
      if (window.$wujie?.props?.setGlobalDownline) {
        window.$wujie.props.setGlobalDownline();
      }
      return Promise.reject(error);
    }
    if (error?.response?.status === 400 && error?.response?.data?.code === 10002) {
      message.error(error?.response?.data?.message);
    }
    if (error.code === "ERR_CANCELED") return Promise.reject(error);
    // window.errorAlerts([error.message])
    return Promise.reject(error);
  },
);

export default customAxios;
