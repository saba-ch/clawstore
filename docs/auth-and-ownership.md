# Auth and Ownership

Clawstore has two authentication surfaces — sessions for the web, tokens for the CLI — and one ownership model that binds both to a GitHub identity. This document explains how they connect and what guarantees the backend makes.

The implementation backbone is **Better Auth** via the `better-auth-cloudflare` wrapper. Sessions live in D1, rate-limit counters live in KV, and the OAuth provider is GitHub. Clawstore relies on Better Auth's defaults for anything not explicitly called out here.

## Identity

There is exactly one kind of identity: an authenticated GitHub user. MVP does not support email-only sign-up, magic links, or organizational accounts. GitHub OAuth is the whole auth story.

On first sign-in, Better Auth creates:

- A row in `users` — Clawstore-side identity (id, email, name, image, `createdAt`).
- A row in `accounts` — linked to the GitHub provider, holds the GitHub login and provider-side identifiers.
- A row in `sessions` — active cookie-backed session (web) or the base session used to mint CLI tokens (CLI).

The GitHub login (lowercased) becomes the user's **scope** — the `@scope` part of every agent id they publish.

## Sessions (web)

The web frontend uses the GitHub OAuth flow end-to-end:

1. Operator clicks "Sign in with GitHub" on `useclawstore.com`.
2. Browser hits `GET /api/auth/sign-in/social/github` on the API Worker.
3. Better Auth redirects to GitHub, GitHub redirects back to `GET /api/auth/callback/github`.
4. Better Auth exchanges the code, creates the session, and sets the session cookie.
5. Subsequent requests from the web frontend to the API Worker include the cookie. The Worker validates against D1 without a round-trip to any external service.

Clawstore adds no routes under `/api/auth/*`. Sign-out, session refresh, and CSRF protection are Better Auth's defaults. Refer to Better Auth's documentation for the full endpoint surface.

