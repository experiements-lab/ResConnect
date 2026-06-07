import axios from "axios";
import { supabase } from "./supabase";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,
});

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use((r) => r, (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 && !window.location.pathname.startsWith("/auth")) {
    window.location.href = "/auth/login";
  }
  return Promise.reject(error);
});
