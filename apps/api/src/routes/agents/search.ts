import { Hono } from "hono";
import { eq, and, like, or, desc, asc, sql } from "drizzle-orm";
import { agents, agentTags } from "../../db/schema";
import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>();

// GET /agents
app.get("/", async (c) => {
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
      id: agents.id,
      scope: agents.scope,
      name: agents.name,
      displayName: agents.displayName,
      tagline: agents.tagline,
      category: agents.category,
      license: agents.license,
      downloadCount: agents.downloadCount,
      avgRating: agents.avgRating,
      reviewCount: agents.reviewCount,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
    })
    .from(agents)
    .$dynamic();

  const conditions = [];

  // Exclude agents where all versions are yanked
  conditions.push(
    sql`EXISTS (SELECT 1 FROM versions WHERE versions.agent_id = ${agents.id} AND versions.yanked_at IS NULL LIMIT 1)`
  );

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(agents.displayName, pattern),
        like(agents.tagline, pattern),
        like(agents.scope, pattern),
        like(agents.name, pattern)
      )
    );
  }

  if (category) conditions.push(eq(agents.category, category));
  if (scope) conditions.push(eq(agents.scope, scope));

  if (tag) {
    const taggedIds = db
      .select({ agentId: agentTags.agentId })
      .from(agentTags)
      .where(eq(agentTags.tag, tag));
    conditions.push(sql`${agents.id} IN (${taggedIds})`);
  }

  if (cursor) {
    try {
      const decoded = JSON.parse(atob(cursor));
      if (sort === "downloads")
        conditions.push(sql`${agents.downloadCount} < ${decoded.v}`);
      else if (sort === "rating")
        conditions.push(sql`${agents.avgRating} < ${decoded.v}`);
      else if (sort === "name")
        conditions.push(sql`${agents.displayName} > ${decoded.v}`);
      else conditions.push(sql`${agents.updatedAt} < ${decoded.v}`);
    } catch {
      // Invalid cursor
    }
  }

  if (conditions.length > 0) query = query.where(and(...conditions));

  if (sort === "downloads") query = query.orderBy(desc(agents.downloadCount));
  else if (sort === "rating") query = query.orderBy(desc(agents.avgRating));
  else if (sort === "name") query = query.orderBy(asc(agents.displayName));
  else query = query.orderBy(desc(agents.updatedAt));

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
    else
      v =
        last.updatedAt instanceof Date
          ? Math.floor(last.updatedAt.getTime() / 1000)
          : last.updatedAt;
    nextCursor = btoa(JSON.stringify({ v }));
  }

  return c.json({ items, ...(nextCursor ? { nextCursor } : {}) });
});

export default app;
