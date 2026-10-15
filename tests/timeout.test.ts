import { describe, expect, it, vi } from 'vitest';
import { transport } from '../src/core/transport.js';

const delayedFetch: typeof fetch = (_url, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
  if (init?.signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});

describe('timeout and abort', () => {
  it('aborts fetch and throws TIMEOUT after the configured duration', async () => {
    const started = Date.now();
    await expect(transport('GET', '/slow', undefined, { fetchImpl: delayedFetch, timeoutMs: 10 })).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(5);
  });

  it('distinguishes caller initiated abort from timeout', async () => {
    const controller = new AbortController();
    const promise = transport('GET', '/cancel', undefined, { fetchImpl: delayedFetch, timeoutMs: 1000 }, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('cleans up timeout when fetch resolves', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await transport('GET', '/fast', undefined, { fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'SUCCESS', data: 1 }))) });
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
