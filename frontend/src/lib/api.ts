import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 15000,
});

export const kratosApi = axios.create({
  baseURL: "/kratos",
  withCredentials: true,
  timeout: 15000,
});

// Global 401 handler — expired session redirects to login instead of showing errors
const handle401 = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 && !window.location.pathname.startsWith("/auth")) {
    window.location.href = "/auth/login";
  }
  return Promise.reject(error);
};

api.interceptors.response.use((r) => r, handle401);
kratosApi.interceptors.response.use((r) => r, (error) => {
  const url = (error as { config?: { url?: string } })?.config?.url ?? "";
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 && !url.includes("whoami") && !window.location.pathname.startsWith("/auth")) {
    window.location.href = "/auth/login";
  }
  return Promise.reject(error);
});
