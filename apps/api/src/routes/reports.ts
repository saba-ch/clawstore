import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { reports, packages } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const VALID_REASONS = ["malicious", "trademark", "spam", "inappropriate", "other"] as const;

// POST /v1/reports — file a report
app.post("/reports", async (c) => {
  const db = c.var.db;

  const body = await c.req.json<{
    packageId: string;
    versionId?: string;
    reason: string;
    details: string;
  }>();

  if (!body.packageId || !body.reason || !body.details) {
    throw new AppError("missing_fields", "packageId, reason, and details are required", 400);
  }

  if (!VALID_REASONS.includes(body.reason as any)) {
    throw new AppError("invalid_reason", `Reason must be one of: ${VALID_REASONS.join(", ")}`, 400);
  }

  if (body.details.length > 2000) {
    throw new AppError("details_too_long", "Details must be 2000 characters or fewer", 400);
  }

  // Verify the package exists
  const [pkg] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(eq(packages.id, body.packageId))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  // Hash the reporter's IP for rate limiting
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const ipHash = await hashIp(ip);

  // Optionally resolve authenticated user
  const user = c.var.user;

  const reportId = crypto.randomUUID();
  await db.insert(reports).values({
    id: reportId,
    packageId: body.packageId,
    versionId: body.versionId ?? null,
    reporterUserId: user?.id ?? null,
    reporterIpHash: ipHash,
    reason: body.reason,
    details: body.details.slice(0, 2000),
  });

  return c.json({ id: reportId }, 201);
});

// GET /v1/reports — list pending reports (maintainer only)
app.get("/reports", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  // TODO: proper maintainer role check
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

// POST /v1/reports/:id/resolve — resolve a report (maintainer only)
app.post("/reports/:id/resolve", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  // TODO: proper maintainer role check
  const db = c.var.db;
  const reportId = c.req.param("id");

  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) {
    throw new AppError("report_not_found", "Report not found", 404);
  }

  const body = await c.req.json<{
    status: "resolved" | "dismissed";
    notes?: string;
  }>();

  if (!["resolved", "dismissed"].includes(body.status)) {
    throw new AppError("invalid_status", "Status must be 'resolved' or 'dismissed'", 400);
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

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + ":clawstore-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default app;
