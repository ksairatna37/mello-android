/**
 * API Client
 * Fetch wrapper with error handling and typed responses
 */

import { API_BASE_URL } from './endpoints';
import type { ApiResponse, ApiError } from './types';

// Request timeout (10 seconds)
const REQUEST_TIMEOUT = 10000;

// Default headers
const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeout: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller;
}

/**
 * Parse error response from server
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    return {
      status: response.status,
      message: data.detail || data.message || data.error || 'Request failed',
      code: data.code,
    };
  } catch {
    return {
      status: response.status,
      message: response.statusText || 'Request failed',
    };
  }
}

/**
 * Main request function
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const controller = createTimeoutController(REQUEST_TIMEOUT);
  const started = Date.now();
  console.log(`[api] → ${method} ${endpoint}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
      signal: controller.signal,
    });

    const ms = Date.now() - started;

    // Success response
    if (response.ok) {
      console.log(`[api] ← ${method} ${endpoint} ${response.status} (${ms}ms)`);
      // 204 / empty body: skip JSON parse, return null payload.
      const text = await response.text();
      if (!text) return { data: null as unknown as T, error: null };
      try {
        return { data: JSON.parse(text) as T, error: null };
      } catch (parseErr) {
        console.warn(`[api] ← ${method} ${endpoint} non-JSON success body, len=${text.length}`);
        return { data: null as unknown as T, error: null };
      }
    }

    // Error response
    const error = await parseErrorResponse(response);
    console.warn(
      `[api] ← ${method} ${endpoint} ${response.status} (${ms}ms) — ${error.message}`,
    );
    return { data: null, error };
  } catch (err: any) {
    const ms = Date.now() - started;
    console.warn(`[api] ✕ ${method} ${endpoint} (${ms}ms) — ${err?.name ?? 'Error'}: ${err?.message ?? err}`);
    // Network or timeout error
    if (err.name === 'AbortError') {
      return {
        data: null,
        error: {
          status: 0,
          message: 'Request timeout. Please check your connection.',
          code: 'TIMEOUT',
        },
      };
    }

    return {
      data: null,
      error: {
        status: 0,
        message: err.message || 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

/**
 * GET request helper
 */
export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return request<T>(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 */
export async function post<T, B = unknown>(
  endpoint: string,
  body: B
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Authenticated GET request helper (with Bearer token)
 */
export async function authGet<T>(
  endpoint: string,
  accessToken: string
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
}

/**
 * Authenticated POST request helper (with Bearer token).
 * Optional `extraHeaders` lets callers pass per-request headers like
 * `Prefer: resolution=merge-duplicates,return=representation` for
 * upsert-style POSTs to PostgREST.
 */
export async function authPost<T, B = unknown>(
  endpoint: string,
  body: B,
  accessToken: string,
  extraHeaders?: Record<string, string>,
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      ...(extraHeaders ?? {}),
    },
  });
}

/**
 * Authenticated PATCH request helper (with Bearer token)
 */
export async function authPatch<T, B = unknown>(
  endpoint: string,
  body: B,
  accessToken: string
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
}

/**
 * Authenticated DELETE request helper (with Bearer token).
 * Used by voice endpoints (voice_sessions, voice_context,
 * voice_user_profiles) which expose DELETE per /docs.
 */
export async function authDelete<T, B = unknown>(
  endpoint: string,
  accessToken: string,
  body?: B,
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
