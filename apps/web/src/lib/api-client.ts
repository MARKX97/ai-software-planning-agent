import { ApiClientError, type ApiErrorBody } from '@/types/api';

const DEFAULT_API_BASE_URL = 'http://localhost:3001/api/v1';

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function apiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_API_KEY;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${apiBaseUrl()}${normalizedPath}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function headers(hasBody: boolean): HeadersInit {
  const key = apiKey();
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

async function parseError(response: Response): Promise<ApiClientError> {
  let parsed: ApiErrorBody | null = null;
  try {
    parsed = (await response.json()) as ApiErrorBody;
  } catch {
    parsed = null;
  }
  const fallback = `HTTP ${response.status}`;
  const error = parsed?.error;
  return new ApiClientError(
    error?.message ?? fallback,
    error?.code ?? 'API_ERROR',
    response.status,
    error?.details,
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const hasBody = options.body !== undefined;
  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers: headers(hasBody),
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await fetch(buildUrl(path), {
    method: 'GET',
    headers: headers(false),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return response.blob();
}
