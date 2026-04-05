# Clawstore - Implementation Plan

This document is the implementation plan for Clawstore, a third-party app store for [OpenClaw](https://github.com/openclaw/openclaw) agents. The product goal is simple: ship complete agents the way an app store ships apps, while keeping executable dependencies separate.

Clawstore distributes the agent app.
ClawHub and native OpenClaw flows distribute the dependencies.

That separation is the whole point of the design:

- Clawstore packages are inert, inspectable content.
- Skills and plugins remain external dependencies.
- OpenClaw stays the runtime and system of record for agent registration, workspace loading, plugin installation, skills installation, and secrets/config wiring.

Publish and update lifecycles are worked out in depth because those are the mechanics that make or break trust in an app-store-like experience.

---

## 1. Architecture overview

```
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ Package author   │  PR    │ Registry repo    │  CI    │ catalog.json     │
│ local machine    │───────▶│ (GitHub monorepo)│───────▶│ + per-package    │
│ clawstore CLI    │        │                  │        │ JSON blobs       │
└──────────────────┘        └──────────────────┘        └──────────────────┘
                                                                  │
                                                                  │ CDN / Pages
                                                                  ▼
                                                          ┌────────────────┐
                                                          │  clawstore.dev │
                                                          │  (static site) │
                                                          └────────────────┘
                                                                  │
                                                                  │ install
                                                                  ▼
┌──────────────────┐        ┌──────────────────┐        ┌─────────────────────────┐
│ End user         │        │ clawstore CLI    │        │ OpenClaw + ClawHub      │
│ `clawstore       │───────▶│ installer/update │───────▶│ agents, plugins, skills │
│ install X`       │        │ glue             │        │ secrets, runtime        │
└──────────────────┘        └──────────────────┘        └─────────────────────────┘
```

Six parts, all independently shippable:

1. **Agent package format** - the contract between authors and the registry.
2. **Registry repo** - a public GitHub monorepo of versioned agent packages. Publish = PR.
3. **Catalog builder** - CI job that walks the registry, validates packages, and produces `catalog.json` plus per-package detail blobs.
4. **Discovery website** - static site that reads the catalog and renders browse, search, and detail pages.
5. **Clawstore CLI** - local tool for authors (`validate`, `pack`, `preview`, `publish`) and operators (`install`, `update`, `uninstall`, `doctor`, `rollback`).
6. **Install glue** - the part of the CLI that translates an agent package install into the correct sequence of OpenClaw and ClawHub actions.

Clawstore owns all six. None of them patch OpenClaw core.

### Product boundary

This is the key product decision:

- **Clawstore ships agent apps.**
- **ClawHub ships skills and plugins.**
- **OpenClaw runs the installed agent.**

That means a package can declare:

- required plugins
- optional plugins
- required skills
- optional skills
- provider prerequisites
- setup steps such as secrets/config targets

But the package itself cannot contain vendored plugins, vendored skills, or executable runtime code.

The operator should experience this like a normal app install:

1. Install the agent package.
2. Review the dependencies it needs.
3. Approve installation of those dependencies from their own source of truth.
4. Start using the agent.

---

## 2. Agent package format

The unit Clawstore distributes is a complete **agent package**.

An agent package is not "a skill bundle with extra markdown." It is the vendor-managed portion of a full OpenClaw agent product:

- store metadata
- persona and operating instructions
- vendor-managed workspace files
- dependency declarations
- setup requirements
- install/update metadata

### What the package owns

The package owns the files that should be installed or updated as part of the app itself.

Examples:

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- curated reference markdown
- JSON or CSV data files
- screenshots and icon assets for the store

### What the package does not own

The package does not own:

- plugins
- ClawHub skills
- executable code
- user state
- secrets
- OpenClaw session/auth state

Those are declared or referenced, not bundled.

### Workspace model

Clawstore should think in terms of a vendor-managed workspace tree, not only the four canonical files.

The package installs a set of vendor-managed files into the target workspace.
Some of those files are mounted to OpenClaw's canonical bootstrap filenames at the workspace root.
Other files are copied as supporting content under their relative paths.

User-managed files are explicitly excluded from package ownership and preserved across updates and uninstalls.

### Package layout

Freeform directory layout owned by the author. The only hard requirement is a manifest at the root.

### Example package

```
calorie-coach/
├── agent.json
├── app/
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
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

### `agent.json`

```json
{
  "schemaVersion": 1,
  "id": "calorie-coach",
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
    "screenshots": ["store/screenshots/*.png"]
  },

  "openclaw": {
    "entrypoints": {
      "AGENTS.md": "app/AGENTS.md",
      "SOUL.md": "app/SOUL.md",
      "TOOLS.md": "app/TOOLS.md",
      "IDENTITY.md": "app/IDENTITY.md",
      "HEARTBEAT.md": "app/HEARTBEAT.md",
      "BOOT.md": "app/BOOT.md",
      "BOOTSTRAP.md": "app/BOOTSTRAP.md"
    },
    "templates": {
      "USER.md": "app/USER.template.md"
    }
  }
}
```

### Manifest semantics

- `files` defines the package payload, similar to `package.json`.
- `dependencies.plugins` declares plugins to install separately through OpenClaw.
- `dependencies.skills` declares skills to install separately through ClawHub / OpenClaw skills flows.
- `setup.secrets` declares setup requirements and target semantics. The package never stores secret values.
- `openclaw.entrypoints` maps package files to OpenClaw's canonical workspace filenames.
- `openclaw.templates` maps package-provided starter files that should be written only when missing.

### Workspace file conventions

Clawstore should support the standard OpenClaw workspace file set, but not every file should have the same lifecycle.

- `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `HEARTBEAT.md`, `BOOT.md`, `BOOTSTRAP.md`
  - normal package-managed entrypoints
  - installed and updated like app-owned files
  - exception: if the operator deletes `BOOTSTRAP.md` after first-run completion, Clawstore should not recreate it on update
