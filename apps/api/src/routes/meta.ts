import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import * as semver from "semver";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { agents, versions, categories, reports } from "../db/schema";
import { CATEGORIES } from "../db/seed";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// ── Health ─────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({ ok: true, version: "0.0.1" });
});

// ── Categories ─────────────────────────────────────────────

app.get("/categories", async (c) => {
  const db = c.var.db;

  let rows = await db
    .select()
    .from(categories)
    .orderBy(categories.sortOrder);

  if (rows.length === 0) {
    await db.insert(categories).values([...CATEGORIES]);
    rows = await db.select().from(categories).orderBy(categories.sortOrder);
  }

  return c.json(rows);
});

// ── Bulk update check ──────────────────────────────────────

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
    const idMatch = install.id.match(
      /^@([a-z0-9-]+)\/([a-z0-9][a-z0-9-]*[a-z0-9])$/
    );
    if (!idMatch) continue;
    const [, scope, name] = idMatch;

    const [agent] = await db
      .select({ id: agents.id, latestVersionId: agents.latestVersionId })
      .from(agents)
      .where(and(eq(agents.scope, scope), eq(agents.name, name)))
      .limit(1);

    if (!agent || !agent.latestVersionId) continue;

    const [latest] = await db
      .select({ version: versions.version, channel: versions.channel })
      .from(versions)
      .where(eq(versions.id, agent.latestVersionId))
      .limit(1);

    if (!latest) continue;

    const [installedVersion] = await db
      .select({ yankedAt: versions.yankedAt })
      .from(versions)
      .where(
        and(
          eq(versions.agentId, agent.id),
          eq(versions.version, install.version)
        )
      )
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

// ── Reports ────────────────────────────────────────────────

const VALID_REASONS = [
  "malicious",
  "trademark",
  "spam",
  "inappropriate",
  "other",
] as const;

app.post("/reports", async (c) => {
  const db = c.var.db;

  const body = await c.req.json<{
    agentId: string;
    versionId?: string;
    reason: string;
    details: string;
  }>();

  if (!body.agentId || !body.reason || !body.details) {
    throw new AppError(
      "missing_fields",
      "agentId, reason, and details are required",
      400
    );
  }

  if (!VALID_REASONS.includes(body.reason as any)) {
    throw new AppError(
      "invalid_reason",
      `Reason must be one of: ${VALID_REASONS.join(", ")}`,
      400
    );
  }

  if (body.details.length > 2000) {
    throw new AppError(
      "details_too_long",
      "Details must be 2000 characters or fewer",
      400
    );
  }

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, body.agentId))
    .limit(1);

  if (!agent) throw new AppError("agent_not_found", "Agent not found", 404);

  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for") ??
    "unknown";
  const ipData = new TextEncoder().encode(ip + ":clawstore-salt");
  const ipHashBuf = await crypto.subtle.digest("SHA-256", ipData);
  const ipHash = Array.from(new Uint8Array(ipHashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const user = c.var.user;
  const reportId = crypto.randomUUID();

  await db.insert(reports).values({
    id: reportId,
    agentId: body.agentId,
    versionId: body.versionId ?? null,
    reporterUserId: user?.id ?? null,
    reporterIpHash: ipHash,
    reason: body.reason,
    details: body.details.slice(0, 2000),
  });

  return c.json({ id: reportId }, 201);
});

app.get("/reports", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const status = c.req.query("status") ?? "open";
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);

  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(limit);

  return c.json({ items: rows });
});

app.post("/reports/:id/resolve", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const reportId = c.req.param("id");

  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) throw new AppError("report_not_found", "Report not found", 404);

  const body = await c.req.json<{
    status: "resolved" | "dismissed";
    notes?: string;
  }>();

  if (!["resolved", "dismissed"].includes(body.status)) {
    throw new AppError(
      "invalid_status",
      "Status must be 'resolved' or 'dismissed'",
      400
    );
  }

  await db
    .update(reports)
    .set({
      status: body.status,
      resolvedByUserId: user.id,
      resolvedAt: new Date(),
      resolutionNotes: body.notes ?? null,
    })
    .where(eq(reports.id, reportId));

  return c.json({ ok: true });
});

export default app;
