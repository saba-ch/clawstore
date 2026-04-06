import { createAuthClient } from "better-auth/react";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/v1$/, "") ?? "https://api.useclawstore.com";

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/api/auth",
  plugins: [deviceAuthorizationClient()],
});
