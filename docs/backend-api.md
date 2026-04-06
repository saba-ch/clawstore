# Backend API

The Clawstore backend is a single Hono app deployed as a Cloudflare Worker at `api.clawstore.dev`. It owns all read and write paths for the registry: authentication, publishing, search, agent metadata, tarball serving, yank, reports. The CLI and the web frontend both consume it — the web Worker through a Cloudflare service binding, the CLI over public HTTPS.

There is no second backend. The discovery website does not talk to D1 directly; it goes through the same API as `clawstore install`.

## Architecture

```
+-----------+          +-----------+
| clawstore |          | clawstore |
|    CLI    |          |    web    |
+-----+-----+          +-----+-----+
      |                      |
      | HTTPS                | Cloudflare
      | api.clawstore.dev    | service binding
      |                      |
      v                      v
+--------------------------------+
|      Clawstore API             |
|      (Hono on Worker)          |
|                                |
|  /api/auth/*   Better Auth     |
|  /v1/*         Clawstore API   |
+--------+----------+------------+
         |          |            |
         v          v            v
      +-----+    +-----+     +-----+
      | D1  |    | R2  |     | KV  |
      +-----+    +-----+     +-----+
```

Same code path serves the CLI and the web frontend. Service-binding calls from the web Worker are sub-millisecond; public HTTPS calls from the CLI are standard Worker ingress.

## Authentication

Authentication is handled by **Better Auth** via the `better-auth-cloudflare` wrapper. Sessions are stored in D1; rate-limit counters are stored in KV; R2 is available as a Better Auth binding but Clawstore's own code uses R2 directly.

### Session auth (web)

