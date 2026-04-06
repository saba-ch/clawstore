import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { AppError } from "../../lib/errors";
import { agents, versions, agentTags, profiles } from "../../db/schema";
import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>();

// GET /agents/:scope/:name
app.get("/:scope/:name", async (c) => {
  const db = c.var.db;
  const scope = c.req.param("scope").toLowerCase();
  const name = c.req.param("name").toLowerCase();

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.scope, scope), eq(agents.name, name)))
    .limit(1);

  if (!agent) throw new AppError("agent_not_found", "Agent not found", 404);

  const tags = await db
    .select({ tag: agentTags.tag })
    .from(agentTags)
    .where(eq(agentTags.agentId, agent.id));

  let latestVersion = null;
  if (agent.latestVersionId) {
    const [v] = await db
      .select()
      .from(versions)
      .where(eq(versions.id, agent.latestVersionId))
      .limit(1);
    if (v) {
      latestVersion = {
        id: v.id,
        version: v.version,
        channel: v.channel,
        manifest: JSON.parse(v.manifest),
        tarballSha256: v.tarballSha256,
        tarballSizeBytes: v.tarballSizeBytes,
        downloadCount: v.downloadCount,
        uploadedAt: v.uploadedAt,
        yankedAt: v.yankedAt,
      };
    }
  }

  const [owner] = await db
    .select({
      githubLogin: profiles.githubLogin,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(eq(profiles.userId, agent.ownerUserId))
    .limit(1);

  return c.json({
    id: agent.id,
    scope: agent.scope,
    name: agent.name,
    displayName: agent.displayName,
    tagline: agent.tagline,
    description: agent.description,
    category: agent.category,
    homepage: agent.homepage,
    repository: agent.repository,
    license: agent.license,
    downloadCount: agent.downloadCount,
    avgRating: agent.avgRating,
    reviewCount: agent.reviewCount,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    tags: tags.map((t) => t.tag),
    latestVersion,
    owner: owner ?? null,
  });
});

export default app;
