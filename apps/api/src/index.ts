import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import { createAuth } from "./auth";
import { errorHandler } from "./middleware/error";
import { resolveUser } from "./middleware/auth";
import agentRoutes from "./routes/agents";
import userRoutes from "./routes/users";
import metaRoutes from "./routes/meta";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.onError(errorHandler);

app.use("*", async (c, next) => {
  const defaultOrigins = ["https://useclawstore.com", "http://localhost:3000"];
  const origins = c.env.CORS_ORIGINS
    ? c.env.CORS_ORIGINS.split(",").map((o: string) => o.trim())
    : defaultOrigins;
  const mw = cors({ origin: origins, credentials: true });
  return mw(c, next);
});

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.Database));
  await next();
});

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const baseURL = new URL(c.req.url).origin;
  const auth = createAuth(c.env, baseURL);
  return auth.handler(c.req.raw);
});

app.use("/v1/*", resolveUser);

app.route("/v1/agents", agentRoutes);
app.route("/v1", userRoutes);
app.route("/v1", metaRoutes);

export default app;
