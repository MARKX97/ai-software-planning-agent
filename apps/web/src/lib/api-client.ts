import { ApiClientError, type ApiErrorBody } from '@/types/api';

const DEFAULT_API_BASE_URL = 'http://localhost:3001/api/v1';
const DEFAULT_USER_ERROR_MESSAGE = '操作未完成，请稍后重试。';

const USER_ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: '输入信息有误，请检查后重试。',
  PROJECT_NOT_FOUND: '项目不存在或已被删除，请返回项目列表重新选择。',
  CONVERSATION_NOT_FOUND: '当前对话已失效，请刷新页面后重试。',
  ARTIFACT_NOT_FOUND: '产物不存在或已被删除，请返回产物列表重新选择。',
  WORKFLOW_NOT_FOUND: '未找到工作流，请返回项目页重新启动。',
  EXECUTION_NOT_FOUND: '执行记录不存在或已被清理，请刷新页面后重试。',
  PROVIDER_NOT_FOUND: '所选模型服务暂不可用，请稍后重试。',
  EXPORT_NOT_FOUND: '导出文件不存在或已过期，请重新导出。',
  INVALID_STAGE_TRANSITION: '当前流程状态不支持此操作，请刷新页面后重试。',
  WORKFLOW_ALREADY_RUNNING: '工作流正在运行，无需重复启动。',
  WORKFLOW_NOT_RUNNING: '工作流尚未启动，请先启动后再操作。',
  WORKFLOW_STAGE_NOT_CLARIFICATION: '当前阶段不需要补充信息，请刷新页面查看最新状态。',
  LLM_TIMEOUT: '模型响应超时，请稍后重试。',
  LLM_NETWORK_ERROR: '暂时无法连接模型服务，请稍后重试。',
  LLM_CANCELLED: '回复已取消。',
  LLM_ERROR: '模型服务暂时不可用，请稍后重试。',
  ALL_MODELS_FAILED: '所有模型服务当前均不可用，请稍后重试。',
  COST_LIMIT_EXCEEDED: '本项目已达到成本上限，请调整预算后重试。',
  RATE_LIMITED: '请求过于频繁，请稍后再试。',
  EXPORT_NOT_READY: '导出文件仍在生成，请稍后再试。',
  EXPORT_FAILED: '导出生成失败，请重新导出。',
  UNAUTHORIZED: '身份验证已失效，请检查 API Key 后重试。',
  FORBIDDEN: '当前凭证无权执行此操作，请检查 API Key。',
  INTERNAL_ERROR: '服务暂时不可用，请稍后重试。',
  NETWORK_ERROR: '无法连接到服务，请检查网络或确认服务已启动后重试。',
  INVALID_RESPONSE: '服务返回了无法识别的数据，请稍后重试。',
};

const STATUS_ERROR_MESSAGES: Record<number, string> = {
  400: USER_ERROR_MESSAGES['INVALID_INPUT'],
  401: USER_ERROR_MESSAGES['UNAUTHORIZED'],
  403: USER_ERROR_MESSAGES['FORBIDDEN'],
  404: '请求的内容不存在或已被删除。',
  409: '当前状态不支持此操作，请刷新页面后重试。',
  429: USER_ERROR_MESSAGES['RATE_LIMITED'],
  500: USER_ERROR_MESSAGES['INTERNAL_ERROR'],
  502: USER_ERROR_MESSAGES['INTERNAL_ERROR'],
  503: USER_ERROR_MESSAGES['INTERNAL_ERROR'],
  504: USER_ERROR_MESSAGES['LLM_TIMEOUT'],
};

const RAW_ERROR_MESSAGES = [
  [/all models failed/i, USER_ERROR_MESSAGES['ALL_MODELS_FAILED']],
  [/cost limit/i, USER_ERROR_MESSAGES['COST_LIMIT_EXCEEDED']],
  [/rate limit|too many requests|\b429\b/i, USER_ERROR_MESSAGES['RATE_LIMITED']],
  [/unauthorized|forbidden|api key|\b401\b|\b403\b/i, USER_ERROR_MESSAGES['UNAUTHORIZED']],
  [/timeout|timed out|aborted/i, USER_ERROR_MESSAGES['LLM_TIMEOUT']],
  [/fetch failed|failed to fetch|network|econn|enotfound/i, USER_ERROR_MESSAGES['NETWORK_ERROR']],
] as const;

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
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

function userMessage(code: string, status: number): string {
  return USER_ERROR_MESSAGES[code] ?? STATUS_ERROR_MESSAGES[status] ?? DEFAULT_USER_ERROR_MESSAGE;
}

export function getUserErrorMessage(error: unknown, fallback = DEFAULT_USER_ERROR_MESSAGE): string {
  if (error instanceof ApiClientError) return error.message;
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  if (/[一-鿿]/.test(message)) return message;
  return RAW_ERROR_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? fallback;
}

async function fetchApi(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiClientError(USER_ERROR_MESSAGES['NETWORK_ERROR'], 'NETWORK_ERROR', 0);
  }
}

export async function parseApiError(response: Response): Promise<ApiClientError> {
  let parsed: ApiErrorBody | null = null;
  try {
    parsed = (await response.json()) as ApiErrorBody;
  } catch {
    parsed = null;
  }
  const error = parsed?.error;
  const code = error?.code ?? 'API_ERROR';
  return new ApiClientError(
    userMessage(code, response.status),
    code,
    response.status,
    error?.details,
  );
}

export async function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const method = options.method ?? 'GET';
  const hasBody = options.body !== undefined;
  return fetchApi(buildUrl(path, options.query), {
    method,
    headers: headers(hasBody),
    body: hasBody ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    signal: options.signal,
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    throw await parseApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiClientError(
      USER_ERROR_MESSAGES['INVALID_RESPONSE'],
      'INVALID_RESPONSE',
      response.status,
    );
  }
}

export async function apiDownload(path: string, query?: Record<string, QueryValue>): Promise<Blob> {
  const response = await fetchApi(buildUrl(path, query), {
    method: 'GET',
    headers: headers(false),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return response.blob();
}