- `USER.md`
  - usually templated
  - package provides a starter version, but operators are expected to personalize it
  - once written, Clawstore preserves the user's copy on update
- `MEMORY.md`
  - never package-managed
  - always treated as user state

### Dependency contract

Dependencies are outside the package trust boundary.

- A required plugin may block install if missing.
- An optional plugin may be offered during install.
- A required skill may block install or prompt for installation.
- An optional skill should be offered but never silently installed without consent.

Clawstore should show these as external dependencies, not as package contents.

### What ships, what doesn't

- **Allowed**: markdown, JSON, YAML, CSV, TSV, plain text, images (PNG/JPG/SVG/WebP), TOML.
- **Flagged**: PDFs or opaque binaries the agent cannot consume without a declared dependency.
- **Rejected by registry CI**: executable files, files with executable permission bits set, and blocked code-bearing extensions such as `.sh`, `.bash`, `.zsh`, `.js`, `.ts`, `.py`, `.rb`, `.php`, `.exe`.
- **Size limit**: 100 MB per package, 10,000 files per package, 1 MB per text file as a soft warning, 10 MB per asset file.

### User-state boundary

This is a hard rule:

- `MEMORY.md` is not package-owned.
- `USER.md` is normally operator-owned after initial template materialization.
- if the operator deleted `BOOTSTRAP.md`, Clawstore must not recreate it on update
- notes, logs, and ad hoc user data are not package-owned unless the package explicitly ships and manages them.
- package updates may replace package-managed files only.
- uninstall must offer to preserve user-managed files by default.

### Versioning

- Semver. `MAJOR.MINOR.PATCH`.
- Breaking = behavior changed in a way that invalidates user expectations, required dependencies were added or changed incompatibly, required setup changed incompatibly, or the package license changed.
- Registry rejects a PR whose `version` is less than or equal to the current published version for the same `id`.

---

## 3. Registry structure

### Layout

```
clawstore-registry/                 ← public GitHub repo
├── agents/
│   ├── calorie-coach/
│   │   ├── 0.3.1/                  ← one folder per published version
│   │   │   ├── agent.json
│   │   │   ├── ...all agent files
│   │   ├── 0.3.0/
│   │   └── latest -> 0.3.1         ← symlink, tracks latest stable
│   ├── daily-standup/
│   └── code-reviewer/
├── categories.json                 ← curated list (id, name, icon, order)
├── featured.json                   ← editor picks, rotated
├── verified.json                   ← verified-author allowlist
├── schema/
│   └── agent.schema.json           ← JSON schema for agent.json
├── tools/
│   ├── validate.ts                 ← shared validator used by CI + clawstore CLI
│   └── build-catalog.ts            ← generates catalog.json from the repo
└── .github/
    └── workflows/
        ├── validate-pr.yml
        └── deploy-catalog.yml
```

### Why "versioned folders"

Keeping each published version in its own directory — instead of a single folder that gets overwritten — means:

- `clawstore install calorie-coach@0.2.0` works (install a specific version).
- Authors can't silently rewrite history.
- Diffs on updates are clean git diffs against a different directory.
- The CDN can cache each version path forever (content-addressed).

`latest` is a symlink (or a JSON pointer in `catalog.json`) so the website always knows the current stable. Pre-releases get their own version folder and a `channel: "beta"` field in the manifest; `latest` does not point at beta.

### Branch protection

- `main` is protected. No direct pushes.
- PRs require passing CI (`validate-pr.yml`) + one maintainer review.
- Merge to `main` triggers `deploy-catalog.yml`: rebuild `catalog.json`, push to CDN, invalidate cache.

---

## 4. The publish flow (detailed)

