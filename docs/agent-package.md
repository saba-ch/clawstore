# Agent Package

The unit Clawstore distributes. An agent package is the vendor-managed portion of a complete OpenClaw agent product: store metadata, persona and operating instructions, workspace content, dependency declarations, and setup requirements. It is not a skill bundle, not a plugin, and never contains executable code.

A package is inert. Every file is markdown, JSON, YAML, CSV, TOML, plain text, or a known image format. Human-readable, reviewable in under a minute, auditable by both the backend validator and any operator who wants to look before installing.

## Package layout

The package is a directory tree with an `agent.json` manifest at its root. Everything else is freeform — authors choose whatever structure fits their content.

```
calorie-coach/
├── agent.json
├── README.md                   # store-facing description (long form)
├── app/
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
│   ├── USER.template.md        # materialized once at install, never overwritten
│   ├── knowledge/
│   │   ├── foods/
│   │   │   ├── fruits.md
│   │   │   ├── grains.md
│   │   │   └── restaurants.md
│   │   └── nutrition/
│   │       ├── macros.md
│   │       └── micros.md
│   └── data/
│       └── portion-sizes.json
└── store/
    ├── icon.png
    └── screenshots/
        ├── chat.png
        └── daily-log.png
```

The only hard structural requirement is that `agent.json` exists at the package root.

## `agent.json`

```json
{
  "schemaVersion": 1,
  "id": "@someone/calorie-coach",
  "version": "0.3.1",
  "name": "Calorie Coach",
  "tagline": "Log meals by chat, get daily nutrition summaries",
  "description": "...",
  "category": "health-fitness",
  "tags": ["nutrition", "tracking", "wellness"],
  "author": { "name": "...", "url": "..." },
  "license": "MIT",
  "homepage": "https://...",
  "repository": "https://github.com/...",

  "agent": {
    "defaults": {
      "model": "openai/gpt-5.4",
      "thinking": "low"
    }
  },

  "files": ["app/**"],

  "dependencies": {
    "plugins": [
      { "spec": "clawhub:@someone/nutrition-api", "required": true, "minVersion": "1.2.0" },
      { "spec": "@someone/image-vision", "required": false }
    ],
    "skills": [
      { "slug": "food-search", "required": false }
    ],
    "providers": {
      "any": ["anthropic", "openai"]
    }
  },

  "setup": {
    "secrets": [
      {
        "key": "NUTRITIONIX_API_KEY",
        "prompt": "Nutritionix API key",
        "required": true,
        "target": "env"
      }
    ]
  },

  "store": {
    "icon": "store/icon.png",
    "screenshots": ["store/screenshots/chat.png", "store/screenshots/daily-log.png"]
  },

  "openclaw": {
    "entrypoints": {
      "AGENTS.md": "app/AGENTS.md",
      "SOUL.md": "app/SOUL.md",
      "TOOLS.md": "app/TOOLS.md",
      "IDENTITY.md": "app/IDENTITY.md"
    },
    "templates": {
      "USER.md": "app/USER.template.md"
    }
  }
}
```

