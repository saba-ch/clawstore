import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { AppError } from "../lib/errors";
import { packages, versions, versionAssets } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /v1/packages/:scope/:name/versions/:version/tarball — download tarball
app.get("/packages/:scope/:name/versions/:version/tarball", async (c) => {
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

  // Fetch from R2
  const object = await c.env.Tarballs.get(v.tarballR2Key);
  if (!object) {
    throw new AppError("tarball_not_found", "Tarball not found in storage", 404);
  }

  // Best-effort download count increment
  db.update(versions)
    .set({ downloadCount: sql`${versions.downloadCount} + 1` })
    .where(eq(versions.id, v.id))
    .then(() => {
      // Also bump package-level counter
      return db
        .update(packages)
        .set({ downloadCount: sql`${packages.downloadCount} + 1` })
        .where(eq(packages.id, pkg.id));
    })
    .catch(() => {
      // Best-effort, don't block the download
    });

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(v.tarballSizeBytes),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-SHA256": v.tarballSha256,
    },
  });
});

// GET /v1/packages/:scope/:name/versions/:version/assets/:path — serve an extracted asset
app.get("/packages/:scope/:name/versions/:version/assets/*", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");
  // Extract the asset path from the URL after /assets/
  const url = new URL(c.req.url);
  const prefix = `/v1/packages/${scope}/${name}/versions/${ver}/assets/`;
  const assetPath = url.pathname.slice(prefix.length);

  if (!assetPath) {
    throw new AppError("missing_path", "Asset path is required", 400);
  }

  const [pkg] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  const [v] = await db
    .select({ id: versions.id })
    .from(versions)
    .where(and(eq(versions.packageId, pkg.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) {
    throw new AppError("version_not_found", "Version not found", 404);
  }

  const [asset] = await db
    .select()
    .from(versionAssets)
    .where(and(eq(versionAssets.versionId, v.id), eq(versionAssets.path, assetPath)))
    .limit(1);

  if (!asset) {
    throw new AppError("asset_not_found", "Asset not found", 404);
  }

  const object = await c.env.Tarballs.get(asset.r2Key);
  if (!object) {
    throw new AppError("asset_not_found", "Asset not found in storage", 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.sizeBytes),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

export default app;
