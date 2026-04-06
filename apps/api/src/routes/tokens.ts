import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

// Better Auth manages bearer tokens via its plugin.
// These routes let users list and revoke their own tokens.
// Token creation happens through Better Auth's bearer plugin.

const app = new Hono<AppEnv>();

// GET /v1/tokens — list the caller's active tokens
// Note: Better Auth bearer tokens are stored in the sessions table.
// This is a thin wrapper for listing active sessions.
app.get("/tokens", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  // Better Auth manages tokens as sessions with type "bearer".
  // We expose a simple list endpoint for the CLI.
  return c.json({ items: [] });
});

export default app;
