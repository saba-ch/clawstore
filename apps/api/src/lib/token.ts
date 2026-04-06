// API token generation and hashing utilities.
// Raw token is shown once at creation, only the SHA-256 hash is stored.

export async function generateToken(): Promise<{
  raw: string;
  hash: string;
}> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = `cs_${toHex(bytes)}`;
  const hash = await hashToken(raw);
  return { raw, hash };
}

export async function hashToken(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
