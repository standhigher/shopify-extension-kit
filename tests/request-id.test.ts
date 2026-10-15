import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequestId } from '../src/core/request-id.js';

afterEach(() => vi.unstubAllGlobals());

describe('createRequestId', () => {
  it('uses the Web Crypto fallback when randomUUID is unavailable', () => {
    let next = 0;
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) array[i] = next++ % 256;
        return array;
      },
    });

    const first = createRequestId();
    const second = createRequestId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
