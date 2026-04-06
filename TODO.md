# Clawstore — TODO

## Doc fixes remaining

- [x] auth-and-ownership.md: rewrite login flow to device auth (was loopback)
- [x] auth-and-ownership.md: remove /v1/tokens endpoints (don't exist)
- [x] auth-and-ownership.md: fix `packages` → `agents` on ownership section
- [x] auth-and-ownership.md: remove broken api_tokens cross-reference
- [x] backend-api.md: fix /v1/me response shape (name/email/image, not githubLogin)
- [x] backend-api.md: fix asset endpoint `:path` → `:assetId`
- [x] backend-api.md: rewrite token auth section to describe device flow
- [x] publish-flow.md: update login step to describe device auth
- [x] Migration: seed categories in migration instead of lazy-loading
- [ ] auth-and-ownership.md: permission matrix says "maintainer" can delist/unyank/delete reviews — these are TODO in code, mark as post-MVP in docs
- [ ] data-model.md: document that categories are seeded in the migration, not at runtime
- [ ] Document the `/device` page on the web frontend (currently undocumented)

## Code — prod readiness

### Auth & profiles
- [ ] Remove console.log debug lines from auth.ts profile hook
- [ ] Handle profile creation failure gracefully (currently silent — user gets "unknown" scope)
- [ ] `verificationUri` in auth.ts is hardcoded to `http://localhost:3000/device` — make configurable via env var
- [ ] CORS origins are hardcoded — make configurable via env var for local dev vs production

### API routes
- [ ] Publish route: wrap DB inserts in a transaction (agent + version + tags + assets should be atomic)
- [ ] Publish route: add actual tarball validation via `@clawstore/validator` (currently only validates the metadata JSON, not the tarball contents)
- [ ] Publish route: validate `category` exists before inserting (returns FK error instead of a clean 400)
- [ ] Rate limiting middleware (documented in backend-api.md but not implemented)
- [ ] Maintainer role system (reports, unyank, delist, delete any review all have `// TODO: proper maintainer role check`)
- [ ] Error responses for unhandled errors expose no useful info — add request ID logging

### CLI
- [ ] `clawstore login`: handle token refresh / re-login when token is expired
- [ ] `clawstore publish`: surface the actual error message from the API (currently shows generic "Publish failed")
- [ ] `clawstore install`: verify tarball SHA-256 after download
- [ ] `clawstore install`: run validator on downloaded tarball before extracting
- [ ] `clawstore install`: resolve plugin/skill dependencies via OpenClaw CLI
- [ ] `clawstore install`: prompt for secrets declared in setup.secrets
- [ ] `clawstore install`: register agent with OpenClaw via `openclaw agents add`
- [ ] `clawstore update`: implement actual update (currently just checks for updates, tells user to re-install)
- [ ] `clawstore uninstall`: implement (not wired up)
- [ ] `clawstore rollback`: implement (not wired up)
- [ ] `clawstore doctor`: implement (not wired up)
- [ ] `clawstore preview`: implement (not wired up)
- [ ] `clawstore diff`: implement (not wired up)
- [ ] `clawstore prune`: implement (not wired up)
- [ ] `clawstore policy`: implement (not wired up)

### Web frontend
- [ ] Home page: handle API errors gracefully (currently crashes if API is down)
- [ ] Agent detail page: show reviews section
- [ ] Agent detail page: show version history
- [ ] Agent detail page: report button
- [ ] Search page: debounce search input
- [ ] User profile page: edit profile form (PUT /v1/users/:username/profile)
- [ ] `/device` page: handle edge cases (expired code, already-used code)
- [ ] Add loading states and error boundaries to all pages
- [ ] Add SEO meta tags per page

### Validator
- [ ] Add tests (unit tests for each check: schema, extensions, secrets, sizes, entrypoints)
- [ ] Validator currently reads every file fully into memory — stream large files instead

### SDK
- [ ] Add error type exports so consumers can catch `ClawstoreApiError`
- [ ] Add request/response type generics for better TypeScript inference

### Infrastructure
- [ ] SST config: wire up the web worker (currently commented out)
- [ ] CI pipeline: lint + type-check + test on PR
- [ ] Production env vars: GitHub OAuth app with production callback URL
- [ ] Production `verificationUri` pointing to `https://useclawstore.com/device`
- [ ] Production CORS origins
- [ ] R2 bucket lifecycle rules for orphaned tarballs
- [ ] KV rate-limit counter setup

### Schema / DB
- [ ] Consider adding `created_at` default to `version_assets` table
- [ ] Add a `roles` or `maintainer` flag to profiles for the maintainer permission system
- [ ] Data-model.md mentions `download_count` bucketed per day — not implemented, currently a simple counter