This is the author's experience, from "I have a working agent on my machine" to "my agent is live on the store."

### Step 0: Author has a working agent

Author has been using an OpenClaw agent they built locally — workspace has real `AGENTS.md` / `SOUL.md` / `USER.md` / `TOOLS.md` / `IDENTITY.md`, plus whatever knowledge files they've accumulated under their workspace. They want to share it.

### Step 1: `clawstore init`

```
$ cd ~/.openclaw/workspace-calorie-coach
$ clawstore init
```

- Scans the current directory for the canonical workspace entrypoint files.
- Prompts for `id`, `name`, `tagline`, `category`, `license`.
- Detects plugins currently configured for this agent (reads `openclaw agents list --json` and filters by id) and offers to pre-fill `dependencies.plugins`.
- Detects secrets the agent currently uses and offers to pre-fill `setup.secrets` (names only, never values).
- Writes an `agent.json` draft.
- Writes a starter `README.md` for the agent (the store-facing description).

Outcome: the workspace is now *also* a clawstore agent package. The author keeps using the workspace with OpenClaw as before; the presence of `agent.json` at the package root does not disturb OpenClaw.

### Step 2: `clawstore validate`

```
$ clawstore validate
```

Pure local, no network. Runs the same validator the registry CI runs. Reports:

- Schema errors in `agent.json`.
- Entrypoint resolution errors (files named in `openclaw.entrypoints` or `openclaw.templates` that do not exist in the package tree).
- `files` glob results (shows the full list of files that would be shipped).
- Size and file-count against limits.
- Broken internal references (e.g. `AGENTS.md` says "read knowledge/foods/fruits.md" but no such file exists in the package).
- Executable / rejected file-type findings.
- Warnings for binaries, oversize individual files, suspicious patterns (phone numbers, email addresses, obvious API-key-looking strings in shipped content).

Fast feedback loop. The author runs this until it's clean.

### Step 3: `clawstore pack`

```
$ clawstore pack
```

- Produces a local tarball (`calorie-coach-0.3.1.tgz`) of exactly what would be published.
- Runs validate first; refuses to pack if validate fails.
- Writes a manifest of file hashes alongside the tarball for later integrity checks.

### Step 4: `clawstore preview`

```
$ clawstore preview
```

- Installs the packed tarball into a **scratch workspace** under `~/.clawstore/preview/<agent-id>/` — completely isolated from the author's real OpenClaw config.
- Does NOT touch `agents.list`, does NOT install real plugins (uses stub plugin manifests to simulate resolution).
- Lets the author `cd` into the scratch workspace and inspect exactly what users will see — the resolved entrypoint files, the copied `knowledge/` tree, everything.
- `clawstore preview --run` goes one step further: temporarily registers the scratch workspace with an ephemeral OpenClaw agent via `openclaw agents add` and drops into an interactive session. Useful for "does this actually feel right" checks. Cleans up with `openclaw agents delete` on exit.

### Step 5: Submit as a PR

```
$ clawstore publish
```

- Ensures the agent validates cleanly.
- Computes the version folder path (`agents/<id>/<version>/`).
- Either:
  - **Automated path**: forks the registry repo via `gh` CLI, adds the agent files under the versioned folder, updates the `latest` pointer, opens a PR with a generated description that includes the agent's `tagline`, `description`, screenshots, and the full diff.
  - **Manual path**: prints instructions and a ready-to-use branch so the author can push and open the PR themselves.

### Step 6: Registry CI (`validate-pr.yml`)

Runs on every PR. Checks:

1. **Schema**: `agent.json` validates against `schema/agent.schema.json`.
2. **File inventory**: every file in the PR's agent dir matches the agent's `files` globs.
3. **Entrypoint resolution**: `openclaw.entrypoints` and `openclaw.templates` map to real files in the package tree.
4. **Executable scan**: no exec bits, no known binary formats, no blocked extensions.
5. **Size limits**: enforced.
6. **Version monotonicity**: new version is strictly greater than any previous version for the same `id`.
7. **Ownership**: the `id` is either unclaimed or already owned by the PR author (tracked by a simple `agents/<id>/OWNERS` file on first publish).
8. **Secret scanning**: run a secrets-detection pass over all shipped text files. Failing here is a hard reject (you don't want a user's leaked key in your registry).
9. **Plugin reachability**: for each `dependencies.plugins[]`, confirm the referenced spec actually resolves (ClawHub entry exists, npm package exists, git URL responds).
10. **Render preview**: CI generates a preview of how the detail page would look and posts it as a PR comment so the maintainer can visually review.

### Step 7: Maintainer review

The maintainer reviews the PR like any GitHub PR. Markdown is human-readable, so this is fast. Checks:

