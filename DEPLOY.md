# Deployment Checklist

## 1. Pre-deploy setup

### Cloudflare account
- [ ] Cloudflare account with Workers paid plan (for D1, R2, KV)
- [ ] Custom domain `useclawstore.com` added to Cloudflare DNS
- [ ] Subdomain `api.useclawstore.com` configured

### GitHub OAuth app (production)
- [ ] Create a new GitHub OAuth App at https://github.com/settings/developers
  - App name: `Clawstore`
  - Homepage URL: `https://useclawstore.com`
  - Callback URL: `https://api.useclawstore.com/api/auth/callback/github`
- [ ] Copy Client ID and Client Secret

### Secrets
- [ ] Generate `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
- [ ] Note all secrets needed:
  - `GITHUB_CLIENT_ID` (from OAuth app above)
  - `GITHUB_CLIENT_SECRET` (from OAuth app above)
  - `BETTER_AUTH_SECRET` (generated)

---

## 2. Cloudflare resources

### Create D1 database
```bash
npx wrangler d1 create clawstore-db
# Note the database_id from the output
```

### Create R2 bucket
```bash
npx wrangler r2 bucket create clawstore-tarballs
```

### Create KV namespace
```bash
npx wrangler kv namespace create RateLimit
# Note the namespace id from the output
```

### Update wrangler configs
- [ ] `apps/api/wrangler.jsonc` — update `database_id` and KV `id` with real values
- [ ] Add production environment section or create `wrangler.production.jsonc`

---

## 3. Environment variables

### API Worker secrets
```bash
cd apps/api
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put DEVICE_VERIFICATION_URI
# Value: https://useclawstore.com/device
npx wrangler secret put CORS_ORIGINS
# Value: https://useclawstore.com
```

### Web Worker env
- [ ] Set `VITE_API_URL=https://api.useclawstore.com/v1` in web build

---

## 4. Database migration

```bash
cd apps/api
npx wrangler d1 migrations apply clawstore-db --remote
```

- [ ] Verify categories seeded: `npx wrangler d1 execute clawstore-db --remote --command="SELECT count(*) FROM categories"`

---

## 5. Deploy Workers

### API Worker
```bash
cd apps/api
npx wrangler deploy --minify
```
- [ ] Verify: `curl https://api.useclawstore.com/v1/health`
- [ ] Verify: `curl https://api.useclawstore.com/v1/categories`

### Web Worker
```bash
cd apps/web
VITE_API_URL=https://api.useclawstore.com/v1 pnpm build
npx wrangler deploy
```
- [ ] Verify: `https://useclawstore.com` loads
- [ ] Verify: sign in with GitHub works
- [ ] Verify: `/device` page works

### Custom domains
- [ ] Route `api.useclawstore.com/*` → API Worker
- [ ] Route `useclawstore.com/*` → Web Worker

---

## 6. End-to-end smoke test (production)

```bash
# Test health
curl https://api.useclawstore.com/v1/health

# Test categories
curl https://api.useclawstore.com/v1/categories

# Test CLI login
clawstore login

# Test publish
clawstore publish examples/calorie-coach

# Test search
clawstore search coach

# Test install
clawstore install @saba-ch/calorie-coach
```

---

## 7. Publish CLI to npm

### Package prep
- [ ] Update `apps/cli/package.json`:
  - Set `version` to `0.1.0`
  - Set `repository`, `homepage`, `bugs` fields
  - Verify `bin.clawstore` points to `./dist/index.js`
  - Verify `files` includes `dist`
- [ ] Update default API URL in `apps/cli/src/lib/config.ts` to `https://api.useclawstore.com/v1`
- [ ] Build: `pnpm --filter clawstore build`
- [ ] Test the built binary: `node apps/cli/dist/index.js --version`

### Publish
```bash
cd apps/cli
npm login
npm publish --access public
```

- [ ] Verify: `npx clawstore --version`
- [ ] Verify: `npx clawstore search coach`

---

## 8. Merge to main

### Pre-merge
- [ ] All tests pass: `pnpm check-types`
- [ ] Full build succeeds: `pnpm build`
- [ ] Create PR from `develop` → `main`
- [ ] Review the diff

### Merge
```bash
git checkout main
git merge develop
git push origin main
```

---

## 9. CI/CD (GitHub Actions)

### PR checks (`.github/workflows/ci.yml`)
Runs on every PR to `main` and `develop`:
- [ ] Install pnpm + Node 20
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm check-types` — type-check all packages
- [ ] `pnpm build` — verify everything builds

### Deploy on merge to main (`.github/workflows/deploy.yml`)
Runs on push to `main`:
- [ ] Build all packages
- [ ] Deploy API Worker: `wrangler deploy` with secrets from GitHub Secrets
- [ ] Deploy Web Worker: build with prod `VITE_API_URL`, `wrangler deploy`
- [ ] Run migration: `wrangler d1 migrations apply --remote`
- [ ] Smoke test: `curl` health endpoint

### npm publish on tag (`.github/workflows/publish-cli.yml`)
Runs on `v*` tags:
- [ ] Build CLI: `pnpm --filter clawstore build`
- [ ] Publish to npm with `NPM_TOKEN` from GitHub Secrets

---

## 10. GitHub Secrets needed

| Secret | Used by |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | CI deploy workflows (Workers + D1) |
| `CLOUDFLARE_ACCOUNT_ID` | CI deploy workflows |
| `GITHUB_CLIENT_ID` | Wrangler secret (set once, not in CI) |
| `GITHUB_CLIENT_SECRET` | Wrangler secret (set once, not in CI) |
| `BETTER_AUTH_SECRET` | Wrangler secret (set once, not in CI) |
| `NPM_TOKEN` | CLI npm publish workflow |

---

## 11. Post-deploy

- [ ] Update `apps/cli/src/lib/config.ts` default URL if not already `https://api.useclawstore.com/v1`
- [ ] Update `apps/web/src/lib/api.ts` default URL if not already `https://api.useclawstore.com/v1`
- [ ] Update `apps/api/src/auth.ts` — `verificationUri` default to `https://useclawstore.com/device`
- [ ] Remove `http://localhost:*` from CORS defaults and auth trustedOrigins (keep them only for dev via env vars)
- [ ] Tag release: `git tag v0.1.0 && git push --tags`
