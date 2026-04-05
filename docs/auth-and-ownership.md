# Auth and Ownership

Clawstore has two authentication surfaces — sessions for the web, tokens for the CLI — and one ownership model that binds both to a GitHub identity. This document explains how they connect and what guarantees the backend makes.

The implementation backbone is **Better Auth** via the `better-auth-cloudflare` wrapper. Sessions live in D1, rate-limit counters live in KV, and the OAuth provider is GitHub. Clawstore relies on Better Auth's defaults for anything not explicitly called out here.

## Identity

There is exactly one kind of identity: an authenticated GitHub user. MVP does not support email-only sign-up, magic links, or organizational accounts. GitHub OAuth is the whole auth story.

On first sign-in, Better Auth creates:

- A row in `users` — Clawstore-side identity (id, email, name, image, `createdAt`).
- A row in `accounts` — linked to the GitHub provider, holds the GitHub login and provider-side identifiers.
- A row in `sessions` — active cookie-backed session (web) or the base session used to mint CLI tokens (CLI).

The GitHub login (lowercased) becomes the user's **scope** — the `@scope` part of every package id they publish.

## Sessions (web)

The web frontend uses the GitHub OAuth flow end-to-end:

1. Operator clicks "Sign in with GitHub" on `clawstore.dev`.
2. Browser hits `GET /api/auth/sign-in/social/github` on the API Worker.
3. Better Auth redirects to GitHub, GitHub redirects back to `GET /api/auth/callback/github`.
4. Better Auth exchanges the code, creates the session, and sets the session cookie.
5. Subsequent requests from the web frontend to the API Worker include the cookie. The Worker validates against D1 without a round-trip to any external service.

Clawstore adds no routes under `/api/auth/*`. Sign-out, session refresh, and CSRF protection are Better Auth's defaults. Refer to Better Auth's documentation for the full endpoint surface.

See [Backend API § Session auth (web)](backend-api.md#session-auth-web) for the endpoint table.

## API tokens (CLI)

The CLI does not hold a session cookie. It holds an API token — an opaque bearer credential scoped to one user, presented via `Authorization: Bearer <token>` on every request.

The `clawstore login` loopback flow:

1. CLI picks a high local port and starts a loopback HTTP listener at `http://127.0.0.1:<port>/callback`.
2. CLI opens the operator's browser to `https://clawstore.dev/cli-login?port=<port>&state=<nonce>`.
3. The operator authenticates with GitHub (Better Auth session is created on `clawstore.dev`).
4. The web frontend shows a one-click confirm: "Authorize CLI on this machine?" On confirm, the web frontend calls `POST /v1/tokens` with the session cookie, gets a fresh token (shown exactly once), and POSTs it back to the loopback at `http://127.0.0.1:<port>/callback` with the same `state` nonce.
5. The CLI validates the nonce, stores the token in the OS keychain (fallback: `~/.clawstore/auth.json` with `0600`), prints success, and closes the loopback listener.

The loopback + nonce pattern is a standard CLI-OAuth dance. It keeps the token off the filesystem until the very last moment and makes the browser-to-CLI handoff safe against cross-site callers.

### Token lifetime

- Tokens live until revoked. They do not expire on a clock.
- Operators can list and revoke tokens from their `clawstore.dev` account page or via the CLI's `_debug` commands.
- Revocation is immediate — the API Worker checks the token against D1 on every request, so a revoked token fails with 401 on its next use.

### Token surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST`   | `/v1/tokens`     | session or token | Create a new API token. Body: `{ name, scopes? }`. Returns the token value exactly once. |
| `GET`    | `/v1/tokens`     | session or token | List the caller's active tokens. Token value is never returned — only metadata. |
| `DELETE` | `/v1/tokens/:id` | session or token | Revoke a token. |

See [Backend API § Token auth (CLI)](backend-api.md#token-auth-cli) for the full contract and [Data Model § `api_tokens`](data-model.md#api_tokens) for the storage shape.

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

The first successful publish of a package id writes a row to `packages` with `owner_user_id = caller.id`. Ownership is claimed atomically with the first version insert — no separate "register package" step.

### Publish authorization rules

On every publish, the backend runs:

1. **Authentication.** Bearer token resolves to a user. Fails with 401 if the token is missing, revoked, or invalid.
2. **Ownership check.**
   - If the package id does not exist: caller becomes the owner. Scope on the id must match the caller's scope. A token scoped to `@someone` cannot publish `@acme/anything` — the publish fails with 403 and a clear error.
   - If the package id exists: caller must equal `packages.owner_user_id`. Any other user fails with 403.
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

The "owner cannot unyank" rule exists because yanking is usually a response to a real problem with a version. Reversing that decision should require a second pair of eyes.

## Relationship to Better Auth tables

Clawstore's authorization logic lives in application code (`apps/api`), not in Better Auth's schema. The auth tables (`users`, `sessions`, `accounts`, `verifications`) carry only identity and session state. Everything about scope, ownership, and tokens is in Clawstore's own tables:

- `packages.owner_user_id` → `users.id`
- `api_tokens.user_id` → `users.id`
- `versions.published_by` → `users.id`

When Better Auth's schema changes between versions, regenerate with `pnpm --filter api auth:generate`. The Clawstore tables are never regenerated — they are hand-written Drizzle definitions in `apps/api/src/db/schema.ts`.

See [Data Model § Better Auth tables](data-model.md#better-auth-tables) for the generated side and [Data Model § `api_tokens`](data-model.md#api_tokens) for the token table.

## Cross-references

- [Backend API § Authentication](backend-api.md#authentication) — endpoint-level auth contracts
- [Data Model § `api_tokens`](data-model.md#api_tokens) — token storage
- [Publish Flow § Step 5](publish-flow.md#step-5-clawstore-login) — login from the author's perspective
- [Trust and Moderation](trust-and-moderation.md) — the broader trust story
- [Documentation hub](README.md)
