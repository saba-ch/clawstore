import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./db/auth-schema";
import type { Bindings } from "./types";

export function createAuth(env: Bindings, baseURL: string) {
  const db = drizzle(env.Database, { schema: authSchema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      usePlural: true,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [
      "https://useclawstore.com",
      "http://localhost:3000",
    ],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh every 24h
      cookieCache: {
        enabled: false, // disabled — see better-auth-cloudflare known issues
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
