import { createClient } from "@clawstore/sdk";

const API_URL = import.meta.env.VITE_API_URL ?? "https://api.useclawstore.com/v1";

export const api = createClient({ baseUrl: API_URL });
