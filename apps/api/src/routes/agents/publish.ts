import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import * as semver from "semver";
import { validateManifestSchema, type AgentManifest } from "@clawstore/schema";
import { requireAuth } from "../../middleware/auth";
import { AppError } from "../../lib/errors";
import { agents, versions, agentTags, versionAssets, profiles } from "../../db/schema";
import type { AppEnv } from "../../types";

const app = new Hono<AppEnv>();

// POST /agents/publish
app.post("/publish", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;
  const formData = await c.req.formData();
  const metadataRaw = formData.get("metadata");
  const tarball = formData.get("tarball");

  if (!metadataRaw || typeof metadataRaw !== "string") {
    throw new AppError("missing_metadata", "Missing metadata JSON part", 400);
  }
  if (!tarball || typeof tarball === "string") {
    throw new AppError("missing_tarball", "Missing tarball file part", 400);
  }
  const tarballFile = tarball as unknown as {
    arrayBuffer(): Promise<ArrayBuffer>;
  };

  // Parse and validate manifest
  let manifest: AgentManifest;
  try {
    const parsed = JSON.parse(metadataRaw);
    const result = validateManifestSchema(parsed);
    if (!result.valid) {
      throw new AppError("invalid_manifest", "Manifest validation failed", 422, {
        errors: result.errors,
      });
    }
    manifest = parsed as AgentManifest;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("invalid_metadata", "Could not parse metadata JSON", 400);
  }

  // Extract scope/name from @scope/name
  const idMatch = manifest.id.match(
    /^@([a-z0-9-]+)\/([a-z0-9][a-z0-9-]*[a-z0-9])$/
  );
  if (!idMatch) {
    throw new AppError("invalid_id", "Invalid package ID format", 400);
  }
  const [, scope, name] = idMatch;

  // Verify scope matches user's GitHub login
  const [profile] = await db
    .select({ githubLogin: profiles.githubLogin })
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  if (!profile || profile.githubLogin !== scope) {
    throw new AppError(
      "scope_mismatch",
      `Package scope "@${scope}" does not match your GitHub username "@${profile?.githubLogin ?? "unknown"}"`,
      403
    );
  }

  // Ownership check
  const [existing] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.scope, scope), eq(agents.name, name)))
    .limit(1);

  if (existing && existing.ownerUserId !== user.id) {
    throw new AppError("not_owner", "You are not the owner of this agent", 403);
  }

  // Version monotonicity
  if (existing) {
    const [latestVersion] = await db
      .select({ version: versions.version })
      .from(versions)
      .where(eq(versions.agentId, existing.id))
      .orderBy(desc(versions.uploadedAt))
      .limit(1);

    if (latestVersion && !semver.gt(manifest.version, latestVersion.version)) {
      throw new AppError(
        "version_not_monotonic",
        `Version ${manifest.version} is not greater than the current published ${latestVersion.version}`,
        409,
        {
          id: manifest.id,
          current: latestVersion.version,
          requested: manifest.version,
        }
      );
    }
  }

  // Read tarball
  const tarballBuffer = await tarballFile.arrayBuffer();
  const tarballBytes = new Uint8Array(tarballBuffer);
  const tarballSize = tarballBytes.byteLength;

  if (tarballSize > 100 * 1024 * 1024) {
    throw new AppError(
      "tarball_too_large",
      "Tarball exceeds the 100 MB size limit",
      413
    );
  }

  // SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", tarballBytes);
  const tarballSha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const isPrerelease = semver.prerelease(manifest.version) !== null;
  const channel = isPrerelease ? "beta" : "community";
  const agentId = existing?.id ?? crypto.randomUUID();
  const versionId = crypto.randomUUID();

  // Upload tarball to R2
  const r2Key = `tarballs/${scope}/${name}/${manifest.version}.tgz`;
  await c.env.Tarballs.put(r2Key, tarballBytes, {
    httpMetadata: {
      contentType: "application/gzip",
      cacheControl: "public, max-age=31536000, immutable",
    },
    sha256: tarballSha256,
  });

  // Upload store assets to R2 and collect metadata (DB insert happens after version row)
  const pendingAssets: Array<{
    kind: string;
    r2Key: string;
    contentType: string;
    sizeBytes: number;
    sha256: string;
  }> = [];

  for (const [key, value] of formData.entries()) {
    if (key === "metadata" || key === "tarball") continue;
    if (typeof value === "string") continue;

    const file = value as File;
    const kind = key === "icon" ? "icon" : "screenshot";
    const assetBytes = new Uint8Array(await file.arrayBuffer());
    const assetHashBuf = await crypto.subtle.digest("SHA-256", assetBytes);
    const assetHash = Array.from(new Uint8Array(assetHashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const assetR2Key = `assets/${scope}/${name}/${manifest.version}/${key}`;

    await c.env.Tarballs.put(assetR2Key, assetBytes, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    pendingAssets.push({
      kind,
      r2Key: assetR2Key,
      contentType: file.type || "application/octet-stream",
      sizeBytes: assetBytes.byteLength,
      sha256: assetHash,
    });
  }

  // Persist agent (without latestVersionId — version row doesn't exist yet)
  if (!existing) {
    await db.insert(agents).values({
      id: agentId,
      scope,
      name,
      ownerUserId: user.id,
      category: manifest.category,
      description: manifest.description,
      tagline: manifest.tagline,
      displayName: manifest.name,
      homepage: manifest.homepage ?? null,
      repository: manifest.repository ?? null,
      license: manifest.license,
    });
  }

  // Insert version row
  await db.insert(versions).values({
    id: versionId,
    agentId,
    version: manifest.version,
    channel,
    manifest: JSON.stringify(manifest),
    tarballR2Key: r2Key,
    tarballSha256,
    tarballSizeBytes: tarballSize,
    uploadedByUserId: user.id,
  });

  // Now update agent metadata + latestVersionId (version row exists)
  await db
    .update(agents)
    .set({
      ...(!isPrerelease ? { latestVersionId: versionId } : {}),
      category: manifest.category,
      description: manifest.description,
      tagline: manifest.tagline,
      displayName: manifest.name,
      homepage: manifest.homepage ?? null,
      repository: manifest.repository ?? null,
      license: manifest.license,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  // Insert asset metadata (version row exists now)
  for (let i = 0; i < pendingAssets.length; i++) {
    const asset = pendingAssets[i];
    await db.insert(versionAssets).values({
      id: crypto.randomUUID(),
      versionId,
      kind: asset.kind,
      r2Key: asset.r2Key,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      sha256: asset.sha256,
      ordering: asset.kind === "icon" ? 0 : i + 1,
    });
  }

  // Update tags
  await db.delete(agentTags).where(eq(agentTags.agentId, agentId));
  if (manifest.tags.length > 0) {
    await db.insert(agentTags).values(
      manifest.tags.map((tag) => ({ agentId, tag: tag.toLowerCase() }))
    );
  }

  return c.json({
    id: manifest.id,
    version: manifest.version,
    agentId,
    versionId,
    channel,
    tarballSha256,
    tarballSizeBytes: tarballSize,
  });
});

export default app;
