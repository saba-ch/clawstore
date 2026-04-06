import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { profiles, packages } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import type { AuthUser } from "../middleware/auth";
import { count } from "drizzle-orm";

const app = new Hono<AppEnv & { Variables: { user: AuthUser | null } }>();

// GET /v1/me — current user's identity and profile
app.get("/me", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const [pkgCount] = await db
    .select({ count: count() })
    .from(packages)
    .where(eq(packages.ownerUserId, user.id));

  return c.json({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    scope: profile?.githubLogin ?? null,
    ownedPackageCount: pkgCount?.count ?? 0,
    profile: profile
      ? {
          bio: profile.bio,
          website: profile.website,
          location: profile.location,
          avatarUrl: profile.avatarUrl,
          displayName: profile.displayName,
        }
      : null,
  });
});

export default app;
