import { describe, expect, it } from 'vitest';
import { ExtensionError } from '../src/core/error.js';

describe('ExtensionError', () => {
  it('is an Error with stable diagnostic fields', () => {
    const cause = new Error('root');
    const error = new ExtensionError('HTTP_ERROR', 'Bad gateway', { status: 502, requestId: 'req-1', traceId: 'trace-1', cause });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ExtensionError');
    expect(error).toMatchObject({ code: 'HTTP_ERROR', status: 502, requestId: 'req-1', traceId: 'trace-1' });
    expect(error.cause).toBe(cause);
  });
});
