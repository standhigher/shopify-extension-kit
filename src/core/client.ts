import { transport } from './transport.js';
import type { ExtensionClient, ExtensionClientOptions } from './types.js';

/** Create a small HTTP client for an extension's business API. */
export function createExtensionClient(options: ExtensionClientOptions = {}): ExtensionClient {
  return {
    get: (path, requestOptions) => transport('GET', path, undefined, options, requestOptions),
    post: (path, body, requestOptions) => transport('POST', path, body, options, requestOptions),
    put: (path, body, requestOptions) => transport('PUT', path, body, options, requestOptions),
    delete: (path, requestOptions) => transport('DELETE', path, undefined, options, requestOptions),
  };
}
