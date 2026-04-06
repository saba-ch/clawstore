import { Hono } from "hono";
import { eq, and, isNull, desc } from "drizzle-orm";
import * as semver from "semver";
import { packages, versions } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// POST /v1/updates — bulk update check
app.post("/updates", async (c) => {
  const db = c.var.db;

  const body = await c.req.json<{
    installs: Array<{ id: string; version: string }>;
  }>();

  if (!body.installs || !Array.isArray(body.installs)) {
    return c.json({ updates: [] });
  }

  const updates: Array<{
    id: string;
    from: string;
    to: string;
    channel: string;
    yanked: boolean;
  }> = [];

  for (const install of body.installs) {
    // Parse the ID: @scope/name
    const idMatch = install.id.match(/^@([a-z0-9-]+)\/([a-z0-9][a-z0-9-]*[a-z0-9])$/);
    if (!idMatch) continue;
    const [, scope, name] = idMatch;

    const [pkg] = await db
      .select({ id: packages.id, latestVersionId: packages.latestVersionId })
      .from(packages)
      .where(and(eq(packages.scope, scope), eq(packages.name, name)))
      .limit(1);

    if (!pkg || !pkg.latestVersionId) continue;

    const [latest] = await db
      .select({
        version: versions.version,
        channel: versions.channel,
        yankedAt: versions.yankedAt,
      })
      .from(versions)
      .where(eq(versions.id, pkg.latestVersionId))
      .limit(1);

    if (!latest) continue;

    // Check if the installed version's published row is yanked
    const [installedVersion] = await db
      .select({ yankedAt: versions.yankedAt })
      .from(versions)
      .where(and(eq(versions.packageId, pkg.id), eq(versions.version, install.version)))
      .limit(1);

    const isYanked = !!installedVersion?.yankedAt;

    if (semver.gt(latest.version, install.version) || isYanked) {
      updates.push({
        id: install.id,
        from: install.version,
        to: latest.version,
        channel: latest.channel,
        yanked: isYanked,
      });
    }
  }

  return c.json({ updates });
});

export default app;
