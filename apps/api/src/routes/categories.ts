import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { categories } from "../db/schema";
import { CATEGORIES } from "../db/seed";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/categories", async (c) => {
  const db = c.var.db;

  let rows = await db
    .select()
    .from(categories)
    .orderBy(categories.sortOrder);

  // Auto-seed on first request if table is empty
  if (rows.length === 0) {
    await db.insert(categories).values([...CATEGORIES]);
    rows = await db
      .select()
      .from(categories)
      .orderBy(categories.sortOrder);
  }

  return c.json(rows);
});

export default app;
