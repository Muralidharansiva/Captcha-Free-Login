// src/utils/api.ts

import { getAccessToken, logout } from "./auth";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"}/`;

export const api = async <T = any>(
  endpoint: string,
  method: string = "GET",
  body?: any,
  authRequired: boolean = false
): Promise<T> => {

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (authRequired) {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    logout();
    window.location.href = "/auth";
    throw new Error("Session expired");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data as T;
};
