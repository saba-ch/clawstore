import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "./db/schema";

export type Bindings = {
  Database: D1Database;
  Tarballs: R2Bucket;
  RateLimit: KVNamespace;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    db: DrizzleD1Database<typeof schema>;
  };
};
