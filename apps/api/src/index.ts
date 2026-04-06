import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import { errorHandler } from "./middleware/error";
import healthRoutes from "./routes/health";
import categoryRoutes from "./routes/categories";
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

// Routes
app.route("/v1", healthRoutes);
app.route("/v1", categoryRoutes);

export default app;
