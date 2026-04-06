import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".clawstore");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const AUTH_FILE = join(CONFIG_DIR, "auth.json");

export const DEFAULT_API_URL = "https://api.useclawstore.com/v1";

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

export interface AuthData {
  token: string;
  scope?: string;
  name?: string;
}

export async function readAuth(): Promise<AuthData | null> {
  try {
    const raw = await readFile(AUTH_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!data.token) return null;
    return data as AuthData;
  } catch {
    return null;
  }
}

export async function readToken(): Promise<string | null> {
  const auth = await readAuth();
  return auth?.token ?? null;
}

export async function writeAuth(data: AuthData): Promise<void> {
  await getConfigDir();
  await writeFile(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export async function writeToken(token: string): Promise<void> {
  await writeAuth({ token });
}
