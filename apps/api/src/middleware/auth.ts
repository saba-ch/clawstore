import type { MiddlewareHandler } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { apiTokens } from "../db/schema";
import { hashToken } from "../lib/token";
import { createAuth } from "../auth";
import type { AppEnv } from "../types";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

// Resolves the current user from Bearer token or session cookie.
// Sets c.var.user (nullable) — does NOT reject unauthenticated requests.
// Protected routes should check c.var.user themselves and return 401.
export const resolveUser: MiddlewareHandler<
  AppEnv & { Variables: { user: AuthUser | null } }
> = async (c, next) => {
  let user: AuthUser | null = null;

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const raw = authHeader.slice(7);
    const hash = await hashToken(raw);

    const db = c.var.db;
    const [token] = await db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.tokenHash, hash), isNull(apiTokens.revokedAt)))
      .limit(1);

    if (token) {
      // Update last_used_at (best-effort, don't block the response)
      c.executionCtx.waitUntil(
        db
          .update(apiTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiTokens.id, token.id))
      );

      // Resolve the user from the token
      const { users } = await import("../db/schema");
      const [u] = await db
        .select()
        .from(users)
        .where(eq(users.id, token.userId))
        .limit(1);

      if (u) {
        user = {
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
        };
      }
    }
  } else {
    // Try session cookie
    const baseURL =
      c.req.header("x-forwarded-proto") === "https"
        ? `https://${c.req.header("host")}`
        : `http://${c.req.header("host")}`;
    const auth = createAuth(c.env, baseURL);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session?.user) {
      user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      };
    }
  }

  c.set("user", user);
  await next();
};

// Helper to require auth — returns 401 if no user.
export function requireAuth(
  c: { var: { user: AuthUser | null }; json: Function }
) {
  const user = c.var.user;
  if (!user) {
    return c.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      401
    );
  }
  return user;
}