All Better Auth endpoints are mounted under `/api/auth/*`. The web frontend uses the GitHub OAuth flow; Better Auth handles the redirect, token exchange, session cookie creation, and CSRF protection. Clawstore adds no routes under `/api/auth`.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/auth/sign-in/social/github` | Start the GitHub OAuth flow |
| `GET`  | `/api/auth/callback/github`       | OAuth callback (internal) |
| `GET`  | `/api/auth/get-session`           | Return the current session, if any |
| `POST` | `/api/auth/sign-out`              | Destroy the session |

Refer to Better Auth's documentation for the full endpoint surface. Clawstore relies on Better Auth's defaults.

### Token auth (CLI)

The CLI does not hold a session cookie — it holds an **API token**. Token creation, listing, and revocation are handled by Better Auth's **bearer** plugin via the `/api/auth/token` endpoints. Tokens are scoped to the issuing user and presented via `Authorization: Bearer <token>` on every request. Clawstore adds no custom token routes.

`clawstore login` opens a browser to the web frontend, the operator approves, the web frontend calls the Better Auth bearer endpoint on their behalf, and the token is handed back to the CLI via a local-loopback callback. The token is stored in the OS keychain (or `~/.clawstore/auth.json` with `0600` permissions as a fallback).

## API versioning

All Clawstore-owned routes are under `/v1/`. Breaking changes ship as a new prefix (`/v2/`) and the CLI's `clawstore doctor` warns operators when their client is too old to speak the current prefix. The CLI's registry base URL is configurable so enterprise or private deployments can point at alternate hosts.

Better Auth routes live under `/api/auth/*` and are versioned independently by the Better Auth project.

## Routes

### Meta

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/health`     | none | Liveness check. Returns `{ ok: true, version }`. |
| `GET` | `/v1/categories` | none | Return the curated category list: `[{ id, name, icon }]`. |

### Current user

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/me` | required | Return the authenticated user's identity and profile: `{ id, githubLogin, scope, createdAt, ownedAgentCount, profile: { bio, website, location, avatarUrl, displayName } }`. |

### User profiles

Public profiles for any user. Profile data is seeded from GitHub on first sign-in and editable by the owner.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/v1/users/:username`          | none     | Public profile: `{ githubLogin, displayName, avatarUrl, bio, website, location, createdAt, agents: [{ scope, name, tagline, avgRating, downloadCount }] }`. |
| `PUT`  | `/v1/users/:username/profile`  | required | Update the caller's own profile. Body: `{ bio?, website?, location?, displayName? }`. Returns 403 if `:username` does not match the caller's scope. |

### Agent listing and search

`:scope` in the URL is the publisher's GitHub username (no `@` — the client adds it back when displaying). `:name` is the agent name within the scope.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/agents`                              | none | List or search agents. See query params below. |
| `GET` | `/v1/agents/:scope/:name`                 | none | Agent detail including the current `latest` version manifest. |
| `GET` | `/v1/agents/:scope/:name/versions`        | none | Version history for an agent (paginated). |
| `GET` | `/v1/agents/:scope/:name/versions/:version` | none | A specific version's metadata and full `agent.json`. |

Query params for `GET /v1/agents`:

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query. Matched with `LIKE` against `name`, `tagline`, and `tags`. |
| `category` | string | Filter by category id. |
| `tag` | string | Filter by tag. Repeatable. |
| `channel` | `community`\|`official` | Filter by channel. Defaults to all visible channels. |
| `scope` | string | Filter by publisher scope. |
| `sort` | `recent`\|`name`\|`downloads`\|`rating` | Sort order. Defaults to `recent`. |
| `limit` | int | Page size. 1–100. Defaults to 20. |
| `cursor` | string | Pagination cursor returned by the previous response. |

MVP search is `LIKE` with indexes on `name`, `tagline`, and `tags`. See [Data Model](data-model.md) for the indexing strategy and the reason FTS5 is deliberately off the table.

### Agent download

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/agents/:scope/:name/versions/:version/tarball`             | none | Download the tarball. Content-addressed URL; `Cache-Control: public, max-age=31536000, immutable`. |
| `GET` | `/v1/agents/:scope/:name/versions/:version/assets/:path`        | none | Serve an extracted asset (icon, screenshot). Same cache headers. |

Downloads increment a counter on the version row. Counters are bucketed per day and not blocked on — the request returns whether or not the counter write succeeds.

### Publish and yank

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/agents/publish` | token | Authenticated tarball upload. Request body is `multipart/form-data` with one file part (`tarball`, the `.tgz`) and one JSON part (`metadata`, redundant manifest for quick rejection). Server validates, extracts assets, writes the version row, returns the live URL. |
| `POST` | `/v1/agents/:scope/:name/versions/:version/yank` | token | Yank a published version. Owner-only. Body: `{ reason? }`. Idempotent — yanking an already-yanked version is a no-op. |
| `POST` | `/v1/agents/:scope/:name/versions/:version/unyank` | token | Reverse a yank. Maintainer-only (owners cannot unyank their own yanked versions — avoids accidental re-exposure of bad content). |

The publish endpoint runs, in order:

1. **Authentication** — verify the bearer token, resolve to a user.
2. **Ownership** — if the `id` already exists, verify the caller is the owner. If it doesn't, claim it.
3. **Version monotonicity** — the new version must be strictly greater than any existing published version for this `id`.
4. **Deterministic validation** — run `packages/validator` against the uploaded tarball. Identical to the `clawstore validate` logic the author already ran locally.
5. **Executable scan + secret scan** — hard fail on any finding.
6. **Plugin reachability** — for each `dependencies.plugins[]`, confirm the spec resolves (ClawHub entry exists, npm package exists, git URL responds).
7. **Extract assets** — stream the tarball, write the full `.tgz` to `tarballs/:scope/:name/:version.tgz` in R2, extract icon and screenshots to `assets/:scope/:name/:version/...` with immutable cache headers.
8. **Persist** — write the version row to D1, update the agent's `latest` pointer (unless this is a pre-release), insert any new owner claim.
9. **Return** — response body includes the canonical URLs for the tarball, each asset, and the version detail endpoint.

Failures at any step abort the publish. Partial writes are cleaned up — the R2 uploads are idempotent and the D1 insert is the last step.

### Updates

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/updates` | token (optional) | Bulk update check. Request body: `{ installs: [{ id, version }] }`. Response: `{ updates: [{ id, from, to, channel, yanked }] }`. Used by `clawstore update check`. |

This is a single round-trip for the common case where an operator has 10 installed agents and wants to check all of them at once.

### Reports and moderation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/reports` | none (optional auth) | File a report against an agent or version. Body: `{ agentId, versionId?, reason, details }`. Rate-limited hard. |
| `GET`  | `/v1/reports` | maintainer | List pending reports. Maintainer-only. |
| `POST` | `/v1/reports/:id/resolve` | maintainer | Resolve a report. |

Reports land in the database for maintainer triage. There is no pre-publish human review — moderation is entirely post-hoc. See [Documentation hub § Open publish](README.md#open-publish-through-an-authenticated-api).

### Reviews

Authenticated users can leave one review per agent. Authors cannot review their own agents. Reviews carry a 1–5 star rating and optional text.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`    | `/v1/agents/:scope/:name/reviews`     | none     | List reviews for an agent. Paginated, sorted by `created_at DESC`. Response includes `avgRating` and `reviewCount` in metadata. |
| `POST`   | `/v1/agents/:scope/:name/reviews`     | required | Create a review. Body: `{ rating, title?, body? }`. Returns 409 if the user already reviewed this agent. Returns 403 if the user is the agent owner. |
| `PUT`    | `/v1/agents/:scope/:name/reviews/:id` | required | Update the caller's own review. Body: `{ rating?, title?, body? }`. Returns 403 if the review belongs to another user. |
| `DELETE` | `/v1/agents/:scope/:name/reviews/:id` | required | Delete the caller's own review, or any review if the caller is a maintainer. |

On every write operation (create, update, delete), the API recalculates `agents.avg_rating` and `agents.review_count` inline.

Agent detail responses (`GET /v1/agents/:scope/:name`) include `avgRating`, `reviewCount`, and `downloadCount` alongside existing fields.

## Response shapes

### Success

Every successful JSON response is a plain object. Collection endpoints return:

```json
{
  "items": [...],
  "nextCursor": "..."
}
```

Resource endpoints return the resource directly, not wrapped in a `data` envelope.

### Error

```json
{
  "error": {
    "code": "version_not_monotonic",
    "message": "Version 0.3.1 is not greater than the current published 0.3.1",
    "details": { "id": "@someone/calorie-coach", "current": "0.3.1", "requested": "0.3.1" }
  }
}
```

Error codes are snake_case and stable — the CLI pattern-matches them for user-friendly messages. The HTTP status code matches semantically: 400 for validation, 401 for unauthenticated, 403 for unauthorized, 404 for missing, 409 for conflict, 413 for size limits, 422 for validator findings, 429 for rate limited, 5xx for server errors.

## Rate limits

Rate limits are enforced via Better Auth's KV-backed rate limiter for auth endpoints, and a Hono middleware with its own KV counters for the rest. All limits are per-IP + per-token.

| Endpoint class | Limit | Window |
|----------------|-------|--------|
| `/api/auth/*`                     | 100 | 1 minute |
| `POST /v1/agents/publish`         | 20  | 1 hour (per user) |
| `POST /v1/reports`                | 10  | 1 hour (per IP) |
| `POST/PUT/DELETE /v1/.../reviews` | 30  | 1 hour (per user) |
| All other `GET /v1/*` (read)      | 600 | 1 minute |
| All other `POST /v1/*` (write)    | 60  | 1 minute |

Limits may be tuned after launch based on observed traffic. They exist primarily to make abuse expensive, not to enforce a paid tier.

## Two subdomains

`clawstore.dev` and `api.clawstore.dev` are separate Cloudflare Workers bound to the same D1, R2, and KV resources via SST links. The reasons this split exists rather than a single path-routed Worker:

- **Independent caching.** Tarball downloads from `api.clawstore.dev` get aggressive long-TTL CDN caching; the web app on `clawstore.dev` gets short-TTL HTML caching. A unified domain would require per-path cache rules, which is fragile.
- **CORS is trivial.** The web app explicitly allows `clawstore.dev` as the origin for `api.clawstore.dev`. A single domain would need no CORS but makes local dev setup messier.
- **CLI base URL is a constant.** `clawstore` CLI ships with `https://api.clawstore.dev/v1` hardcoded (overridable via env var). Future path changes to the web app never affect CLI clients.
- **The web Worker calls the API via a service binding, not HTTPS.** Same-binding calls are sub-millisecond regardless of the URL shape.

## Cross-references

- [Data Model](data-model.md) — the D1 schema that backs these routes
- [Agent Package](agent-package.md) — the tarball format publish validates against
- [Documentation hub](README.md)
