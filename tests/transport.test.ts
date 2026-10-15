import { describe, expect, it, vi } from 'vitest';
import { transport } from '../src/core/transport.js';

const ok = () => new Response(JSON.stringify({ code: 'SUCCESS', data: { ok: true } }), { status: 200 });

describe('transport', () => {
  it('generates a different request id for every request', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => ok());
    const options = { fetchImpl };
    await transport('GET', '/one', undefined, options);
    await transport('GET', '/two', undefined, options);
    const first = (fetchImpl.mock.calls[0]?.[1].headers as Headers).get('x-request-id');
    const second = (fetchImpl.mock.calls[1]?.[1].headers as Headers).get('x-request-id');
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it('supports relative URLs when baseUrl is omitted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    await transport('GET', '/status?ready=1', undefined, { fetchImpl });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/status?ready=1');
  });
});
