import { describe, expect, it, vi } from 'vitest';
import { createExtensionClient, ExtensionError, type ExtensionRuntime } from '../src/core/index.js';

const response = (body: unknown, init: ResponseInit = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

describe('createExtensionClient', () => {
  it('performs GET and extracts successful data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ code: 'SUCCESS', message: 'success', data: { id: '1' } }));
    const client = createExtensionClient({ baseUrl: 'https://api.example.com/', fetchImpl });

    await expect(client.get<{ id: string }>('/orders/1')).resolves.toEqual({ id: '1' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/orders/1', expect.objectContaining({ method: 'GET' }));
  });

  it('sends JSON bodies for POST and PUT and supports DELETE', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      expect(init.headers).toBeInstanceOf(Headers);
      return response({ code: 'SUCCESS', message: 'success', data: { ok: true } });
    });
    const client = createExtensionClient({ baseUrl: 'https://api.example.com', fetchImpl });

    await client.post('/orders', { id: '1' });
    await client.put('/orders/1', { status: 'updated' });
    await client.delete<void>('/orders/1');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).body).toBe(JSON.stringify({ id: '1' }));
    expect((fetchImpl.mock.calls[1]?.[1] as RequestInit).body).toBe(JSON.stringify({ status: 'updated' }));
    expect((fetchImpl.mock.calls[2]?.[1] as RequestInit).body).toBeUndefined();
  });

  it('merges default and runtime auth headers, with runtime taking precedence', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ code: 'SUCCESS', data: null }));
    const runtime: ExtensionRuntime = { getAuthHeaders: () => ({ authorization: 'Bearer token', 'x-runtime': 'yes' }) };
    const client = createExtensionClient({
      fetchImpl,
      headers: { Authorization: 'wrong', 'x-default': 'yes' },
      runtime,
    });

    await client.get('/health', { headers: { 'x-request': 'yes' } });
    const headers = fetchImpl.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer token');
    expect(headers.get('x-default')).toBe('yes');
    expect(headers.get('x-request')).toBe('yes');
    expect(headers.get('x-runtime')).toBe('yes');
    expect(headers.get('x-request-id')).toBeTruthy();
  });

  it('throws auth error when runtime auth resolution fails without fetching', async () => {
    const fetchImpl = vi.fn();
    const client = createExtensionClient({ fetchImpl, runtime: { getAuthHeaders: async () => { throw new Error('token failed'); } } });

    await expect(client.get('/private')).rejects.toMatchObject({ code: 'AUTH_ERROR' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws HTTP and business errors while preserving trace and request ids', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ code: 'UNAUTHORIZED', message: 'nope', traceId: 'trace-1' }, { status: 401 }))
      .mockResolvedValueOnce(response({ code: 'OUT_OF_STOCK', message: 'sold out', traceId: 'trace-2' }));
    const client = createExtensionClient({ fetchImpl });

    let httpError: ExtensionError | undefined;
    try { await client.get('/private'); } catch (error) { httpError = error as ExtensionError; }
    expect(httpError).toMatchObject({ code: 'AUTH_ERROR', status: 401, traceId: 'trace-1' });
    expect(httpError?.requestId).toBeTruthy();

    let businessError: ExtensionError | undefined;
    try { await client.get('/order'); } catch (error) { businessError = error as ExtensionError; }
    expect(businessError).toMatchObject({ code: 'OUT_OF_STOCK', traceId: 'trace-2' });
  });

  it('returns undefined for a 204 response and rejects malformed JSON', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('{bad json', { status: 200 }));
    const client = createExtensionClient({ fetchImpl });

    await expect(client.get<void>('/empty')).resolves.toBeUndefined();
    await expect(client.get('/bad')).rejects.toMatchObject({ code: 'PARSE_ERROR' });
  });

  it('classifies 4xx, 5xx and network failures', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ code: 'VALIDATION_FAILED', message: 'invalid', traceId: 'trace-4' }, { status: 422 }))
      .mockResolvedValueOnce(response({ code: 'SERVICE_DOWN', message: 'unavailable' }, { status: 503 }))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    const client = createExtensionClient({ fetchImpl });

    await expect(client.get('/invalid')).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 422, businessCode: 'VALIDATION_FAILED', traceId: 'trace-4', message: 'invalid' });
    await expect(client.get('/down')).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 503, businessCode: 'SERVICE_DOWN' });
    await expect(client.get('/offline')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('uses request timeout override and leaves bodyless GET without Content-Type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ code: 'SUCCESS', data: true }));
    const client = createExtensionClient({ baseUrl: 'https://api.example.com/v1/', timeoutMs: 1000, fetchImpl });
    await client.get('/orders?limit=2', { timeoutMs: 20 });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.example.com/v1/orders?limit=2');
    expect((fetchImpl.mock.calls[0]?.[1].headers as Headers).has('content-type')).toBe(false);
  });
});
