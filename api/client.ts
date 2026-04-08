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
  const controller = createTimeoutController(REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
      signal: controller.signal,
    });

    // Success response
    if (response.ok) {
      const data = await response.json();
      return { data, error: null };
    }

    // Error response
    const error = await parseErrorResponse(response);
    return { data: null, error };
  } catch (err: any) {
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
 * Authenticated POST request helper (with Bearer token)
 */
export async function authPost<T, B = unknown>(
  endpoint: string,
  body: B,
  accessToken: string
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
}