### Field reference

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | int | Manifest schema version. Currently `1`. |
| `id` | string | Scoped package ID in the form `@scope/name`. `scope` is the publisher's GitHub username, lowercased. Immutable after first publish. |
| `version` | string | SemVer. Must be strictly greater than any previously published version for this `id`. |
| `name` | string | Human-readable display name. |
| `tagline` | string | One-line pitch shown in listings. ~70 char soft limit. |
| `description` | string | Full description in markdown. Shown on the detail page. |
| `category` | string | One of the curated category slugs from the backend. |
| `tags` | string[] | Free-form tags. Used for search and filtering. |
| `author` | object | `{ name, url }`. Displayed on the detail page. |
| `license` | string | SPDX identifier. |
| `homepage` | string? | Optional project URL. |
| `repository` | string? | Optional source repository URL. |
| `agent.defaults` | object | Defaults applied when registering the agent with OpenClaw: `model`, `thinking`, etc. |
| `files` | string[] | Glob patterns that define the package payload. Similar to `package.json`'s `files` field. |
| `dependencies.plugins` | object[] | Plugin specs resolved through `openclaw plugins install` at install time. |
| `dependencies.skills` | object[] | Skill slugs resolved through `openclaw skills install` at install time. |
| `dependencies.providers` | object | `{ any: [...] }` declares acceptable runtime model providers. |
| `setup.secrets` | object[] | Required secrets prompted at install time. See [Secrets](#secrets). |
| `store.icon` | string? | Path to the icon file relative to the package root. Uploaded separately from the tarball at publish time. |
| `store.screenshots` | string[]? | Paths to screenshot files relative to the package root. Uploaded separately from the tarball at publish time. |
| `openclaw.entrypoints` | object | Maps package-relative file paths to canonical OpenClaw workspace filenames. |
| `openclaw.templates` | object | Maps package-relative template files to workspace filenames that must be written exactly once. |

## Manifest semantics

- **`files`** defines the package payload. At publish, the backend captures exactly the files matched by these globs — anything outside `files` is not distributed.
- **`dependencies.plugins`** is a declarative list. The Clawstore CLI resolves it by calling `openclaw plugins install <spec>` for each entry at install time. See [Dependency contract](#dependency-contract).
- **`dependencies.skills`** is resolved through `openclaw skills install <slug>` and ClawHub. Clawstore does not re-host skills.
- **`setup.secrets`** declares the secret keys the agent needs. The manifest carries only keys and prompts — never values. At install time, Clawstore prompts the operator and writes the values to `~/.openclaw/.env` for entries with `target: "env"`.
- **`openclaw.entrypoints`** is the mapping between the package's file tree and OpenClaw's canonical workspace filenames. At install, Clawstore copies each mapped file into its canonical slot at the workspace root.
- **`openclaw.templates`** is for files that should be written exactly once, then owned by the operator. The canonical example is `USER.md`: the package ships a starter, Clawstore writes it during first install, and never replaces it on update.

## Package ID

Package IDs are scoped in the form `@scope/name`.

- **Scope** is the publisher's GitHub username, lowercased. It is derived automatically at publish time from the authenticated user's identity — authors do not choose their scope.
- **Name** is a kebab-case identifier unique within the scope. `a-z`, `0-9`, `-`, 2–64 characters, must not start or end with `-`.
- The full ID is **immutable** after first publish. Renames happen by publishing a new ID and yanking the old one.
- Ownership is one user per ID. First publish claims the ID. Subsequent publishes require the same authenticated GitHub user.

Examples: `@someone/calorie-coach`, `@openclaw-labs/daily-standup`, `@acme/internal-support-bot`.

Org-level scopes (where multiple GitHub users publish under a shared scope) are deferred until there is a real use case.

## What ships, what doesn't

Publish-time validation — run by both the CLI locally and the backend on upload — enforces these rules:

| Category | Handling |
|---|---|
| **Allowed** | markdown, JSON, YAML, TOML, CSV, TSV, plain text, images (PNG, JPG, SVG, WebP) |
| **Flagged (warning)** | PDFs, opaque binaries the agent can't read without a declared dependency, oversize individual files |
| **Rejected (hard fail)** | Any executable bit set. Any file with a blocked extension: `.sh`, `.bash`, `.zsh`, `.js`, `.ts`, `.mjs`, `.cjs`, `.py`, `.rb`, `.php`, `.exe`, `.bat`, `.ps1`, `.dll`, `.so`, `.dylib`. Known binary formats that smell executable (ELF, Mach-O, PE). |
| **Rejected (hard fail)** | Any file whose content matches the secret-scan pattern set (AWS keys, OpenAI keys, generic `[A-Z_]+_API_KEY=...`, etc.). |

### Size limits

| Limit | Value |
|---|---|
| Total package size | 100 MB |
| File count | 10,000 |
| Individual text file (warning) | 1 MB |
| Individual asset file | 10 MB |

Limits may be revised based on real-world usage after launch. Current numbers are deliberately generous.

## Workspace file conventions

Clawstore supports OpenClaw's full canonical workspace filename set, but not every file has the same lifecycle.

| File | Lifecycle | Notes |
|------|-----------|-------|
| `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `HEARTBEAT.md`, `BOOT.md` | Package-managed | Installed and updated like app-owned files. |
| `BOOTSTRAP.md` | Package-managed with exception | Installed on first install. If the operator deletes it after first run, Clawstore does NOT recreate it on update. |
| `USER.md` | Template (write-once) | Package ships a starter via `openclaw.templates`. Clawstore materializes it once and then treats it as operator-owned. Never replaced on update. |
| `MEMORY.md` | Never package-managed | Always operator-owned. Preserved across every update, uninstall, and rollback. |

## User-state boundary

Hard rules. These are enforced by the install/update/uninstall code paths, not by convention.

- `MEMORY.md` is never package-owned. Packages cannot ship or manage it.
- `USER.md` is template-once, then operator-owned.
- Deleted `BOOTSTRAP.md` must not be recreated on update.
- Notes, logs, and ad-hoc operator files are preserved unless the operator explicitly opts into deletion.
- Updates may replace package-managed files only.
- Uninstalls offer to preserve user-managed files by default (moved to `~/.clawstore/orphans/`, not deleted).

Author-declared preserve patterns (a manifest field that lets a package reserve additional paths as user-managed) are deliberately excluded from the MVP manifest. Revisit only if a real agent needs to preserve a subtree that isn't covered by the convention-based rules above.

## Dependency contract

Dependencies live outside the package trust boundary.

### Plugins

```json
{ "spec": "clawhub:@someone/nutrition-api", "required": true, "minVersion": "1.2.0" }
```

| Field | Type | Description |
|---|---|---|
| `spec` | string | A spec resolvable by `openclaw plugins install`. Accepted forms: `clawhub:<name>[@version]`, bare `<name>` (ClawHub → npm fallback), `<name>@<marketplace>`, or a local path for sideloading. |
| `required` | bool | Required plugins block install if they fail to resolve or install. Optional plugins are offered to the operator with consent. |
| `minVersion` | string? | If set, the installer asks `openclaw plugins install` for this version or newer. |

### Skills

```json
{ "slug": "food-search", "required": false }
```

Skills resolve through `openclaw skills install <slug>` against ClawHub. There is no Clawstore-hosted skill registry.

### Providers

```json
"providers": { "any": ["anthropic", "openai"] }
```

Declares acceptable runtime model providers. At install, Clawstore checks that the operator has at least one matching provider configured in OpenClaw. If not, it prompts the operator to configure one before proceeding.

### Secrets

```json
{
  "key": "NUTRITIONIX_API_KEY",
  "prompt": "Nutritionix API key",
  "required": true,
  "target": "env"
}
```

| Field | Type | Description |
|---|---|---|
| `key` | string | Environment variable name. Uppercase snake case. |
| `prompt` | string | Human-readable prompt shown at install time. |
| `required` | bool | Required secrets block install until provided. Optional secrets offer to skip. |
| `target` | enum | MVP supports only `"env"` — Clawstore writes the secret to `~/.openclaw/.env`. Other targets reserved for future use. |

Secret values are prompted at install and passed straight to their target. Clawstore never stores secret values in its own install records.

## Versioning

- Semantic versioning: `MAJOR.MINOR.PATCH`.
- **Breaking** (MAJOR bump) = any of: behavior changed in a way that invalidates operator expectations, required dependencies added or changed incompatibly, required setup changed incompatibly, license changed.
- **Feature** (MINOR bump) = additive changes, new optional dependencies, new optional setup.
- **Patch** = content fixes, typos, clarifications, new knowledge files that don't change behavior contracts.
- Pre-releases use SemVer pre-release identifiers: `0.4.0-beta.1`, `1.0.0-rc.2`. Pre-releases are publishable but the `latest` pointer never advances to a pre-release.
- Published versions are **immutable**. The backend rejects any publish whose version is less than or equal to the current published version for the same `id`. Yanking a version (`clawstore yank @scope/name@version`) hides it from resolution but does not delete it — the record stays for audit and anyone with a pinned version can still install.

## Cross-references

- [Backend API](backend-api.md) — the `POST /v1/publish` endpoint, version monotonicity, ownership checks
- [Data Model](data-model.md) — how packages, versions, and owners are stored
- [Documentation hub](README.md)
