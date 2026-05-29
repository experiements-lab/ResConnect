import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export const kratosApi = axios.create({
  baseURL: import.meta.env.VITE_KRATOS_URL || "http://localhost:4433",
  withCredentials: true,
});
