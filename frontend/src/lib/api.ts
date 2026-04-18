const API_BASE = '/api/v1';

export interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number; limit: number };
  error?: { code: string; message: string; statusCode: number };
}

class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const json: ApiResponse<T> = await res.json();

  if (!res.ok || json.error) {
    const err = json.error ?? { code: 'UNKNOWN', message: 'Request failed', statusCode: res.status };
    throw new ApiError(err.code, err.message, err.statusCode);
  }

  return json.data;
}

async function requestWithMeta<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
    ...options,
  });

  if (res.status === 204) return { data: undefined as T };

  const json: ApiResponse<T> = await res.json();

  if (!res.ok || json.error) {
    const err = json.error ?? { code: 'UNKNOWN', message: 'Request failed', statusCode: res.status };
    throw new ApiError(err.code, err.message, err.statusCode);
  }

  return json;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  getWithMeta: <T>(path: string) => requestWithMeta<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { ApiError };
