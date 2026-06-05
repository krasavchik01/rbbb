/**
 * API client utilities for communicating with the backend server
 */

const API_BASE = typeof window !== 'undefined' ? '' : process.env.API_BASE || 'http://localhost:3000';

export interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Make an API request with automatic user context
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...options.headers,
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // Add user context from localStorage if available
    const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.id) headers['x-user-id'] = user.id;
        if (user.name) headers['x-user-name'] = user.name;
        if (user.role) headers['x-user-role'] = user.role;
      } catch (e) {
        console.error('Failed to parse user from localStorage:', e);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let error = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        error = errorData.error || error;
      } catch (e) {
        // Ignore JSON parse errors
      }
      return { error, status: response.status };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    };
  }
}

/**
 * GET request
 */
export function apiGet<T = any>(endpoint: string, options?: RequestOptions) {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request
 */
export function apiPost<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * POST multipart/form-data request. Do not set Content-Type manually: fetch adds
 * the boundary automatically.
 */
export function apiPostFormData<T = any>(endpoint: string, formData: FormData, options?: RequestOptions) {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: formData,
  });
}

/**
 * PUT request
 */
export function apiPut<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export function apiDelete<T = any>(endpoint: string, options?: RequestOptions) {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

