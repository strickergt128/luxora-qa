import axios from "axios";
import store from "../store";
import { setAccessToken, logout } from "../store/slices/authSlice";
import NProgress from "nprogress";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
  withCredentials: true,
});

let activeRequests = 0;
function startProgress() {
  if (typeof window === "undefined") return;
  if (activeRequests === 0) NProgress.start();
  activeRequests++;
}
function endProgress() {
  if (typeof window === "undefined") return;
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests === 0) NProgress.done();
}

api.interceptors.request.use((config) => {
  startProgress();

  const stateUser = store.getState().auth.user as { accessToken?: string } | null;
  const token = stateUser?.accessToken;

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let subscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(token: string) {
  subscribers.forEach((cb) => cb(token));
  subscribers = [];
}
function addSubscriber(cb: (token: string) => void) {
  subscribers.push(cb);
}
function isAuthUrl(url?: string) {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/admin-2fa/")
  );
}
function isAuthRoutePath(path?: string) {
  if (!path) return false;
  return path.startsWith("/auth/");
}

api.interceptors.response.use(
  (res) => {
    endProgress();
    return res;
  },
  async (error) => {
    endProgress();

    const { response, config } = error || {};
    const original = config || {};

    if (response?.status === 401 && !original._retry && !isAuthUrl(original.url)) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          addSubscriber((newToken) => {
            if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
            (original as any)._retry = true;
            resolve(api(original));
          });
        });
      }

      (original as any)._retry = true;
      isRefreshing = true;
      try {
        const { data } = await api.post(
          "/auth/refresh",
          {},
          { headers: { "Cache-Control": "no-cache" } }
        );
        const newToken = data.accessToken as string;
        store.dispatch(setAccessToken(newToken));
        isRefreshing = false;
        onTokenRefreshed(newToken);

        if (original.headers) original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (e) {
        isRefreshing = false;
        onTokenRefreshed("");
        store.dispatch(logout());

        if (typeof window !== "undefined") {
          const path = window.location.pathname || "";
          if (!isAuthRoutePath(path)) {
            const next = encodeURIComponent(path + window.location.search);
            window.location.href = `/auth/login?next=${next}`;
          }
        }
        return Promise.reject(e);
      }
    }

    if (response?.status === 403 && !isAuthUrl(original.url)) {
      const msg = response?.data?.message || "";
      const skip = Boolean((original as any).skipRedirectOn403);

      // Do not auto-redirect on MFA requirement
      if (msg === "Admin 2FA required") {
        return Promise.reject(error);
      }

      // Allow requests to opt out (e.g., analytics screens)
      if (skip) {
        return Promise.reject(error);
      }

      if (typeof window !== "undefined") {
        const path = window.location.pathname || "";
        const onProtectedPage = path.startsWith("/admin") || path.startsWith("/seller");
        const reqUrl = (original?.url as string) || "";
        const isProtectedApi = reqUrl.includes("/admin/") || reqUrl.includes("/seller/");
        if (onProtectedPage || isProtectedApi) {
          window.location.href = "/403";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
