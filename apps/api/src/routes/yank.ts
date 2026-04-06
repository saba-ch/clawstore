import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { packages, versions } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// POST /v1/packages/:scope/:name/versions/:version/yank — yank a version
app.post("/packages/:scope/:name/versions/:version/yank", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");

  // Find the package
  const [pkg] = await db
    .select()
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  // Owner check
  if (pkg.ownerUserId !== user.id) {
    throw new AppError("not_owner", "Only the package owner can yank versions", 403);
  }

  // Find the version
  const [v] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.packageId, pkg.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) {
    throw new AppError("version_not_found", "Version not found", 404);
  }

  // Already yanked? Idempotent.
  if (v.yankedAt) {
    return c.json({ ok: true, alreadyYanked: true });
  }

  const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));

  await db
    .update(versions)
    .set({
      yankedAt: new Date(),
      yankedByUserId: user.id,
      yankedReason: body.reason ?? null,
    })
    .where(eq(versions.id, v.id));

  return c.json({ ok: true });
});

// POST /v1/packages/:scope/:name/versions/:version/unyank — reverse a yank (maintainer only)
app.post("/packages/:scope/:name/versions/:version/unyank", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");

  // Find the package
  const [pkg] = await db
    .select()
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  // TODO: maintainer role check — for now, only owner can unyank
  if (pkg.ownerUserId !== user.id) {
    throw new AppError("forbidden", "Only maintainers can unyank versions", 403);
  }

  const [v] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.packageId, pkg.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) {
    throw new AppError("version_not_found", "Version not found", 404);
  }

  if (!v.yankedAt) {
    return c.json({ ok: true, alreadyActive: true });
  }

  await db
    .update(versions)
    .set({
      yankedAt: null,
      yankedByUserId: null,
      yankedReason: null,
    })
    .where(eq(versions.id, v.id));

  return c.json({ ok: true });
});

export default app;
