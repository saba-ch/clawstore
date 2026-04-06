import { Hono } from "hono";
import { eq, and, like, or, desc, asc, sql } from "drizzle-orm";
import { packages, versions, packageTags, profiles } from "../db/schema";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /v1/packages — list or search packages
app.get("/packages", async (c) => {
  const db = c.var.db;
  const q = c.req.query("q");
  const category = c.req.query("category");
  const tag = c.req.query("tag");
  const scope = c.req.query("scope");
  const sort = c.req.query("sort") ?? "recent";
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
  const cursor = c.req.query("cursor");

  let query = db
    .select({
      id: packages.id,
      scope: packages.scope,
      name: packages.name,
      displayName: packages.displayName,
      tagline: packages.tagline,
      category: packages.category,
      license: packages.license,
      downloadCount: packages.downloadCount,
      avgRating: packages.avgRating,
      reviewCount: packages.reviewCount,
      createdAt: packages.createdAt,
      updatedAt: packages.updatedAt,
    })
    .from(packages)
    .$dynamic();

  const conditions = [];

  // Search
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(packages.displayName, pattern),
        like(packages.tagline, pattern),
        like(packages.scope, pattern),
        like(packages.name, pattern)
      )
    );
  }

  // Filters
  if (category) conditions.push(eq(packages.category, category));
  if (scope) conditions.push(eq(packages.scope, scope));

  // Tag filter requires a subquery
  if (tag) {
    const taggedIds = db
      .select({ packageId: packageTags.packageId })
      .from(packageTags)
      .where(eq(packageTags.tag, tag));
    conditions.push(sql`${packages.id} IN (${taggedIds})`);
  }

  // Cursor-based pagination (using updatedAt or the sort key)
  if (cursor) {
    try {
      const decoded = JSON.parse(atob(cursor));
      if (sort === "downloads") {
        conditions.push(sql`${packages.downloadCount} < ${decoded.v}`);
      } else if (sort === "rating") {
        conditions.push(sql`${packages.avgRating} < ${decoded.v}`);
      } else if (sort === "name") {
        conditions.push(sql`${packages.displayName} > ${decoded.v}`);
      } else {
        conditions.push(sql`${packages.updatedAt} < ${decoded.v}`);
      }
    } catch {
      // Invalid cursor, ignore
    }
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // Sort
  if (sort === "downloads") {
    query = query.orderBy(desc(packages.downloadCount));
  } else if (sort === "rating") {
    query = query.orderBy(desc(packages.avgRating));
  } else if (sort === "name") {
    query = query.orderBy(asc(packages.displayName));
  } else {
    query = query.orderBy(desc(packages.updatedAt));
  }

  const rows = await query.limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | undefined;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    let v: unknown;
    if (sort === "downloads") v = last.downloadCount;
    else if (sort === "rating") v = last.avgRating;
    else if (sort === "name") v = last.displayName;
    else v = last.updatedAt instanceof Date ? Math.floor(last.updatedAt.getTime() / 1000) : last.updatedAt;
    nextCursor = btoa(JSON.stringify({ v }));
  }

  return c.json({ items, ...(nextCursor ? { nextCursor } : {}) });
});

// GET /v1/packages/:scope/:name — package detail
app.get("/packages/:scope/:name", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();

  const [pkg] = await db
    .select()
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  // Fetch tags
  const tags = await db
    .select({ tag: packageTags.tag })
    .from(packageTags)
    .where(eq(packageTags.packageId, pkg.id));

  // Fetch latest version manifest
  let latestVersion = null;
  if (pkg.latestVersionId) {
    const [v] = await db
      .select()
      .from(versions)
      .where(eq(versions.id, pkg.latestVersionId))
      .limit(1);
    if (v) {
      latestVersion = {
        id: v.id,
        version: v.version,
        channel: v.channel,
        manifest: JSON.parse(v.manifest),
        tarballSha256: v.tarballSha256,
        tarballSizeBytes: v.tarballSizeBytes,
        downloadCount: v.downloadCount,
        uploadedAt: v.uploadedAt,
        yankedAt: v.yankedAt,
      };
    }
  }

  // Fetch owner profile
  const [owner] = await db
    .select({
      githubLogin: profiles.githubLogin,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(eq(profiles.userId, pkg.ownerUserId))
    .limit(1);

  return c.json({
    id: pkg.id,
    scope: pkg.scope,
    name: pkg.name,
    displayName: pkg.displayName,
    tagline: pkg.tagline,
    description: pkg.description,
    category: pkg.category,
    homepage: pkg.homepage,
    repository: pkg.repository,
    license: pkg.license,
    downloadCount: pkg.downloadCount,
    avgRating: pkg.avgRating,
    reviewCount: pkg.reviewCount,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
    tags: tags.map((t) => t.tag),
    latestVersion,
    owner: owner ?? null,
  });
});

// GET /v1/packages/:scope/:name/versions — version history
app.get("/packages/:scope/:name/versions", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
  const cursor = c.req.query("cursor");

  const [pkg] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  const conditions = [eq(versions.packageId, pkg.id)];
  if (cursor) {
    try {
      const decoded = JSON.parse(atob(cursor));
      conditions.push(sql`${versions.uploadedAt} < ${decoded.v}`);
    } catch {
      // Invalid cursor
    }
  }

  const rows = await db
    .select({
      id: versions.id,
      version: versions.version,
      channel: versions.channel,
      tarballSizeBytes: versions.tarballSizeBytes,
      downloadCount: versions.downloadCount,
      uploadedAt: versions.uploadedAt,
      yankedAt: versions.yankedAt,
      yankedReason: versions.yankedReason,
    })
    .from(versions)
    .where(and(...conditions))
    .orderBy(desc(versions.uploadedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | undefined;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    const v = last.uploadedAt instanceof Date ? Math.floor(last.uploadedAt.getTime() / 1000) : last.uploadedAt;
    nextCursor = btoa(JSON.stringify({ v }));
  }

  return c.json({ items, ...(nextCursor ? { nextCursor } : {}) });
});

// GET /v1/packages/:scope/:name/versions/:version — specific version detail
app.get("/packages/:scope/:name/versions/:version", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");

  const [pkg] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  const [v] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.packageId, pkg.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) {
    throw new AppError("version_not_found", "Version not found", 404);
  }

  return c.json({
    id: v.id,
    version: v.version,
    channel: v.channel,
    manifest: JSON.parse(v.manifest),
    tarballSha256: v.tarballSha256,
    tarballSizeBytes: v.tarballSizeBytes,
    downloadCount: v.downloadCount,
    uploadedByUserId: v.uploadedByUserId,
    uploadedAt: v.uploadedAt,
    yankedAt: v.yankedAt,
    yankedByUserId: v.yankedByUserId,
    yankedReason: v.yankedReason,
  });
});

export default app;
