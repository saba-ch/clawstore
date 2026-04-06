// Typed fetch client for the ClawStore API.
// Used by both CLI and web frontend.
// Full implementation in Phase 6.

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  fetch?: typeof globalThis.fetch;
}

export function createClient(_config: ClientConfig) {
  return {};
}
