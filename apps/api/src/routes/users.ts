import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { profiles, packages } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /v1/users/:username — public profile
app.get("/users/:username", async (c) => {
  const username = c.req.param("username").toLowerCase();
  const db = c.var.db;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.githubLogin, username))
    .limit(1);

  if (!profile) {
    throw new AppError("user_not_found", "User not found", 404);
  }

  const userPackages = await db
    .select({
      scope: packages.scope,
      name: packages.name,
      tagline: packages.tagline,
      avgRating: packages.avgRating,
      downloadCount: packages.downloadCount,
    })
    .from(packages)
    .where(eq(packages.ownerUserId, profile.userId));

  return c.json({
    githubLogin: profile.githubLogin,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    website: profile.website,
    location: profile.location,
    createdAt: profile.createdAt,
    packages: userPackages,
  });
});

// PUT /v1/users/:username/profile — update own profile
app.put("/users/:username/profile", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const username = c.req.param("username").toLowerCase();
  const db = c.var.db;

  // Verify the caller owns this profile
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.githubLogin, username))
    .limit(1);

  if (!profile || profile.userId !== user.id) {
    throw new AppError(
      "forbidden",
      "You can only update your own profile",
      403
    );
  }

  const body = await c.req.json<{
    bio?: string;
    website?: string;
    location?: string;
    displayName?: string;
  }>();

  await db
    .update(profiles)
    .set({
      ...(body.bio !== undefined && { bio: body.bio }),
      ...(body.website !== undefined && { website: body.website }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.displayName !== undefined && { displayName: body.displayName }),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id));

  return c.json({ ok: true });
});

export default app;
