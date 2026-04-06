import { Hono } from "hono";
import { eq, and, desc, sql, avg, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { packages, reviews, profiles } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// GET /v1/packages/:scope/:name/reviews — list reviews
app.get("/packages/:scope/:name/reviews", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
  const cursor = c.req.query("cursor");

  const [pkg] = await db
    .select({ id: packages.id, avgRating: packages.avgRating, reviewCount: packages.reviewCount })
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (!pkg) {
    throw new AppError("package_not_found", "Package not found", 404);
  }

  const conditions = [eq(reviews.packageId, pkg.id)];
  if (cursor) {
    try {
      const decoded = JSON.parse(atob(cursor));
      conditions.push(sql`${reviews.createdAt} < ${decoded.v}`);
    } catch {
      // Invalid cursor
    }
  }

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      reviewer: {
        githubLogin: profiles.githubLogin,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
      },
    })
    .from(reviews)
    .leftJoin(profiles, eq(profiles.userId, reviews.reviewerUserId))
    .where(and(...conditions))
    .orderBy(desc(reviews.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | undefined;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    const v = last.createdAt instanceof Date ? Math.floor(last.createdAt.getTime() / 1000) : last.createdAt;
    nextCursor = btoa(JSON.stringify({ v }));
  }

  return c.json({
    items,
    avgRating: pkg.avgRating,
    reviewCount: pkg.reviewCount,
    ...(nextCursor ? { nextCursor } : {}),
  });
});

// POST /v1/packages/:scope/:name/reviews — create a review
app.post("/packages/:scope/:name/reviews", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

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

  // Authors cannot review their own packages
  if (pkg.ownerUserId === user.id) {
    throw new AppError("self_review", "You cannot review your own package", 403);
  }

  // Check for existing review
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.packageId, pkg.id), eq(reviews.reviewerUserId, user.id)))
    .limit(1);

  if (existing) {
    throw new AppError("already_reviewed", "You have already reviewed this package", 409);
  }

  const body = await c.req.json<{
    rating: number;
    title?: string;
    body?: string;
  }>();

  if (!body.rating || body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
    throw new AppError("invalid_rating", "Rating must be an integer between 1 and 5", 400);
  }

  const reviewId = crypto.randomUUID();
  await db.insert(reviews).values({
    id: reviewId,
    packageId: pkg.id,
    reviewerUserId: user.id,
    rating: body.rating,
    title: body.title?.slice(0, 120) ?? null,
    body: body.body?.slice(0, 2000) ?? null,
  });

  await refreshReviewStats(db, pkg.id);

  return c.json({ id: reviewId }, 201);
});

// PUT /v1/packages/:scope/:name/reviews/:id — update own review
app.put("/packages/:scope/:name/reviews/:id", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const reviewId = c.req.param("id");

  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) {
    throw new AppError("review_not_found", "Review not found", 404);
  }

  if (review.reviewerUserId !== user.id) {
    throw new AppError("forbidden", "You can only update your own reviews", 403);
  }

  const body = await c.req.json<{
    rating?: number;
    title?: string;
    body?: string;
  }>();

  if (body.rating !== undefined && (body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating))) {
    throw new AppError("invalid_rating", "Rating must be an integer between 1 and 5", 400);
  }

  await db
    .update(reviews)
    .set({
      ...(body.rating !== undefined && { rating: body.rating }),
      ...(body.title !== undefined && { title: body.title.slice(0, 120) }),
      ...(body.body !== undefined && { body: body.body.slice(0, 2000) }),
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, reviewId));

  await refreshReviewStats(db, review.packageId);

  return c.json({ ok: true });
});

// DELETE /v1/packages/:scope/:name/reviews/:id — delete own review
app.delete("/packages/:scope/:name/reviews/:id", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const reviewId = c.req.param("id");

  const [review] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!review) {
    throw new AppError("review_not_found", "Review not found", 404);
  }

  // Allow own review deletion, or maintainer (TODO: maintainer role)
  if (review.reviewerUserId !== user.id) {
    throw new AppError("forbidden", "You can only delete your own reviews", 403);
  }

  await db.delete(reviews).where(eq(reviews.id, reviewId));
  await refreshReviewStats(db, review.packageId);

  return c.json({ ok: true });
});

/** Recalculate avg_rating and review_count on the packages row. */
async function refreshReviewStats(db: any, packageId: string) {
  const [stats] = await db
    .select({
      avgRating: avg(reviews.rating),
      reviewCount: count(),
    })
    .from(reviews)
    .where(eq(reviews.packageId, packageId));

  await db
    .update(packages)
    .set({
      avgRating: stats?.avgRating ? Number(stats.avgRating) : null,
      reviewCount: stats?.reviewCount ?? 0,
    })
    .where(eq(packages.id, packageId));
}

export default app;
