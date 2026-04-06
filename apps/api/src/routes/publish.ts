import { Hono } from "hono";
import { eq, and, desc, isNull } from "drizzle-orm";
import * as semver from "semver";
import { validateManifestSchema, type AgentManifest } from "@clawstore/schema";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { packages, versions, packageTags, versionAssets, profiles } from "../db/schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// POST /v1/publish — authenticated tarball upload
app.post("/publish", async (c) => {
  const user = requireAuth(c);
  if (!("id" in user)) return user;

  const db = c.var.db;

  // Parse multipart form data
  const formData = await c.req.formData();
  const metadataRaw = formData.get("metadata");
  const tarball = formData.get("tarball");

  if (!metadataRaw || typeof metadataRaw !== "string") {
    throw new AppError("missing_metadata", "Missing metadata JSON part", 400);
  }
  if (!tarball || typeof tarball === "string") {
    throw new AppError("missing_tarball", "Missing tarball file part", 400);
  }
  const tarballFile = tarball as unknown as { arrayBuffer(): Promise<ArrayBuffer> };

  // Parse and validate the manifest metadata
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

  // Extract scope and name from the manifest id (@scope/name)
  const idMatch = manifest.id.match(/^@([a-z0-9-]+)\/([a-z0-9][a-z0-9-]*[a-z0-9])$/);
  if (!idMatch) {
    throw new AppError("invalid_id", "Invalid package ID format", 400);
  }
  const [, scope, name] = idMatch;

  // Verify scope matches the user's GitHub login
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

  // Check ownership: if the package exists, verify the caller is the owner
  const [existingPkg] = await db
    .select()
    .from(packages)
    .where(and(eq(packages.scope, scope), eq(packages.name, name)))
    .limit(1);

  if (existingPkg && existingPkg.ownerUserId !== user.id) {
    throw new AppError(
      "not_owner",
      "You are not the owner of this package",
      403
    );
  }

  // Version monotonicity: new version must be strictly greater
  if (existingPkg) {
    const [latestVersion] = await db
      .select({ version: versions.version })
      .from(versions)
      .where(eq(versions.packageId, existingPkg.id))
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

  // Read the tarball
  const tarballBuffer = await tarballFile.arrayBuffer();
  const tarballBytes = new Uint8Array(tarballBuffer);
  const tarballSize = tarballBytes.byteLength;

  // Size check
  if (tarballSize > 100 * 1024 * 1024) {
    throw new AppError(
      "tarball_too_large",
      "Tarball exceeds the 100 MB size limit",
      413
    );
  }

  // Compute SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", tarballBytes);
  const tarballSha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Determine channel
  const isPrerelease = semver.prerelease(manifest.version) !== null;
  const channel = isPrerelease ? "beta" : "community";

  // Generate IDs
  const packageId = existingPkg?.id ?? crypto.randomUUID();
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

  // Persist to database
  if (!existingPkg) {
    // Create new package
    await db.insert(packages).values({
      id: packageId,
      scope,
      name,
      ownerUserId: user.id,
      latestVersionId: isPrerelease ? null : versionId,
      category: manifest.category,
      description: manifest.description,
      tagline: manifest.tagline,
      displayName: manifest.name,
      homepage: manifest.homepage ?? null,
      repository: manifest.repository ?? null,
      license: manifest.license,
    });
  } else {
    // Update existing package metadata from the new version
    await db
      .update(packages)
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
      .where(eq(packages.id, existingPkg.id));
  }

  // Insert version row
  await db.insert(versions).values({
    id: versionId,
    packageId,
    version: manifest.version,
    channel,
    manifest: JSON.stringify(manifest),
    tarballR2Key: r2Key,
    tarballSha256,
    tarballSizeBytes: tarballSize,
    uploadedByUserId: user.id,
  });

  // Update tags: delete old, insert new
  await db.delete(packageTags).where(eq(packageTags.packageId, packageId));
  if (manifest.tags.length > 0) {
    await db.insert(packageTags).values(
      manifest.tags.map((tag) => ({ packageId, tag: tag.toLowerCase() }))
    );
  }

  // Extract and store assets (icon, screenshots)
  if (manifest.store?.icon) {
    const assetId = crypto.randomUUID();
    const assetR2Key = `assets/${scope}/${name}/${manifest.version}/${manifest.store.icon}`;
    // Note: actual asset extraction from tarball would happen here.
    // For MVP, we record the metadata; the tarball download serves as the source.
    await db.insert(versionAssets).values({
      id: assetId,
      versionId,
      kind: "icon",
      path: manifest.store.icon,
      r2Key: assetR2Key,
      contentType: guessContentType(manifest.store.icon),
      sizeBytes: 0, // Populated when extracted from tarball
      sha256: "",
      ordering: 0,
    });
  }

  return c.json({
    id: manifest.id,
    version: manifest.version,
    packageId,
    versionId,
    channel,
    tarballSha256,
    tarballSizeBytes: tarballSize,
  });
});

function guessContentType(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export default app;
