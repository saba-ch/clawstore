import type { MiddlewareHandler } from "hono";
import { createAuth } from "../auth";
import type { AppEnv } from "../types";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

// Resolves the current user via Better Auth (session cookie or bearer token).
// Sets c.var.user (nullable) — does NOT reject unauthenticated requests.
// Protected routes should check c.var.user and return 401.
export const resolveUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const baseURL = new URL(c.req.url).origin;
  const auth = createAuth(c.env, baseURL);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session?.user) {
    c.set("user", {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    } satisfies AuthUser);
  } else {
    c.set("user", null);
  }

  await next();
};

// Helper to require auth — returns the user or a 401 response.
export function requireAuth(c: {
  var: { user: AuthUser | null };
  json: Function;
}) {
  const user = c.var.user;
  if (!user) {
    return c.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      401
    );
  }
  return user;
}
