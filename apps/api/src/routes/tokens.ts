import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { apiTokens } from "../db/schema";
import { generateToken } from "../lib/token";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";
import type { AuthUser } from "../middleware/auth";

const app = new Hono<AppEnv & { Variables: { user: AuthUser | null } }>();

// POST /v1/tokens — create a new API token
app.post("/tokens", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user; // 401 response

  const body = await c.req.json<{ name?: string }>();
  const name = body.name || "default";

  const { raw, hash } = await generateToken();
  const id = crypto.randomUUID();

  await c.var.db.insert(apiTokens).values({
    id,
    userId: user.id,
    name,
    tokenHash: hash,
  });

  return c.json({ id, name, token: raw, createdAt: new Date().toISOString() }, 201);
});

// GET /v1/tokens — list caller's tokens (metadata only)
app.get("/tokens", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const tokens = await c.var.db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, user.id));

  return c.json(tokens);
});

// DELETE /v1/tokens/:id — revoke a token
app.delete("/tokens/:id", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const tokenId = c.req.param("id");

  const [token] = await c.var.db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, user.id)))
    .limit(1);

  if (!token) {
    throw new AppError("token_not_found", "Token not found", 404);
  }

  await c.var.db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(eq(apiTokens.id, tokenId));

  return c.json({ ok: true });
});

export default app;
