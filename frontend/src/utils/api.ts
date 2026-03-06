// src/utils/api.ts

import { getAccessToken, logout } from "./auth";

/**
 * Base URL:
 * - Uses VITE_API_BASE_URL if provided
 * - Otherwise defaults to production Render backend
 */
const RENDER_BASE_URL = "https://captcha-free-login.onrender.com";
const RAW_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  RENDER_BASE_URL;

const isLocalApiHost = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const isHttpApiUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const isLocalFrontend =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const isSecureFrontend =
  typeof window !== "undefined" && window.location.protocol === "https:";

const shouldForceRenderBase =
  (isLocalApiHost(RAW_BASE_URL) && !isLocalFrontend) ||
  (isHttpApiUrl(RAW_BASE_URL) && isSecureFrontend);

// Guard against accidentally configured localhost API URL in hosted environments (e.g. Vercel env vars).
const BASE_URL =
  shouldForceRenderBase ? RENDER_BASE_URL : RAW_BASE_URL;
const NORMALIZED_BASE_URL = BASE_URL.replace(/\/+$/, "");
export const API_BASE_URL = NORMALIZED_BASE_URL.endsWith("/api")
  ? NORMALIZED_BASE_URL
  : `${NORMALIZED_BASE_URL}/api`;

/**
 * Generic API helper
 */
export const api = async <T = any>(
  endpoint: string,
  method: string = "GET",
  body?: any,
  authRequired: boolean = false
): Promise<T> => {
  try {
    // Ensure endpoint doesn't start with a slash
    const cleanEndpoint = endpoint.startsWith("/")
      ? endpoint.slice(1)
      : endpoint;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Attach JWT token if required
    if (authRequired) {
      const token = getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_BASE_URL}/${cleanEndpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle expired token
    if (response.status === 401) {
      logout();
      window.location.href = "/auth";
      throw new Error("Session expired");
    }

    // Try parsing JSON safely
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.error || data?.message || "Request failed");
    }

    return data as T;
  } catch (error: any) {
    const message =
      error?.name === "TypeError" && /Failed to fetch/i.test(error?.message || "")
        ? "Unable to reach server. Please check your internet connection and try again."
        : error?.message || "Request failed";
    console.error("API Error:", message);
    throw new Error(message);
  }
};
