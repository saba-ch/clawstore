import { createClient, type ClawstoreClient } from "@clawstore/sdk";
import { getApiUrl, readToken } from "./config.js";

let _client: ClawstoreClient | null = null;

export async function getClient(): Promise<ClawstoreClient> {
  if (_client) return _client;
  const baseUrl = await getApiUrl();
  const token = await readToken();
  _client = createClient({ baseUrl, token: token ?? undefined });
  return _client;
}

export async function getAuthenticatedClient(): Promise<ClawstoreClient> {
  const token = await readToken();
  if (!token) {
    console.error("Not logged in. Run `clawstore login` first.");
    process.exit(1);
  }
  const baseUrl = await getApiUrl();
  return createClient({ baseUrl, token });
}
