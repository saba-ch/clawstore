import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import { createAuth } from "./auth";
import { errorHandler } from "./middleware/error";
import { resolveUser } from "./middleware/auth";
import healthRoutes from "./routes/health";
import categoryRoutes from "./routes/categories";
import meRoutes from "./routes/me";
import userRoutes from "./routes/users";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

// Global error handler
app.onError(errorHandler);

// CORS
app.use(
  "*",
  cors({
    origin: ["https://useclawstore.com", "http://localhost:3000"],
    credentials: true,
  })
);

// Inject Drizzle DB into context
app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.Database));
  await next();
});

// Better Auth routes (GitHub OAuth, sessions)
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const baseURL = new URL(c.req.url).origin;
  const auth = createAuth(c.env, baseURL);
  return auth.handler(c.req.raw);
});

// Resolve current user (session cookie or bearer token) for all /v1/* routes
app.use("/v1/*", resolveUser);

// Routes
app.route("/v1", healthRoutes);
app.route("/v1", categoryRoutes);
app.route("/v1", meRoutes);
app.route("/v1", userRoutes);

export default app;
