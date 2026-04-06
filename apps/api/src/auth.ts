import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as authSchema from "./db/auth-schema";
import { profiles } from "./db/schema";
import type { Bindings } from "./types";

export function createAuth(env: Bindings, baseURL: string) {
  const authDb = drizzle(env.Database, { schema: authSchema });
  const appDb = drizzle(env.Database);

  return betterAuth({
    database: drizzleAdapter(authDb, {
      provider: "sqlite",
      usePlural: true,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [
      "https://useclawstore.com",
      "http://localhost:3000",
      "http://localhost:8787",
    ],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        mapProfileToUser: (profile) => {
          return {
            name: profile.name ?? profile.login,
            image: profile.avatar_url,
            // Store GitHub login in a place we can retrieve in the after hook
            // Better Auth stores it in accounts.accountId but we also want it on user
          };
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: false,
      },
    },
    experimental: {
      joins: true,
    },
    databaseHooks: {
      account: {
        create: {
          after: async (account) => {
            // When a GitHub account is linked, create the profile if it doesn't exist
            if (account.providerId !== "github") return;

            const githubLogin = (account.accountId ?? "").toLowerCase();
            if (!githubLogin) return;

            // Check if profile already exists
            const [existing] = await appDb
              .select()
              .from(profiles)
              .where(eq(profiles.userId, account.userId))
              .limit(1);

            if (existing) return;

            // Create profile from the account data
            await appDb.insert(profiles).values({
              userId: account.userId,
              githubLogin,
              avatarUrl: null,
              displayName: null,
            });
          },
        },
      },
    },
    plugins: [
      bearer(),
      deviceAuthorization({
        verificationUri: "http://localhost:3000/device",
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
