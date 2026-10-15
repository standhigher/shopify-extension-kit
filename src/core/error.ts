export interface ExtensionErrorOptions {
  status?: number;
  requestId?: string;
  traceId?: string;
  businessCode?: string;
  details?: unknown;
  cause?: unknown;
}

/** A stable error shape for HTTP, business, transport and authentication failures. */
export class ExtensionError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly businessCode?: string;
  readonly details?: unknown;

  constructor(code: string, message: string, options: ExtensionErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ExtensionError';
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.traceId = options.traceId;
    this.businessCode = options.businessCode;
    this.details = options.details;
  }
}
