import type { ExtensionRuntime } from './runtime.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ExtensionClientOptions extends RequestOptions {
  baseUrl?: string;
  runtime?: ExtensionRuntime;
  fetchImpl?: typeof fetch;
}

export interface ExtensionClient {
  get<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
}

export interface ApiResponse<T> {
  code: string;
  message?: string;
  traceId?: string;
  data?: T;
  details?: unknown;
}
