<p align="center">
  <h1 align="center">Clawstore</h1>
  <p align="center"><strong>The app store for OpenClaw agents.</strong></p>
  <p align="center">
    Browse, install, and publish AI agent packages<br/>
    from a community-driven registry.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/clawstore"><img src="https://img.shields.io/npm/v/clawstore" alt="npm version"></a>
  <a href="https://github.com/saba-ch/clawstore/blob/main/LICENSE"><img src="https://img.shields.io/github/license/saba-ch/clawstore" alt="license"></a>
  <a href="https://github.com/saba-ch/clawstore/actions/workflows/deploy.yml"><img src="https://github.com/saba-ch/clawstore/actions/workflows/deploy.yml/badge.svg" alt="deploy"></a>
</p>

<p align="center">
  <a href="https://useclawstore.com">Website</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#development">Development</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

[OpenClaw](https://github.com/openclaw/openclaw) is a framework for building AI agents. But there's no central place to share and discover agents built with it.

**Clawstore fills that gap** — a package registry, CLI, and web storefront for OpenClaw agents. Authors publish agent packages, users browse and install them with one command.

```bash
# Install the CLI
npm install -g clawstore

# Search for agents
clawstore search "productivity"

# Install an agent
clawstore install @saba-ch/calorie-coach

# Publish your own
clawstore login
clawstore publish ./my-agent
```

> Third-party project — not a fork of or contribution to OpenClaw core.

## Quickstart

### Install an agent

```bash
npm install -g clawstore
clawstore search coach
clawstore install @saba-ch/calorie-coach
```

### Publish an agent

```bash
clawstore init           # Scaffold agent.json
clawstore validate       # Check package structure
clawstore login          # Authenticate with GitHub
clawstore publish        # Publish to the registry
```

### Browse the web

Visit [useclawstore.com](https://useclawstore.com) to explore agents by category, view details, and sign in with GitHub.

## Architecture

Clawstore is a monorepo with four main components:

```
┌──────────────────────────────────────────────────────┐
│                    useclawstore.com                   │
│              TanStack Start + React SSR               │
│                  (Cloudflare Worker)                  │
└────────────────────────┬─────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────┐
│               api.useclawstore.com/v1                │
│                 Hono REST API                        │
│            (Cloudflare Worker + D1 + R2)             │
└──────────────────────────────────────────────────────┘
        ▲                               ▲
        │                               │
┌───────┴──────┐              ┌─────────┴────────┐
│  clawstore   │              │  @clawstore/sdk  │
│   CLI (npm)  │              │  TypeScript SDK   │
└──────────────┘              └──────────────────┘
```

| Component | Path | Stack |
|-----------|------|-------|
| **API** | `apps/api` | Hono, Drizzle ORM, Better Auth, Cloudflare D1/R2/KV |
| **Web** | `apps/web` | TanStack Start, React, Tailwind CSS, Cloudflare Workers |
| **CLI** | `apps/cli` | Commander.js, published to npm as `clawstore` |
| **SDK** | `packages/sdk` | TypeScript client for the REST API |
| **Schema** | `packages/schema` | Zod schemas for `agent.json` validation |
| **Validator** | `packages/validator` | Package structure and content validation |

## Development

```bash
# Clone and install
git clone https://github.com/saba-ch/clawstore.git
cd clawstore
pnpm install

# Run API locally
cd apps/api
cp .dev.vars.example .dev.vars   # Add GitHub OAuth creds
npx wrangler d1 migrations apply clawstore-db --local
npx wrangler dev

# Run web locally
cd apps/web
VITE_API_URL=http://localhost:8787/v1 pnpm dev

# Type-check everything
pnpm check-types

# Build everything
pnpm build
```

### Project structure

```
clawstore/
├── apps/
│   ├── api/              # Hono API (Cloudflare Worker)
│   ├── cli/              # CLI (npm package)
│   └── web/              # Web storefront (TanStack Start)
├── packages/
│   ├── schema/           # agent.json Zod schemas
│   ├── sdk/              # TypeScript API client
│   └── validator/        # Package validation
├── examples/
│   └── calorie-coach/    # Example agent package
└── docs/                 # Architecture and design docs
```

## Documentation

| Document | Description |
|----------|-------------|
| [Agent package format](docs/agent-package.md) | `agent.json` spec and what ships in a package |
| [Backend API](docs/backend-api.md) | REST API surface |
| [Data model](docs/data-model.md) | Database schema |
| [Auth & ownership](docs/auth-and-ownership.md) | GitHub OAuth, scoped publishing |
| [Publish flow](docs/publish-flow.md) | How publishing works end to end |
| [Install flow](docs/install-flow.md) | How install resolves and downloads |
| [Trust & moderation](docs/trust-and-moderation.md) | Reporting, yanking, verification |
| [OpenClaw integration](docs/openclaw-integration.md) | How agents run after install |

---

<p align="center">
  Built by <a href="https://github.com/saba-ch"><strong>Saba</strong></a> · MIT License
</p>
