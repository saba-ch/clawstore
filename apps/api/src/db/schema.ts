import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Better Auth tables ──────────────────────────────────────
// Re-export from auth-schema.ts. These are owned by Better Auth.
export {
  users,
  sessions,
  accounts,
  verifications,
} from "./auth-schema";

import { users } from "./auth-schema";

// ── Clawstore tables ────────────────────────────────────────

export const packages = sqliteTable(
  "packages",
  {
    id: text("id").primaryKey(), // UUID
    scope: text("scope").notNull(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    latestVersionId: text("latest_version_id"), // FK to versions.id, nullable
    category: text("category")
      .notNull()
      .references(() => categories.id),
    description: text("description").notNull(),
    tagline: text("tagline").notNull(),
    displayName: text("display_name").notNull(),
    homepage: text("homepage"),
    repository: text("repository"),
    license: text("license").notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    avgRating: real("avg_rating"),
    reviewCount: integer("review_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("packages_scope_name_idx").on(t.scope, t.name),
    index("packages_scope_idx").on(t.scope),
    index("packages_name_idx").on(t.name),
    index("packages_category_idx").on(t.category),
    index("packages_owner_idx").on(t.ownerUserId),
    index("packages_updated_at_idx").on(t.updatedAt),
    index("packages_display_name_idx").on(t.displayName),
    index("packages_tagline_idx").on(t.tagline),
    index("packages_download_count_idx").on(t.downloadCount),
    index("packages_avg_rating_idx").on(t.avgRating),
  ]
);

export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(), // UUID
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    version: text("version").notNull(), // SemVer string
    channel: text("channel").notNull(), // community | official | beta
    manifest: text("manifest").notNull(), // Full agent.json as JSON string
    tarballR2Key: text("tarball_r2_key").notNull(),
    tarballSha256: text("tarball_sha256").notNull(),
    tarballSizeBytes: integer("tarball_size_bytes").notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    uploadedAt: integer("uploaded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    yankedAt: integer("yanked_at", { mode: "timestamp" }),
    yankedByUserId: text("yanked_by_user_id").references(() => users.id),
    yankedReason: text("yanked_reason"),
  },
  (t) => [
    uniqueIndex("versions_package_version_idx").on(t.packageId, t.version),
    index("versions_package_uploaded_idx").on(t.packageId, t.uploadedAt),
    index("versions_yanked_at_idx").on(t.yankedAt),
  ]
);

export const packageTags = sqliteTable(
  "package_tags",
  {
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    tag: text("tag").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.packageId, t.tag] }),
    index("package_tags_tag_idx").on(t.tag),
  ]
);

export const versionAssets = sqliteTable(
  "version_assets",
  {
    id: text("id").primaryKey(), // UUID
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    kind: text("kind").notNull(), // icon | screenshot | other
    path: text("path").notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    ordering: integer("ordering").notNull().default(0),
  },
  (t) => [index("version_assets_version_kind_idx").on(t.versionId, t.kind)]
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(), // UUID
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (t) => [index("api_tokens_user_id_idx").on(t.userId)]
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(), // UUID
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    versionId: text("version_id").references(() => versions.id),
    reporterUserId: text("reporter_user_id").references(() => users.id),
    reporterIpHash: text("reporter_ip_hash").notNull(),
    reason: text("reason").notNull(), // malicious | trademark | spam | inappropriate | other
    details: text("details").notNull(),
    status: text("status").notNull().default("open"), // open | resolved | dismissed
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolutionNotes: text("resolution_notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_package_id_idx").on(t.packageId),
    index("reports_ip_hash_idx").on(t.reporterIpHash),
  ]
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(), // UUID
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    reviewerUserId: text("reviewer_user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(), // 1-5
    title: text("title"),
    body: text("body"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("reviews_package_user_idx").on(t.packageId, t.reviewerUserId),
    index("reviews_package_id_idx").on(t.packageId),
    index("reviews_reviewer_idx").on(t.reviewerUserId),
    index("reviews_package_created_idx").on(t.packageId, t.createdAt),
  ]
);

export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  bio: text("bio"),
  website: text("website"),
  location: text("location"),
  githubLogin: text("github_login").notNull().unique(),
  avatarUrl: text("avatar_url"),
  displayName: text("display_name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(), // slug like "health-fitness"
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull(),
});
