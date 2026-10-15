/** Supplies authentication headers for the current extension request. */
export interface ExtensionRuntime {
  getAuthHeaders?(): Record<string, string> | Promise<Record<string, string>>;
}
