# Clawstore

**An app store for complete OpenClaw agents. Third-party distribution layer, not a fork.**

Clawstore distributes entire agents as installable products — persona, workspace files, store metadata, dependency declarations — through an authenticated backend API. Authors publish with `clawstore publish`. Operators install with `clawstore install`. OpenClaw runs the installed agent. [ClawHub](https://clawhub.ai) continues to ship the plugins and skills that agents depend on. Clawstore never vendors executable code.

## Architecture

```
        Author                         Operator
  (clawstore publish)           (clawstore install / update)
          |                                |
          | HTTPS                          | HTTPS
          v                                v
    +-----------+                    +-----------+
    | clawstore |                    | clawstore |
    |    CLI    |                    |    web    |
    |  (Node)   |                    | (TanStack |
    |           |                    |  Start)   |
    +-----+-----+                    +-----+-----+
          |                                |
          | HTTPS                          | service binding
          | api.useclawstore.com              | (no public hop)
          v                                v
    +------------------------------------------------+
    |          Clawstore backend API                 |
    |         (Hono on Cloudflare Worker)            |
    |   Better Auth + Drizzle + validator library    |
    +---+----------------+-----------------+---------+
        |                |                 |
        v                v                 v
    +-------+      +-----------+      +-----------+
    |  D1   |      |    R2     |      |    KV     |
    | meta  |      | tarballs  |      | rate-limit|
    |       |      | + assets  |      |  buckets  |
    +-------+      +-----------+      +-----------+

        (Dependencies fulfilled out-of-band)
    +-------------------------------------------+
    |  OpenClaw CLI  (openclaw plugins install) |
    |  + ClawHub     (plugin / skill registry)  |
    +-------------------------------------------+
```

Two Cloudflare Workers, one D1 database, one R2 bucket, one KV namespace. Everything else (authors, operators, OpenClaw) lives outside the Clawstore boundary.

## Tech stack

| Layer | Tech |
|-------|------|
| Infrastructure | SST v3 (Ion) on Cloudflare |
| Backend API | Hono on Cloudflare Worker, hosted at `api.useclawstore.com` |
| Frontend | TanStack Start (SSR) on Cloudflare Worker, hosted at `useclawstore.com` |
| Auth | Better Auth via `better-auth-cloudflare` — GitHub OAuth, D1 session store, KV rate limiting |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| Object store | Cloudflare R2 (tarballs + extracted assets) |
| CLI | Node 20 + Commander + `@clack/prompts` + tsup, published to npm as `clawstore` |
| Validator | Ajv-based JSON Schema + custom rules, shared between CLI and API |
| Monorepo | pnpm workspaces + Turborepo |
| Search (MVP) | Drizzle `LIKE` queries on indexed columns — no FTS5, see [Data Model](data-model.md) |

## Core concepts

- **Agent package** — the unit Clawstore distributes. An inert bundle of markdown, JSON, and images that describes and configures an OpenClaw agent. Never executable. See [Agent Package](agent-package.md).
- **Scoped ID** — `@scope/name`, where `scope` is the publisher's GitHub username (lowercased). Enables per-author namespaces with zero upfront org management.
- **Version** — an immutable published revision of a package. Identified by `(package, semver)`. Yank-not-mutate: published versions can be hidden from resolution but never overwritten.
- **Channel** — `community` (open publish), `official` (curated allowlist), `private` (post-MVP). A version belongs to exactly one channel.
- **Owner** — the GitHub user who first published a given package ID. Subsequent publishes of the same ID require the same owner. Ownership is one-per-id at MVP.
- **Dependency declaration** — a list of plugin and skill specs the agent needs at runtime. The Clawstore CLI resolves these by calling `openclaw plugins install` and `openclaw skills install`. Packages never contain vendored dependencies.

## Key design decisions

### Agents are inert content, always

No executables, no scripts, no code-bearing files. Publish-time validation rejects `.sh`, `.js`, `.ts`, `.py`, `.exe`, exec bits, and known binary formats. The moment agents can run code, the security story collapses into "re-invent plugin sandboxing" — and Clawstore loses its main differentiator: agents are auditable by a human in under a minute.

### Dependencies are declared, not bundled

Required plugins flow through `openclaw plugins install`. Required skills flow through `openclaw skills install` (ClawHub). Clawstore never re-hosts or re-validates those dependencies; it relies on the sibling ecosystem's existing security and install pipelines. An agent package is an app; its runtime dependencies come from their own source of truth.

### User state is never package-owned

`MEMORY.md`, materialized `USER.md`, notes, logs, and any operator-created files are preserved on update and uninstall. If an operator deletes `BOOTSTRAP.md` after first run, Clawstore will not recreate it. Updates replace only vendor-managed files; uninstalls offer to preserve the rest.

### Open publish through an authenticated API

Clawstore follows the ClawHub model — authors `clawstore login` with GitHub OAuth and `clawstore publish` straight to the backend. There is no git-monorepo registry, no PR-based publish, no pre-publish human review. Validation runs server-side on upload (same validator library the CLI runs locally). Moderation is post-hoc: reports, yank, delist.

### One validator library, shared by CLI and backend

`packages/validator` is imported by both `apps/cli` (local `clawstore validate`) and `apps/api` (publish-time validation). If the CLI says a package is valid, the server agrees, and vice versa. Server-only checks (authentication, ownership, version monotonicity) are explicitly things the CLI cannot know without contacting the server — nothing else diverges.

### Versions are immutable

Once a version is published, its tarball and metadata never change. Authors can yank a version (hide it from resolution) but cannot overwrite it. The version row stays in the database for audit; yanked versions return in listings as deprecated. Immutability is enforced by the backend, not by client discipline.

### Website and CLI read from the same API

`useclawstore.com` is a TanStack Start SSR app that calls the Hono API via a Cloudflare service binding. `clawstore install` is a Node CLI that calls the same API over public HTTPS. There is no separate "web backend" — the website has no direct database access. Single source of truth for business logic.

### D1 now, Postgres later, no panic in between

Cloudflare D1 is the launch database because it's cheapest, closest to the Workers runtime, and zero-config inside SST. The [Data Model](data-model.md) doc spells out the rules that keep the D1-to-Postgres migration path clean: Drizzle query builder only, no D1 FTS5, consistent use of Drizzle's `timestamp` and `json` helpers. Migration cost at ~100-package scale is a half-day.

### Two subdomains, not one router

`useclawstore.com` and `api.useclawstore.com` are separate Workers. Independent caching, simpler CORS, trivial CLI base URL. A single-domain path-routed topology was considered and rejected — the "one domain" benefit is cosmetic and costs complexity.

## Documents

- [One-pager](one-pager.md) — customer-facing overview
- [Agent Package](agent-package.md) — the unit Clawstore distributes: layout, `agent.json`, what ships, versioning
- [Backend API](backend-api.md) — REST surface, auth, routes, rate limits
- [Data Model](data-model.md) — D1 schema sketch, immutability rules, migration-safe conventions
- [Publish Flow](publish-flow.md) — author experience from `clawstore init` to live on the store
- [Install Flow](install-flow.md) — operator experience for install, uninstall, and doctor
- [Update and Rollback](update-and-rollback.md) — update detection, diffing, snapshots, atomic apply, rollback, failure modes
- [CLI Reference](cli.md) — command surface by persona, exit codes, base URL
- [Auth and Ownership](auth-and-ownership.md) — GitHub OAuth, session and token flows, scope derivation, the owner claim
- [Trust and Moderation](trust-and-moderation.md) — what Clawstore enforces, what it doesn't, and how reports are handled
- [OpenClaw Integration](openclaw-integration.md) — every OpenClaw CLI surface and filesystem convention Clawstore depends on

The original implementation plan is archived at [`archive/PLAN-2026-04.md`](archive/PLAN-2026-04.md) for historical reference.