- Is the content safe and appropriate?
- Is the category correct?
- Does the personality file match the claimed use case?
- Any concerning patterns CI didn't catch (prompt injection attempts, manipulative framing, content that violates the store's policy)?

For MVP, the store has a single tier: published agents. Verified/trusted authors get added to `verified.json` manually and their subsequent updates can be fast-tracked (auto-merge on green CI).

### Step 8: Merge → deploy

On merge to `main`:

1. `deploy-catalog.yml` runs.
2. `tools/build-catalog.ts` walks `agents/`, reads every published version, produces:
   - `catalog.json` — flat array of agents with minimal metadata (id, version, name, tagline, category, tags, icon URL, install count placeholder).
   - `agents/<id>.json` — per-agent detail blob (full description, rendered entrypoint files, file tree, changelog, screenshots).
   - `search-index.json` — precomputed Lunr/MiniSearch index over name, tagline, description, tags, and full text of all entrypoint files and all included markdown.
3. Outputs uploaded to CDN (Cloudflare R2 or Vercel's static asset host).
4. Website rebuild triggered (Vercel/Cloudflare Pages detects the CDN change and redeploys).
5. Agent is live. Install count for v1 is "∞" or hidden because there's no telemetry yet.

### Updating an existing agent

An author publishing `0.3.1 → 0.4.0` repeats steps 2-7. The registry rejects a re-published `0.3.1`. `clawstore publish` helps by bumping the version automatically, prompting the author to choose major/minor/patch and summarize the changes for the changelog.

---

## 5. The update flow (detailed)

The user-side counterpart to publish. This is the flow that determines whether users trust the store long-term.

### Update detection

Three modes, per installed agent, controlled by the agent's `updatePolicy` field in the user's local install record (not in the agent manifest — the user chooses):

- **`manual`** (default): user runs `clawstore update check` or `clawstore update <agent-id>`. Nothing happens automatically.
- **`prompt`**: clawstore CLI checks for updates on every invocation (cheap — one HTTP call to `catalog.json`) and prints a single line at the bottom of any command output: *"2 updates available. Run `clawstore update` to review."*
- **`auto`**: new stable versions (not pre-releases, not major bumps) install silently at next check. Major bumps still prompt.

Users opt into each mode per agent. Global default is `manual` because auto-updating third-party content on someone's machine without explicit consent is exactly the kind of thing that gets stores banned.

### The update command

```
$ clawstore update calorie-coach
```

Full sequence:

#### 5.1 Resolve

- Read local install record at `~/.clawstore/installs/calorie-coach.json` — knows current version, install timestamp, workspace path, plugin deps at install time, snapshot IDs.
- Fetch `catalog.json`, look up `calorie-coach`, compare versions.
- If no newer version: exit 0 with "already up to date."
- If newer version: fetch `agents/calorie-coach.json` detail blob and the full agent tarball for the new version.

#### 5.2 Show the diff

Before touching anything, show the user exactly what changes:

```
Calorie Coach 0.3.1 → 0.4.0

Files changed:
  M  AGENTS.md                            (rules/nutrition.md updated)
  M  knowledge/nutrition/macros.md
  A  knowledge/foods/restaurants.md       (NEW — 12 chains added)
  D  knowledge/foods/old-data.md          (removed)

Plugin dependencies:
  @someone/nutrition-api  1.2.0 → 1.3.0   (minor bump, will update)
  @someone/image-vision   unchanged

Secrets required:
  NUTRITIONIX_API_KEY     already configured
  OPENAI_API_KEY          NEW — will prompt

User files (preserved):
  MEMORY.md
  notes/ (4 files)

Proceed? [Y/n]
```

The file list comes from comparing the vendor-managed file set of the old install against the new agent's resolved file set. This is the most important part of the UX: the user sees exactly what's about to happen.

#### 5.3 Snapshot

- Compress the current workspace's vendor-managed files to `~/.clawstore/snapshots/calorie-coach/<timestamp>.tgz`.
- Record the snapshot id in the install record.
- Keep the last 5 snapshots per agent. Older ones get garbage-collected.

#### 5.4 Validate the new agent

- Run the same validator that ran at publish time.
- This should always pass (CI already enforced it), but re-check locally. If it fails, abort and leave the current install untouched.

#### 5.5 Resolve plugin changes

- For each plugin in new `dependencies.plugins` that either (a) didn't exist in the old version or (b) has a changed `minVersion`: run `openclaw plugins install <spec>`.
- For each plugin that was removed from `dependencies.plugins`: do NOT uninstall it automatically. Other agents or the user may depend on it. Record the removal in the install record so `clawstore uninstall` can offer to clean it up later.
- If any plugin install fails, abort before touching workspace files.

#### 5.6 Resolve secret changes

- For each new entry in `setup.secrets[]`: prompt the user for the value. For `target: "env"` secrets, clawstore writes the key/value to `~/.openclaw/.env` (OpenClaw loads secrets from there). Clawstore never stores secret values in its own install record.
- For removed secrets: leave them in place. The user may still need them for other purposes.

#### 5.7 Apply workspace changes atomically

Standard safe-update pattern:

1. Create a staging directory `~/.clawstore/staging/calorie-coach-0.4.0/`.
2. Extract the new agent into staging.
3. Apply the `openclaw.entrypoints` mapping (copy entrypoint-mapped files to their canonical workspace filenames at the workspace root).
4. Write any `openclaw.templates` entries only if the target file does not already exist in the current workspace (templates are write-once).
5. Apply the `files` globs to copy the remaining vendor-managed tree into staging.
6. Copy user-managed files from the current workspace into staging: `MEMORY.md`, any previously materialized `USER.md`, and `BOOTSTRAP.md` only if the operator still has it (deleted `BOOTSTRAP.md` must not be recreated).
7. **Rename** the current workspace to `~/.clawstore/graveyard/calorie-coach-<timestamp>/` (not delete — rename is atomic on POSIX and gives us a rollback escape hatch).
8. **Rename** staging into the workspace path.
9. If any step fails mid-way: rename graveyard back, abort with a clear error.

The graveyard directory gets cleaned up on the next successful update or an explicit `clawstore prune`.

#### 5.8 Update agent config (if needed)

- Compare old `agent.json agent.defaults` to new.
- If `model` / `thinking` / any other agent-level default changed: OpenClaw has no in-place `agents update` command, so the documented path is `openclaw agents delete <id>` followed by `openclaw agents add <id> --workspace <path> --model <model>` using the same workspace path. This preserves workspace and session state.
- If nothing at the `agents.list` level changed: do not touch the entry. Leave the user's customizations (if any) alone.

#### 5.9 Record the new state

- Write the updated install record with new version, new snapshot id, new timestamp, new resolved plugin versions.
- Print the success message with a "rollback with `clawstore rollback calorie-coach`" hint.

### Rollback

```
$ clawstore rollback calorie-coach
```

- Reads the last snapshot from the install record.
- Extracts it into a fresh staging dir.
- Same atomic rename as update.
- Updates the install record's version back to the previous one.
- Does NOT revert plugin updates (those may have been shared with other agents). Prints a notice about plugin versions it can't roll back.

### Failure modes we need to handle gracefully

| Failure | Behavior |
|---|---|
| Network down during fetch | Abort before any workspace changes |
| Validation fails on new agent | Abort, keep old install |
| Plugin install fails mid-update | Abort, keep old install, clear staging |
| User cancels at diff prompt | Abort, nothing touched |
| Disk full during rename | Graveyard is still intact, rename back, abort |
| User Ctrl-C during rename | Same — graveyard recovery |
| Process killed between renames | On next clawstore invocation, detect orphaned graveyard, offer to recover |

---

## 6. The install flow (summary)

Covered in less detail since publish + update are where the real complexity lives.

```
$ clawstore install calorie-coach
```

1. Resolve the agent from the catalog (or from a direct URL / tarball for sideloading).
2. Validate locally.
3. Show what will be installed (same diff UI as update, but "all new files").
4. Prompt for consent.
5. Resolve + install plugin deps via `openclaw plugins install`.
6. Prompt for required secrets; for `target: "env"` entries clawstore writes to `~/.openclaw/.env`. Clawstore never stores secret values itself.
7. Create the workspace directory (default: `~/.openclaw/workspace-<id>/`, matching OpenClaw's documented convention).
8. Apply `openclaw.entrypoints` mapping + `openclaw.templates` (write-once) + `files` globs to populate the workspace.
9. Take an initial snapshot (so a later rollback has something to revert to — it becomes a "fresh install" restore).
10. Call `openclaw agents add <id> --workspace <path>` with the agent's `agent.defaults`.
11. Write the install record.
12. Print the ready-to-use command hint for starting the agent.

### Sideloading

`clawstore install ./my-agent.tgz` or `clawstore install https://example.com/agent.tgz` uses the same flow but skips the catalog lookup. For development and private sharing. Marked in the install record as `source: "sideload"` so it is never auto-updated by catalog polling.

---

## 7. The uninstall flow (summary)

```
$ clawstore uninstall calorie-coach
```

1. Read the install record.
2. Call `openclaw agents delete <id>` to remove the `agents.list` entry.
3. Prompt: preserve user files? *Default yes.* If yes, move `MEMORY.md`, any materialized `USER.md`, and any other user-managed files to `~/.clawstore/orphans/calorie-coach-<timestamp>/` so the user can recover them.
4. Prompt: uninstall plugin deps? Show the list with a note for each one of "also used by <other agents>" or "not used elsewhere". Default NO. Safer to leave plugins installed; users who care can prune manually.
5. Delete the workspace directory.
6. Remove the install record.
7. Keep snapshots in place for a configurable period (default 30 days) in case the user reinstalls and wants their old data back.

---

## 8. Doctor / repair flow

```
$ clawstore doctor
$ clawstore doctor <agent-id>
$ clawstore doctor --fix
```

Detects and optionally fixes drift between what the install record says and what's actually on disk:

- Workspace directory missing.
- Entrypoint file missing or hash mismatch (user edited a vendor-managed file; we warn, offer to re-copy).
- Plugin dep missing (plugin was uninstalled out of band — detected via `openclaw plugins list`).
- Secret declared in `setup.secrets` but missing from `~/.openclaw/.env` (for `target: "env"` entries).
- Install record references a version no longer in the catalog (orphaned install — still works, but future updates unavailable).
- Stale graveyard directories from interrupted updates.
- Stale snapshot files beyond retention.

`--fix` runs a re-install against the recorded version without touching user files.

---

## 9. CLI command surface

Organized by persona.

### Author commands

```
clawstore init                      # scaffold agent.json in current dir
clawstore validate [path]           # lint an agent package
clawstore pack [path]               # produce a local tarball
clawstore preview [path] [--run]    # install into scratch workspace
clawstore publish [path]            # open a registry PR
clawstore diff <id> [version]       # compare local agent to a published version
```

### User commands

```
clawstore install <id>[@version]    # or a URL / tarball path for sideload
clawstore uninstall <id>
clawstore update [id]               # update one or all
clawstore update check              # dry run — show what's available, don't install
clawstore list                      # installed agents
clawstore search <query>            # hits catalog + search-index
clawstore info <id>                 # detail, mirrors the website detail page in the terminal
clawstore rollback <id>             # restore last snapshot
clawstore doctor [id] [--fix]
clawstore prune                     # clean up graveyards, old snapshots, orphans
clawstore policy <id> manual|prompt|auto   # set update policy per agent
```

### Internal / hidden

```
clawstore _debug install-record <id>   # dump install record JSON
clawstore _debug snapshots <id>        # list snapshots
clawstore _debug catalog fetch         # refetch + print catalog
```

---

## 10. Registry CI pipeline

### `validate-pr.yml`

Triggered: pull request opened, synchronized, reopened.

Jobs:

1. **Lint** — run `tools/validate.ts` on the changed agent(s). Post findings as PR comments inline on the offending lines.
2. **Security** — executable scan + secret scan + known-bad pattern scan. Hard fail on any finding.
3. **Schema** — validate `agent.json` against the JSON schema.
4. **Version check** — new version > previous versions for the same `id`.
5. **Ownership** — PR author matches `OWNERS` for the `id`, or `id` is unclaimed.
6. **Plugin reachability** — every plugin spec in `dependencies.plugins` resolves.
7. **Render preview** — generate a Markdown summary that mimics the website detail page and post as a PR comment.

### `deploy-catalog.yml`

Triggered: push to `main`.

Jobs:

1. **Build catalog** — run `tools/build-catalog.ts` to generate `catalog.json`, per-agent detail blobs, search index.
2. **Upload to CDN** — Cloudflare R2 or similar. Content-addressed paths per version; `latest` is a small pointer file that gets overwritten.
3. **Invalidate** — purge the CDN cache for `catalog.json` and `latest` pointers only (versioned paths are immutable, don't need invalidation).
4. **Trigger site rebuild** — webhook Vercel/Cloudflare Pages.
5. **Smoke test** — after deploy, fetch `catalog.json` from the public URL and confirm the new version is reachable.

---

## 11. Discovery website

### Stack (proposal, not locked)

- **Astro** or **Next.js static export** — fast, static, easy to deploy.
- **Tailwind** for styling.
- **MiniSearch** or **Lunr** for client-side search (reads `search-index.json`).
- **Markdown rendering**: `remark` + `rehype-highlight` + a custom component for internal agent file references (click a link like "read knowledge/foods/fruits.md" and expand that file inline).
- **Deploy**: Cloudflare Pages or Vercel. Both have generous free tiers and good cache invalidation.

### Pages

- `/` — home. Featured, trending (by recent changes as a proxy until install telemetry exists), new this week, all categories.
- `/browse/[category]` — category listing, alphabetical unless the category is specifically about runtime order.
- `/agent/[id]` — detail page. Icon, tagline, description, screenshots, rendered `SOUL.md` inline (hero section), rendered `AGENTS.md` below, file tree browser with click-to-preview, required plugins as badges (link to each plugin's page if we eventually have one), required secrets as a "you'll need" callout, author, version, changelog, install command.
- `/agent/[id]/files/[...path]` — individual file previews. Rendered markdown for MDs, pretty-printed JSON, raw for unknown.
- `/search?q=...` — search results. Filters by category, tag, required plugin.
- `/publish` — static docs: how to publish an agent, link to the author CLI docs, link to the schema.
- `/policy` — what's allowed, what isn't, how to report a problem.
- `/about` — what clawstore is, relationship to OpenClaw and ClawHub, who runs it.

### "Install" button UX

MVP: generates a one-liner copy-paste:

```
clawstore install calorie-coach
```

Post-MVP: custom URL scheme `clawstore://install?id=calorie-coach` registered by the CLI at install time. Clicking the button launches the CLI directly. Nice polish but has cross-platform quirks (OS registration, browser security prompts), so it's v2.

---

## 12. Trust and security model

### What clawstore enforces

- **Agents are inert content.** No executables. Enforced by CI.
- **Plugin deps flow through OpenClaw's security scan.** We don't re-implement plugin security; we rely on OpenClaw's existing `install-security-scan` and update pipeline (invoked by `openclaw plugins install`).
- **Human-readable review.** All content is markdown or well-known data formats. Maintainers can actually read and judge agents before publishing.
- **Versioned, immutable publishes.** You can't silently change an already-published version. You can only publish a new version.
- **Secret scanning at publish time.** Reject agents that contain API-key-looking strings in shipped content.

### What clawstore doesn't enforce (but should in v2)

- **Cryptographic signing.** MVP trusts git commit signatures + GitHub auth. v2 adds a per-author signing key, stored in `OWNERS`, and CI verifies agent signatures.
- **Content moderation at scale.** MVP is maintainer PR review. If the store succeeds, this won't scale and needs automation.
- **Prompt-injection analysis.** A malicious agent could craft content designed to jailbreak the user's other agents via shared context. Out of scope for MVP. Flag for post-MVP.

### The one hard line

No code in agents. Ever. The moment agents can run code, the security story collapses into "re-invent plugin sandboxing," and clawstore loses its main differentiator — that agents are auditable by humans in under a minute.

If an agent needs runtime behavior beyond reading files, it adds a plugin to `dependencies.plugins`. That plugin goes through OpenClaw's existing security review. Clean separation.

---

## 13. MVP scope

**In scope for MVP:**

- Agent format (`agent.json` schema, validator, JSON schema file)
- One reference agent (`calorie-coach` as the canonical example — built end-to-end)
- Clawstore CLI: `init`, `validate`, `pack`, `preview`, `publish`, `install`, `update`, `uninstall`, `list`, `info`, `rollback`, `doctor`
- Registry repo with CI (`validate-pr.yml`, `deploy-catalog.yml`)
- Catalog builder
- Discovery website: home, category browse, detail page, file preview, search
- Manual update policy by default
- `setup.secrets[].target: "env"` only — writes to `~/.openclaw/.env`. Other target kinds come later if needed.

**Explicitly NOT in MVP:**

- Payments
- Ratings or reviews
- Install telemetry
- Auto-update as a global default
- Shared knowledge packs between agents
- Localization
- Custom URL scheme for one-click install
- Cryptographic agent signing
- Automated content moderation
- Paid publishing
- Admin dashboard (just a git repo + a website)
- Author-declared `preserve` patterns in the manifest (the user-state boundary is convention-based for MVP)

---

## 14. Open questions

1. **CLI stack**: Node + TypeScript (easiest interop with OpenClaw's own stack) vs Go (single static binary) vs Rust (performance + single binary). Recommendation: TypeScript for MVP because we'll be shelling out to the `openclaw` CLI and reading OpenClaw config files anyway, and Node is already on every OpenClaw user's machine.
2. **Registry repo hosting**: GitHub (assumed) or self-host Gitea? GitHub is the right call for MVP — discoverability, `gh` CLI integration, free CI.
3. **Website stack**: Astro vs Next.js static export. Astro is slightly simpler for content-heavy sites; Next.js is more familiar. Pick the one the implementer knows best.
4. **Maximum agent size**: 100 MB feels right but we have no data. May need to lower or raise based on first real agents.
5. **Shared knowledge packs timing**: when does this become necessary? First time two unrelated agents both ship the same 5 MB of nutrition data. Until then, duplication is fine.
6. **Verified tier**: when do we introduce it? Probably when there are ~20 agents and duplicate-of-existing-agent spam starts appearing.
7. **Telemetry stance**: do we want install counts ever? If yes, it requires a backend — decide before committing to a fully static MVP.
8. **Payments**: same. If there's any chance we want paid agents, the `agent.json` schema should leave a `price` field as reserved (even if always `"free"`) so we don't have to break compat later.
9. **Do we fork openclaw to get an `onUpdate` hook for agents?** No — stays on public contracts only. Any config updates flow through `openclaw agents add` / `openclaw agents delete` as documented.
10. **Name** — `clawstore` is a working name. Final decision before public launch.
11. **Author-declared preserve patterns** — deliberately excluded from the MVP manifest. Revisit only if a real agent needs to preserve a subtree that isn't already covered by the convention-based user-state boundary (`MEMORY.md`, materialized `USER.md`, operator-deleted `BOOTSTRAP.md`).

---

## 15. Suggested milestones

In order, with each milestone independently shippable and testable:

1. **Agent format v1 frozen**: `agent.schema.json` committed to this repo, test fixtures, schema doc.
2. **Reference agent**: a real `calorie-coach` built end-to-end as the worked example. Becomes the first registry entry AND the test fixture for the validator.
3. **Validator library**: pure function, takes an agent package directory, returns a structured error report. Used by CLI and registry CI both.
4. **Clawstore CLI — author side**: `init`, `validate`, `pack`, `preview`. No network. No end-user commands yet. Ship early for dogfooding.
5. **Registry repo scaffolding**: schema file, `OWNERS` pattern, empty `agents/` dir, CI workflows wired, `categories.json` seeded.
6. **Clawstore CLI — user side against a local registry**: `install`, `update`, `uninstall`, `list`, `rollback`, `doctor`. Targets a locally-cloned registry path instead of a CDN. Everything works except discovery.
7. **Catalog builder**: produces `catalog.json` + detail blobs + search index. Tested by pointing milestone 6's CLI at catalog output instead of raw registry.
8. **Discovery website**: home, categories, detail, file preview, search. Points at a local catalog first, then at a real CDN.
9. **End-to-end publish against a real registry**: first agent submitted via PR, merged, appears on the site, installed via the CLI. This is the "it works" milestone.
10. **Second and third real agents**: different categories, different plugin dependency shapes. Exercises the flows with variety.
11. **Update flow hardening**: snapshots, rollback, graveyard recovery, atomic rename, failure-mode tests. Only once step 9 proves the happy path.
12. **Public launch prep**: docs, publish/policy pages, contribution guide, a small featured list, launch blog post.

---

## Appendix A — Files touched by clawstore on the user's machine

For auditability. Clawstore creates and manages files at these paths:

```
~/.clawstore/
├── config.json                           # user prefs: default update policy, registry URL
├── catalog-cache/                        # last fetched catalog, with etag
├── installs/
│   └── <agent-id>.json                   # install record per agent
├── snapshots/
│   └── <agent-id>/
│       └── <timestamp>.tgz               # last N vendor-managed state snapshots
├── graveyard/                            # renamed-not-deleted old workspaces, cleaned by prune
├── orphans/                              # user files preserved from uninstalls
├── staging/                              # in-flight install/update work, cleaned on success
└── preview/                              # scratch workspaces for `clawstore preview`
```

The actual agent workspace lives under `~/.openclaw/workspace-<id>/` (matching OpenClaw's documented convention from `docs/concepts/agent-workspace.md` and `docs/concepts/multi-agent.md`). That's OpenClaw's territory; clawstore only populates it.

Clawstore may also write to `~/.openclaw/.env` when an installed agent declares `setup.secrets[].target: "env"`. That file is OpenClaw's documented location for known secret keys.

## Appendix B — What we rely on OpenClaw for

Public surfaces only (verified against the OpenClaw docs in the sibling repo):

- `openclaw plugins install <spec>` — install plugin dependencies declared in `dependencies.plugins`.
- `openclaw plugins list` — check current plugin state for drift detection in `clawstore doctor`.
- `openclaw skills install <slug>` — install skill dependencies declared in `dependencies.skills` (ClawHub flow).
- `openclaw agents add <id> --workspace <path> --model <model>` — register the agent in `agents.list` after the workspace is populated.
- `openclaw agents delete <id>` — unregister on uninstall or as part of the "delete + re-add" flow when agent defaults change (OpenClaw has no in-place `agents update`).
- `openclaw agents list --json` — read the current agent state (used by `clawstore init` to autodetect plugins/secrets bound to an existing agent).
- `openclaw agents set-identity` — optional, for wiring `IDENTITY.md` values into `agents.list[].identity` on install.
- `~/.openclaw/.env` — dotenv file OpenClaw reads for known secret keys; clawstore writes `target: "env"` secrets here with user consent.
- Workspace directory convention (`~/.openclaw/workspace` default, or `~/.openclaw/workspace-<agentId>` for additional agents) and the canonical workspace filenames (`AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `IDENTITY.md`, plus optional `HEARTBEAT.md`, `BOOT.md`, `BOOTSTRAP.md`) documented in `docs/concepts/agent-workspace.md`.

If OpenClaw changes any of these, clawstore adapts. We do not patch OpenClaw, do not import `src/**`, and do not rely on undocumented behavior. The reviewer-confirmed baseline of documented surfaces is what this plan is built on.
