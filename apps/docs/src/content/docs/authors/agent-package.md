---
title: Agent Package Format
description: The structure of a Clawstore agent package — layout, agent.json manifest, file rules, and size limits.
---

An agent package is the unit Clawstore distributes: store metadata, persona files, workspace content, dependency declarations, and setup requirements bundled together. It is **never executable** — every file is markdown, JSON, YAML, CSV, plain text, or an image.

## Package layout

A package is a directory tree with `agent.json` at the root. Everything else is freeform.

```
calorie-coach/
├── agent.json              # Package manifest (required)
├── README.md               # Store-facing description
├── app/
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
│   ├── USER.template.md    # Write-once template
│   ├── knowledge/
│   │   ├── foods/
│   │   │   ├── fruits.md
│   │   │   └── restaurants.md
│   │   └── nutrition/
│   │       └── macros.md
│   └── data/
│       └── portion-sizes.json
└── store/
    ├── icon.png
    └── screenshots/
        ├── chat.png
        └── daily-log.png
```

## The `agent.json` manifest

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

## Field reference

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | int | Manifest schema version. Currently `1`. |
| `id` | string | Scoped package ID: `@scope/name`. Immutable after first publish. |
| `version` | string | SemVer. Must be strictly greater than any previously published version. |
| `name` | string | Human-readable display name. |
| `tagline` | string | One-line pitch for listings (~70 chars). |
| `description` | string | Full description. Shown on the detail page. |
| `category` | string | One of the curated category slugs. |
| `tags` | string[] | Free-form tags for search and filtering. |
| `author` | object | `{ name, url }` shown on the detail page. |
| `license` | string | SPDX identifier. |
| `homepage` | string? | Optional project URL. |
| `repository` | string? | Optional source repository URL. |
| `agent.defaults` | object | Defaults for OpenClaw registration: `model`, `thinking`, etc. |
| `files` | string[] | Glob patterns defining the package payload. |
| `dependencies.plugins` | object[] | Plugin specs resolved at install time. |
| `dependencies.skills` | object[] | Skill slugs resolved at install time. |
| `dependencies.providers` | object | `{ any: [...] }` — acceptable runtime providers. |
| `setup.secrets` | object[] | Secrets prompted at install time. Keys only, never values. |
| `store.icon` | string? | Path to icon file (relative to package root). |
| `store.screenshots` | string[]? | Paths to screenshot files. |
| `openclaw.entrypoints` | object | Maps package files to canonical OpenClaw workspace filenames. |
| `openclaw.templates` | object | Write-once files materialized at first install only. |

## File rules

### Allowed file types

Markdown, JSON, YAML, TOML, CSV, TSV, plain text, and images (PNG, JPG, SVG, WebP).

### Rejected (hard fail)

- Any file with an executable bit set
- Blocked extensions: `.sh`, `.bash`, `.zsh`, `.js`, `.ts`, `.mjs`, `.cjs`, `.py`, `.rb`, `.php`, `.exe`, `.bat`, `.ps1`, `.dll`, `.so`, `.dylib`
- Known binary executable formats (ELF, Mach-O, PE)
- Files containing API-key-like strings (AWS keys, OpenAI keys, etc.)

### Size limits

| Limit | Value |
|-------|-------|
| Total package size | 100 MB |
| File count | 10,000 |
| Individual text file (warning) | 1 MB |
| Individual asset file | 10 MB |

## Workspace file lifecycle

| File | Lifecycle | Notes |
|------|-----------|-------|
| `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md` | Package-managed | Replaced on every update. |
| `BOOTSTRAP.md` | Package-managed with exception | If the operator deletes it, updates won't recreate it. |
| `USER.md` | Write-once template | Materialized at first install, then operator-owned forever. |
| `MEMORY.md` | Never package-managed | Always operator-owned. Preserved across updates and uninstalls. |

## The user-state boundary

Hard rules enforced by code:

- `MEMORY.md` is **never** package-owned. Packages cannot ship or manage it.
- `USER.md` is template-once, then operator-owned.
- Operator-created files (notes, logs) are preserved unless the operator explicitly opts into deletion.
- Updates only replace package-managed files.
- Uninstalls offer to preserve user-managed files by default.

## Dependencies

### Plugins

```json
{ "spec": "clawhub:@someone/nutrition-api", "required": true, "minVersion": "1.2.0" }
```

Resolved via `openclaw plugins install` at install time. Required plugins block install on failure; optional plugins prompt the operator.

### Skills

```json
{ "slug": "food-search", "required": false }
```

Resolved via `openclaw skills install` through ClawHub.

### Providers

```json
"providers": { "any": ["anthropic", "openai"] }
```

At install, Clawstore checks the operator has at least one matching provider configured.

### Secrets

```json
{
  "key": "NUTRITIONIX_API_KEY",
  "prompt": "Nutritionix API key",
  "required": true,
  "target": "env"
}
```

Prompted at install time. Values are written to `~/.openclaw/.env` and **never** stored in Clawstore's install records.

## Package ID

IDs follow the `@scope/name` pattern:

- **Scope** is your GitHub username (lowercased), assigned automatically
- **Name** is kebab-case, 2-64 characters (`a-z`, `0-9`, `-`)
- IDs are **immutable** after first publish — rename by publishing a new ID and yanking the old one
- One owner per ID — first publish claims it
