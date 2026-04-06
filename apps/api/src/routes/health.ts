import { Hono } from "hono";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/health", (c) => {
  return c.json({ ok: true, version: "0.0.1" });
});

export default app;
