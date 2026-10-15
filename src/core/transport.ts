import { ExtensionError } from './error.js';
import { createRequestId } from './request-id.js';
import { DEFAULT_TIMEOUT_MS, fetchWithTimeout } from './timeout.js';
import type { ApiResponse, ExtensionClientOptions, HttpMethod, RequestOptions } from './types.js';

function createUrl(baseUrl: string | undefined, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  const base = baseUrl.replace(/\/+$/, '');
  const route = path.replace(/^\/+/, '');
  return `${base}/${route}`;
}

function timeoutFor(options: ExtensionClientOptions, requestOptions: RequestOptions): number {
  const timeoutMs = requestOptions.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new RangeError('timeoutMs must be a non-negative finite number');
  }
  return timeoutMs;
}

export async function transport<T>(
  method: HttpMethod,
  path: string,
  body: unknown,
  options: ExtensionClientOptions,
  requestOptions: RequestOptions = {},
): Promise<T> {
  const requestId = createRequestId();
  const headers = new Headers(options.headers);
  for (const [key, value] of Object.entries(requestOptions.headers ?? {})) headers.set(key, value);

  try {
    const authHeaders = await options.runtime?.getAuthHeaders?.();
    for (const [key, value] of Object.entries(authHeaders ?? {})) headers.set(key, value);
  } catch (error) {
    throw new ExtensionError('AUTH_ERROR', 'Failed to obtain authentication headers', { requestId, cause: error });
  }

  headers.set('X-Request-ID', requestId);
  let serializedBody: string | undefined;
  if (body !== undefined) {
    serializedBody = JSON.stringify(body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchWithTimeout(
    fetchImpl,
    createUrl(options.baseUrl, path),
    { method, headers, body: serializedBody },
    timeoutFor(options, requestOptions),
    requestOptions.signal,
    requestId,
  );

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw new ExtensionError('PARSE_ERROR', 'Failed to read response', { status: response.status, requestId, cause: error });
  }

  if (text.trim() === '') {
    if (response.ok) return undefined as T;
    throw new ExtensionError(response.status === 401 ? 'AUTH_ERROR' : 'HTTP_ERROR', response.statusText || `HTTP ${response.status}`, {
      status: response.status,
      requestId,
    });
  }

  let payload: ApiResponse<T>;
  try {
    payload = JSON.parse(text) as ApiResponse<T>;
  } catch (error) {
    throw new ExtensionError('PARSE_ERROR', 'Invalid JSON response', { status: response.status, requestId, cause: error });
  }

  if (typeof payload !== 'object' || payload === null || typeof payload.code !== 'string') {
    throw new ExtensionError('PARSE_ERROR', 'Invalid API response', { status: response.status, requestId });
  }

  if (!response.ok) {
    throw new ExtensionError(response.status === 401 ? 'AUTH_ERROR' : 'HTTP_ERROR', payload.message || response.statusText || `HTTP ${response.status}`, {
      status: response.status,
      requestId,
      traceId: payload.traceId,
      businessCode: payload.code,
      details: payload.details,
    });
  }

  if (payload.code !== 'SUCCESS') {
    throw new ExtensionError(payload.code, payload.message || payload.code, {
      status: response.status,
      requestId,
      traceId: payload.traceId,
      details: payload.details,
    });
  }
  return payload.data as T;
}
