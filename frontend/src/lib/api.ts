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

/**
 * Global in-flight request counter. Every call into this module
 * increments before fetch and decrements in a `finally`, dispatching a
 * `api:inflight` CustomEvent on `window` whenever the count changes.
 *
 * The TopProgressBar component listens for this event and renders a
 * thin animated bar across the top of the viewport while count > 0.
 * This is the cheapest way to give the user *something* on screen for
 * every click that fires an API call without having to add per-button
 * loading state to dozens of forms.
 *
 * Lives in this module (not a separate store) so any code path that
 * already imports `api` picks up the instrumentation automatically.
 * SSR-safe: guarded by `typeof window !== 'undefined'`.
 */
let inflightCount = 0;
const INFLIGHT_EVENT = 'api:inflight';

function notifyInflightChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(INFLIGHT_EVENT, { detail: { count: inflightCount } }),
  );
}

function startInflight() {
  inflightCount++;
  notifyInflightChange();
}

function endInflight() {
  inflightCount = Math.max(0, inflightCount - 1);
  notifyInflightChange();
}

export const API_INFLIGHT_EVENT = INFLIGHT_EVENT;

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
  startInflight();
  try {
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
  } finally {
    endInflight();
  }
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
  startInflight();
  try {
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
  } finally {
    endInflight();
  }
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
