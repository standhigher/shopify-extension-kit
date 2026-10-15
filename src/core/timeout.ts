import { ExtensionError } from './error.js';

export const DEFAULT_TIMEOUT_MS = 5000;

/** Run only the fetch phase under a timeout and caller abort signal. */
export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  requestId: string,
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const abortFromCaller = () => {
    rejectAbort?.(new ExtensionError('ABORTED', 'Request was aborted', { requestId }));
    controller.abort(signal?.reason);
  };
  let rejectAbort: ((error: ExtensionError) => void) | undefined;

  if (signal?.aborted) {
    throw new ExtensionError('ABORTED', 'Request was aborted', { requestId });
  }

  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
    signal?.addEventListener('abort', abortFromCaller, { once: true });
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new ExtensionError('TIMEOUT', `Request timed out after ${timeoutMs}ms`, { requestId }));
      controller.abort();
    }, timeoutMs);
  });
  try {
    const fetchPromise = Promise.resolve().then(() => fetchImpl(url, { ...init, signal: controller.signal }));
    return await Promise.race([fetchPromise, abortPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof ExtensionError) throw error;
    if (timedOut) throw new ExtensionError('TIMEOUT', `Request timed out after ${timeoutMs}ms`, { requestId, cause: error });
    if (signal?.aborted) throw new ExtensionError('ABORTED', 'Request was aborted', { requestId, cause: error });
    throw new ExtensionError('NETWORK_ERROR', 'Network request failed', { requestId, cause: error });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
    rejectAbort = undefined;
  }
}
