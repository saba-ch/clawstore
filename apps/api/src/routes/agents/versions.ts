import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../../middleware/auth";
import { AppError } from "../../lib/errors";
import { agents, versions, versionAssets } from "../../db/schema";
import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>();

// GET /agents/:scope/:name/versions
app.get("/:scope/:name/versions", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
  const cursor = c.req.query("cursor");

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.scope, scope), eq(agents.name, name)))
    .limit(1);

  if (!agent) throw new AppError("agent_not_found", "Agent not found", 404);

  const conditions = [eq(versions.agentId, agent.id)];
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
    const v =
      last.uploadedAt instanceof Date
        ? Math.floor(last.uploadedAt.getTime() / 1000)
        : last.uploadedAt;
    nextCursor = btoa(JSON.stringify({ v }));
  }

  return c.json({ items, ...(nextCursor ? { nextCursor } : {}) });
});

// GET /agents/:scope/:name/versions/:version
app.get("/:scope/:name/versions/:version", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.scope, scope), eq(agents.name, name)))
    .limit(1);

  if (!agent) throw new AppError("agent_not_found", "Agent not found", 404);

  const [v] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.agentId, agent.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) throw new AppError("version_not_found", "Version not found", 404);

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

// GET /agents/:scope/:name/versions/:version/tarball
app.get("/:scope/:name/versions/:version/tarball", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.scope, scope), eq(agents.name, name)))
    .limit(1);

  if (!agent) throw new AppError("agent_not_found", "Agent not found", 404);

  const [v] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.agentId, agent.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) throw new AppError("version_not_found", "Version not found", 404);

  const object = await c.env.Tarballs.get(v.tarballR2Key);
  if (!object) {
    throw new AppError("tarball_not_found", "Tarball not found in storage", 404);
  }

  // Best-effort download count increment
  db.update(versions)
    .set({ downloadCount: sql`${versions.downloadCount} + 1` })
    .where(eq(versions.id, v.id))
    .then(() =>
      db
        .update(agents)
        .set({ downloadCount: sql`${agents.downloadCount} + 1` })
        .where(eq(agents.id, agent.id))
    )
    .catch(() => {});

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(v.tarballSizeBytes),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-SHA256": v.tarballSha256,
    },
  });
});

// GET /agents/:scope/:name/versions/:version/assets/:assetId
app.get("/:scope/:name/versions/:version/assets/:assetId", async (c) => {
  const db = c.var.db;
  const assetId = c.req.param("assetId");

  const [asset] = await db
    .select()
    .from(versionAssets)
    .where(eq(versionAssets.id, assetId))
    .limit(1);

  if (!asset) throw new AppError("asset_not_found", "Asset not found", 404);

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

// POST /agents/:scope/:name/versions/:version/yank
app.post("/:scope/:name/versions/:version/yank", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.scope, scope), eq(agents.name, name)))
    .limit(1);

  if (!agent) throw new AppError("agent_not_found", "Agent not found", 404);

  if (agent.ownerUserId !== user.id) {
    throw new AppError("not_owner", "Only the agent owner can yank versions", 403);
  }

  const [v] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.agentId, agent.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) throw new AppError("version_not_found", "Version not found", 404);

  if (v.yankedAt) return c.json({ ok: true, alreadyYanked: true });

  const body = await c.req
    .json<{ reason?: string }>()
    .catch(() => ({ reason: undefined }));

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

// POST /agents/:scope/:name/versions/:version/unyank
app.post("/:scope/:name/versions/:version/unyank", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const ver = c.req.param("version");

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.scope, scope), eq(agents.name, name)))
    .limit(1);

  if (!agent) throw new AppError("agent_not_found", "Agent not found", 404);

  if (agent.ownerUserId !== user.id) {
    throw new AppError("forbidden", "Only maintainers can unyank versions", 403);
  }

  const [v] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.agentId, agent.id), eq(versions.version, ver)))
    .limit(1);

  if (!v) throw new AppError("version_not_found", "Version not found", 404);

  if (!v.yankedAt) return c.json({ ok: true, alreadyActive: true });

  await db
    .update(versions)
    .set({ yankedAt: null, yankedByUserId: null, yankedReason: null })
    .where(eq(versions.id, v.id));

  return c.json({ ok: true });
});

export default app;
