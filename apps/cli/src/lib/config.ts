import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".clawstore");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const AUTH_FILE = join(CONFIG_DIR, "auth.json");

export const DEFAULT_API_URL = "https://api.clawstore.dev/v1";

export interface Config {
  apiUrl?: string;
}

export async function getConfigDir(): Promise<string> {
  await mkdir(CONFIG_DIR, { recursive: true });
  return CONFIG_DIR;
}

export async function readConfig(): Promise<Config> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getApiUrl(): Promise<string> {
  return process.env.CLAWSTORE_API_URL ?? (await readConfig()).apiUrl ?? DEFAULT_API_URL;
}

export async function readToken(): Promise<string | null> {
  try {
    const raw = await readFile(AUTH_FILE, "utf-8");
    const data = JSON.parse(raw);
    return data.token ?? null;
  } catch {
    return null;
  }
}

export async function writeToken(token: string): Promise<void> {
  await getConfigDir();
  await writeFile(AUTH_FILE, JSON.stringify({ token }, null, 2), { mode: 0o600 });
}
