import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import { createAuth } from "./auth";
import { errorHandler } from "./middleware/error";
import { resolveUser } from "./middleware/auth";
import agentRoutes from "./routes/agents";
import userRoutes from "./routes/users";
import metaRoutes from "./routes/meta";
import deviceRoutes from "./routes/device";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.onError(errorHandler);

app.use(
  "*",
  cors({
    origin: ["https://useclawstore.com", "http://localhost:3000"],
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.Database));
  await next();
});

app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const baseURL = new URL(c.req.url).origin;
  const auth = createAuth(c.env, baseURL);
  return auth.handler(c.req.raw);
});

// Device authorization approval page (served before auth middleware)
app.route("/", deviceRoutes);

app.use("/v1/*", resolveUser);

app.route("/v1/agents", agentRoutes);
app.route("/v1", userRoutes);
app.route("/v1", metaRoutes);

export default app;