See [Backend API § Session auth (web)](backend-api.md#session-auth-web) for the endpoint table.

## Bearer tokens (CLI)

The CLI does not hold a session cookie. It holds a **bearer token** obtained through the OAuth 2.0 Device Authorization flow, presented via `Authorization: Bearer <token>` on every request. Better Auth's bearer plugin manages token creation and validation.

### The `clawstore login` device flow

1. CLI calls `POST /api/auth/device/code` with `{ client_id: "clawstore-cli" }`. The backend returns a `device_code`, `user_code`, and `verification_uri_complete`.
2. CLI opens the operator's browser to the verification URL — a `/device` page on the web frontend that displays the user code.
3. If the operator is not signed in, the page shows a "Sign in with GitHub" button. After GitHub OAuth, the page redirects back to `/device?user_code=...` with an active session cookie.
4. The operator confirms the code matches what their terminal shows and clicks **Approve**. The web frontend calls `POST /api/auth/device/approve` with `{ userCode }`.
5. Meanwhile, the CLI polls `POST /api/auth/device/token` with the `device_code`. Once the operator approves, this returns an `access_token`.
6. The CLI stores the token in `~/.clawstore/auth.json` with `0600` permissions and prints success.

### Token lifetime

- Tokens are managed by Better Auth's bearer plugin and tied to the user's session.
- Operators can sign out from the `useclawstore.com` web frontend to invalidate sessions.

## Scope derivation

Authors do not pick their scope. It is derived at publish time from the authenticated user's GitHub login, lowercased.

- Operator's GitHub login is `Someone` → their scope is `@someone`.
- Their first published package might be `@someone/calorie-coach`.
- They can publish as many packages as they like under `@someone`, but they cannot publish under any other scope.
- If the operator renames themselves on GitHub, the old scope remains bound to their Clawstore user id. New publishes still use the scope recorded at first sign-in. Renaming a scope is not supported at MVP.

This is intentional. It eliminates the entire class of "someone claimed the `@stripe` scope" squatting issues without any org management overhead.

Organizational scopes — where multiple GitHub users publish under one shared scope — are deferred until there is a real use case.

## Ownership

Ownership is enforced on `POST /v1/publish`.

### The owner claim

The first successful publish of an agent id writes a row to `agents` with `owner_user_id = caller.id`. Ownership is claimed atomically with the first version insert — no separate "register package" step.

### Publish authorization rules

On every publish, the backend runs:

1. **Authentication.** Bearer token resolves to a user. Fails with 401 if the token is missing, revoked, or invalid.
2. **Ownership check.**
   - If the agent id does not exist: caller becomes the owner. Scope on the id must match the caller's scope. A token scoped to `@someone` cannot publish `@acme/anything` — the publish fails with 403 and a clear error.
   - If the agent id exists: caller must equal `agents.owner_user_id`. Any other user fails with 403.
3. **Version monotonicity.** The new version must be strictly greater than the largest existing version for this id (across all channels). Re-publishing an existing version fails with 409 `version_not_monotonic`. See [Data Model § Immutability rules](data-model.md#immutability-rules).

One owner per id at MVP. Ownership transfer (e.g. handing a package to a different GitHub user) is not supported at MVP; the replacement path is to publish under a new id and yank the old one.

### What ownership grants

| Action | Owner | Maintainer | Anyone else |
|---|---|---|---|
| Publish a new version | ✅ | ❌ | ❌ |
| Yank own versions | ✅ | ✅ | ❌ |
| Unyank own versions | ❌ | ✅ | ❌ |
| Delist a package | ❌ | ✅ | ❌ |
| View package detail | ✅ | ✅ | ✅ |
| File a report | ✅ | ✅ | ✅ |
| Review a package | ❌ | ✅ (authenticated) | ✅ (authenticated) |
| Delete any review | ❌ | ✅ | ❌ |

The "owner cannot unyank" rule exists because yanking is usually a response to a real problem with a version. Reversing that decision should require a second pair of eyes.

The "owner cannot review own package" rule prevents self-promotion. Owners see their package's reviews but cannot participate as reviewers. Maintainers can delete any review (spam, abuse) but cannot edit another user's review text or rating.

## Profile enrichment

On first sign-in, a Clawstore post-sign-in hook creates a row in the `profiles` table alongside the Better Auth `users` row. The profile is seeded from the GitHub OAuth payload:

- `github_login` — the lowercased GitHub username (also the user's scope)
- `display_name` — GitHub's `name` field
- `avatar_url` — GitHub's avatar URL

Users can edit their profile (bio, website, location, display name) from the `useclawstore.com` account page via `PUT /v1/users/:username/profile`. The `github_login` field is read-only — it is the scope, and scopes do not change.

Public profiles are served at `GET /v1/users/:username` and rendered on `useclawstore.com/users/:username`. They include the user's published packages with aggregate stats (download count, average rating). See [Backend API § User profiles](backend-api.md#user-profiles) and [Data Model § `profiles`](data-model.md#profiles).

## Relationship to Better Auth tables

Clawstore's authorization logic lives in application code (`apps/api`), not in Better Auth's schema. The auth tables (`users`, `sessions`, `accounts`, `verifications`) carry only identity and session state. Everything about scope, ownership, and tokens is in Clawstore's own tables:

- `agents.owner_user_id` → `users.id`
- `versions.uploaded_by_user_id` → `users.id`

When Better Auth's schema changes between versions, regenerate with `pnpm --filter api auth:generate`. The Clawstore tables are never regenerated — they are hand-written Drizzle definitions in `apps/api/src/db/schema.ts`.

See [Data Model § Better Auth tables](data-model.md#better-auth-tables) for the generated side. Tokens are managed by Better Auth's bearer plugin.

## Cross-references

- [Backend API § Authentication](backend-api.md#authentication) — endpoint-level auth contracts
- [Publish Flow § Step 5](publish-flow.md#step-5-clawstore-login) — login from the author's perspective
- [Trust and Moderation](trust-and-moderation.md) — the broader trust story
- [Documentation hub](README.md)
