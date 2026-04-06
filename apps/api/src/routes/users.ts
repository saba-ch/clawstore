import { Hono } from "hono";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { agents, profiles } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /me
app.get("/me", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  const [agentCount] = await db
    .select({ count: count() })
    .from(agents)
    .where(eq(agents.ownerUserId, user.id));

  return c.json({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    scope: profile?.githubLogin ?? null,
    ownedAgentCount: agentCount?.count ?? 0,
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

// GET /users/:username
app.get("/users/:username", async (c) => {
  const username = c.req.param("username").toLowerCase();
  const db = c.var.db;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.githubLogin, username))
    .limit(1);

  if (!profile) throw new AppError("user_not_found", "User not found", 404);

  const userAgents = await db
    .select({
      scope: agents.scope,
      name: agents.name,
      tagline: agents.tagline,
      avgRating: agents.avgRating,
      downloadCount: agents.downloadCount,
    })
    .from(agents)
    .where(eq(agents.ownerUserId, profile.userId));

  return c.json({
    githubLogin: profile.githubLogin,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    website: profile.website,
    location: profile.location,
    createdAt: profile.createdAt,
    agents: userAgents,
  });
});

// PUT /users/:username/profile
app.put("/users/:username/profile", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const username = c.req.param("username").toLowerCase();
  const db = c.var.db;

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
