// @ts-nocheck
import {
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./cookie";

import request from './index'

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let requestQueue: Array<(token: string) => void> = [];

async function refreshToken(): Promise<string> {
  const data = await request.get<RefreshTokenResponse>(
    `/api/platform/auth/v1/refresh-token?refreshToken=${getRefreshToken() || localStorage.getItem("refresh_token_lf")}`,
    // {},
    // { ignoreAuth: true }
  );
  console.log(data, "datadatadatadata");

  const { accessToken, refreshToken } = data;
  setAccessToken(accessToken, 7);
  setRefreshToken(refreshToken, 7);
  localStorage.setItem("access_token_lf", accessToken);
  localStorage.setItem("refresh_token_lf", refreshToken);
  return accessToken;
}

export async function refreshAndRetry(originalRequest: any) {
  if (!isRefreshing) {
    isRefreshing = true;
    // if(!getCookie("refresh_token_lf")) {
    //   logout()
    // }
    // const logout = useAuthStore((state) => state.logout);

    refreshPromise = refreshToken()
      .then((token) => {
        requestQueue.forEach((cb) => cb(token));
        requestQueue = [];
        return token;
      })
      .catch((error) => {
        requestQueue = [];
        // logout()
        throw error;
      })
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
  }

  return new Promise((resolve, reject) => {
    requestQueue.push((token: string) => {
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: token,
      };
      // 这里用 api/service 重新发请求
      request(originalRequest).then(resolve).catch(reject);
      // import('./axios').then(({ request }) => {
      //   request(originalRequest.url,originalRequest).then(resolve).catch(reject)
      // })
    });
  });
}
