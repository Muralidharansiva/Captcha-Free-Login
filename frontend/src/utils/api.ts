import { getAccessToken, logout } from './auth';

/**
 * Base URL:
 * - Uses VITE_API_BASE_URL if provided
 * - Otherwise defaults to production Render backend
 */
const RENDER_BASE_URL = 'https://captcha-free-login.onrender.com';
const RAW_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  RENDER_BASE_URL;

const isLocalApiHost = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const isHttpApiUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const isLocalFrontend =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);
const isSecureFrontend =
  typeof window !== 'undefined' && window.location.protocol === 'https:';

const shouldForceRenderBase =
  (isLocalApiHost(RAW_BASE_URL) && !isLocalFrontend) ||
  (isHttpApiUrl(RAW_BASE_URL) && isSecureFrontend);

const BASE_URL = shouldForceRenderBase ? RENDER_BASE_URL : RAW_BASE_URL;
const NORMALIZED_BASE_URL = BASE_URL.replace(/\/+$/, '');
export const API_BASE_URL = NORMALIZED_BASE_URL.endsWith('/api')
  ? NORMALIZED_BASE_URL
  : `${NORMALIZED_BASE_URL}/api`;

// Render free cold starts can exceed one minute.
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 150000);
const MAX_GET_RETRIES = Number(import.meta.env.VITE_API_GET_RETRIES || 2);
const MAX_NON_GET_RETRIES = Number(import.meta.env.VITE_API_NON_GET_RETRIES || 1);

const RETRYABLE_POST_ENDPOINT_PREFIXES = [
  'login/',
  'verify-email-otp/',
  'register/',
  'admin/session/',
  '',
];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const parseResponseBody = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isRetryablePostEndpoint = (endpoint: string): boolean => {
  const pathOnly = endpoint.split('?')[0];
  return RETRYABLE_POST_ENDPOINT_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(prefix));
};

/**
 * Generic API helper
 */
export const api = async <T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  authRequired: boolean = false
): Promise<T> => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const hasBody = body !== undefined && body !== null;
  const methodUpper = method.toUpperCase();

  const headers: HeadersInit = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  if (authRequired) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/${cleanEndpoint}`, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401) {
        logout();
        window.location.href = '/auth';
        throw new Error('Session expired. Please login again.');
      }

      const data = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Request failed');
      }

      return data as T;
    } catch (error: any) {
      const isNetworkError =
        error?.name === 'TypeError' && /Failed to fetch/i.test(error?.message || '');
      const isTimeoutError = error?.name === 'AbortError';

      const retryBudget =
        methodUpper === 'GET'
          ? MAX_GET_RETRIES
          : methodUpper === 'POST' && isRetryablePostEndpoint(cleanEndpoint)
            ? MAX_NON_GET_RETRIES
            : 0;

      const canRetry =
        attempt < retryBudget && (isNetworkError || isTimeoutError);

      if (canRetry) {
        attempt += 1;
        await sleep(1500 * attempt);
        continue;
      }

      const message = isTimeoutError
        ? 'Server is taking longer than expected. Please try again in a few seconds.'
        : isNetworkError
          ? 'Unable to reach server. Please check your internet connection and try again.'
          : error?.message || 'Request failed';

      console.error(`API Error [${methodUpper} ${cleanEndpoint}]:`, message);
      throw new Error(message);
    } finally {
      window.clearTimeout(timeout);
    }
  }
};

