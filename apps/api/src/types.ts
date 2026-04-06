import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema";
import type { AuthUser } from "./middleware/auth";

export type Bindings = {
  Database: D1Database;
  Tarballs: R2Bucket;
  RateLimit: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    user: AuthUser | null;
  };
};
