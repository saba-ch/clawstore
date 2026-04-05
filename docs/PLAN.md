# Clawstore — Implementation Plan

This document is the implementation plan for Clawstore, a third-party app store for [openclaw](https://github.com/openclaw/openclaw) agents. Publish and update lifecycles are worked out in depth because those are the mechanics that make or break an app-store-like experience. Install and uninstall are covered but lighter.

---

## 1. Architecture overview

```
┌─────────────────┐         ┌──────────────────┐        ┌──────────────────┐
│  Bundle author  │  PR     │  Registry repo   │   CI   │  catalog.json    │
│  local machine  │────────▶│  (github monorepo│───────▶│  + per-bundle    │
│  clawstore CLI  │         │   of bundles)    │        │  JSON blobs      │
└─────────────────┘         └──────────────────┘        └──────────────────┘
                                                                  │
                                                                  │ CDN / Pages
                                                                  ▼
                                                          ┌────────────────┐
                                                          │  clawstore.dev │
                                                          │  (static site) │
                                                          └────────────────┘
                                                                  │
                                                                  │ copy-paste
                                                                  ▼
┌─────────────────┐         ┌──────────────────┐        ┌──────────────────┐
│  End user       │         │  clawstore CLI   │        │  openclaw        │
│  `clawstore     │────────▶│  installer       │───────▶│  (plugin install,│
│   install X`    │         │  (glue)          │        │   agents add)    │
└─────────────────┘         └──────────────────┘        └──────────────────┘
```

Six parts, all independently shippable:

1. **Bundle format** — the contract between authors and the registry. A directory with a `bundle.json` manifest.
2. **Registry repo** — a public GitHub monorepo of bundles. Publish = PR.
3. **Catalog builder** — CI job that walks the registry, validates bundles, produces `catalog.json` + per-bundle detail blobs.
4. **Discovery website** — static site that reads the catalog and renders browse, search, and detail pages.
5. **Clawstore CLI** — local tool for authors (`validate`, `pack`, `preview`, `publish`) and end users (`install`, `update`, `uninstall`, `doctor`, `rollback`).
6. **Install glue** — the part of the CLI that translates a bundle install into the right sequence of openclaw public CLI calls.

Clawstore owns all six. None of them patch openclaw core.

---

## 2. Bundle format (recap)

Freeform directory layout owned by the author. Only requirement is a `bundle.json` manifest at the root.

### Example bundle

```
calorie-coach/
├── bundle.json
├── icon.png
├── screenshots/
│   ├── chat.png
│   └── daily-log.png
├── rules/
│   ├── core.md
│   ├── nutrition.md
│   └── safety.md
├── personality.md
├── tools-guide.md
├── who-i-am.md
├── knowledge/
│   ├── foods/
│   │   ├── fruits.md
│   │   ├── grains.md
│   │   └── restaurants.md
│   └── nutrition/
│       ├── macros.md
│       └── micros.md
├── data/
│   └── portion-sizes.json
└── prompts/
    └── morning-checkin.md
```

### bundle.json

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

  "roles": {
    "AGENTS.md": {
      "compose": [
        { "file": "rules/core.md" },
        { "file": "rules/nutrition.md" },
        { "file": "rules/safety.md" }
      ]
    },
    "SOUL.md":     { "from": "personality.md" },
    "TOOLS.md":    { "from": "tools-guide.md" },
    "IDENTITY.md": { "from": "who-i-am.md" }
  },

  "include": ["**/*"],
  "exclude": ["README.md", "LICENSE", ".git/**", "node_modules/**", "bundle.json"],

  "agent": {
    "defaults": {
      "model": "sonnet-4.6",
      "thinking": "low"
    }
  },

  "requires": {
    "openclaw": ">=0.x",
    "plugins": [
      { "spec": "@someone/nutrition-api", "source": "npm", "minVersion": "1.2.0" },
      { "spec": "@someone/image-vision",  "source": "npm" }
    ],
    "provider": { "any": ["anthropic", "openai"] },
    "secrets": [
      { "name": "NUTRITIONIX_API_KEY", "prompt": "Nutritionix API key", "required": true }
    ]
  },

  "permissions": {
    "tools": ["read", "write", "http"],
    "channels": []
  },

  "store": {
    "icon": "icon.png",
    "screenshots": ["screenshots/*.png"]
  }
}
```

### Role mapping rules

- If `roles` is omitted, the installer expects `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md` to exist at the bundle root with those exact names. Zero-config path.
- `roles.<TARGET>.from` copies a single file to the target filename at workspace root.
- `roles.<TARGET>.compose` concatenates a list of files (in order) with a blank line between, writes result to the target filename at workspace root.
- Every file referenced in `roles` must exist in the bundle. Validator error if not.

### Include/exclude rules

- Defaults: `include: ["**/*"]`, `exclude: [".git/**", "node_modules/**", "bundle.json", "README.md", "LICENSE"]`.
- Anything matched by `include` and not `exclude` gets copied into the workspace at its relative path.
- Files named in `roles.*.from` / `roles.*.compose` are NOT also copied under their original names — they only land at the role target filename.
- `bundle.json` and `store.*` files are never copied into the workspace (store-only).

### What ships, what doesn't

- **Allowed**: markdown, JSON, YAML, CSV, TSV, plain text, images (PNG/JPG/SVG/WebP), TOML.
- **Flagged (warning)**: PDFs and other binaries the agent can't consume without a plugin.
- **Rejected by registry CI**: any file with executable permission bits set, any file whose magic bytes match a known executable format (ELF, Mach-O, PE), any `.sh` / `.bash` / `.zsh` / `.js` / `.ts` / `.py` / `.rb` / `.php` / `.exe`.
- **Size limit**: 100 MB per bundle, 10,000 files per bundle, 1 MB per individual text file (soft warning), 10 MB per asset file.

### Versioning

- Semver. `MAJOR.MINOR.PATCH`.
- Breaking = role files changed in a way that invalidates user expectations, secrets added, required plugins added, license changed.
- Registry rejects a PR whose `version` is ≤ the current published version for the same `id`.

---

## 3. Registry structure

### Layout

```
clawstore-registry/                 ← public GitHub repo
├── bundles/
│   ├── calorie-coach/
│   │   ├── 0.3.1/                  ← one folder per published version
│   │   │   ├── bundle.json
│   │   │   ├── ...all bundle files
│   │   ├── 0.3.0/
│   │   └── latest -> 0.3.1         ← symlink, tracks latest stable
│   ├── daily-standup/
│   └── code-reviewer/
├── categories.json                 ← curated list (id, name, icon, order)
├── featured.json                   ← editor picks, rotated
├── verified.json                   ← verified-author allowlist
├── schema/
│   └── bundle.schema.json          ← JSON schema for bundle.json
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

This is the author's experience, from "I have a working agent on my machine" to "my bundle is live on the store."

### Step 0: Author has a working agent

Author has been using an openclaw agent they built locally — workspace has real `AGENTS.md` / `SOUL.md` / `TOOLS.md` / `IDENTITY.md`, plus whatever knowledge files they've accumulated under their workspace. They want to share it.

### Step 1: `clawstore init`

```
$ cd ~/my-calorie-coach-workspace
$ clawstore init
```

- Scans the current directory for the four role files.
- Prompts for `id`, `name`, `tagline`, `category`, `license`.
- Detects plugins currently bound to this agent (reads `openclaw agents show <id>` output) and offers to pre-fill `requires.plugins`.
- Detects secrets the agent currently uses and offers to pre-fill `requires.secrets` (names only, never values).
- Writes a `bundle.json` draft.
- Writes a starter `README.md` for the bundle (the store-facing description).

Outcome: the workspace is now *also* a bundle. Author keeps using it as an agent; the presence of `bundle.json` doesn't disturb openclaw.

### Step 2: `clawstore validate`

```
$ clawstore validate
```

Pure local, no network. Runs the same validator the registry CI runs. Reports:

- Schema errors in `bundle.json`.
- Role mapping errors (missing files, compose targets that don't exist).
- Include glob results (shows the full list of files that would be shipped).
- Size and file-count against limits.
- Broken internal references (e.g. `AGENTS.md` says "read knowledge/foods/fruits.md" but no such file exists).
- Executable / rejected file-type findings.
- Warnings for binaries, oversize individual files, suspicious patterns (phone numbers, email addresses, obvious API-key-looking strings in shipped content).

Fast feedback loop. Author runs this until it's clean.

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

- Installs the packed tarball into a **scratch workspace** under `~/.clawstore/preview/<bundle-id>/` — completely isolated from the author's real openclaw config.
- Does NOT touch `agents.list`, does NOT install real plugins (uses stub plugin manifests to simulate resolution).
- Lets the author `cd` into the scratch workspace and inspect exactly what users will see — the final composed `AGENTS.md`, the copied `knowledge/` tree, everything.
- `clawstore preview --run` goes one step further: temporarily binds the scratch workspace to an ephemeral openclaw agent and drops into an interactive session. Useful for "does this actually feel right" checks.

### Step 5: Submit as a PR

```
$ clawstore publish
```

- Ensures the bundle validates cleanly.
- Computes the version folder path (`bundles/<id>/<version>/`).
- Either:
  - **Automated path**: forks the registry repo via `gh` CLI, adds the bundle files under the versioned folder, updates `latest` pointer, opens a PR with a generated description that includes the bundle's `tagline`, `description`, screenshots, the full diff.
  - **Manual path**: prints instructions and a ready-to-use branch so the author can push and open the PR themselves.

### Step 6: Registry CI (`validate-pr.yml`)

Runs on every PR. Checks:

1. **Schema**: `bundle.json` validates against `schema/bundle.schema.json`.
2. **File inventory**: every file in the PR's bundle dir matches the bundle's include/exclude globs.
3. **Role resolution**: roles map to real files; composed role files render without error.
4. **Executable scan**: no exec bits, no known binary formats, no blocked extensions.
5. **Size limits**: enforced.
6. **Version monotonicity**: new version is strictly greater than any previous version for the same `id`.
7. **Ownership**: the `id` is either unclaimed or already owned by the PR author (tracked by a simple `bundles/<id>/OWNERS` file on first publish).
8. **Secret scanning**: run a secrets-detection pass over all shipped text files. Failing here is a hard reject (you don't want a user's leaked key in your registry).
9. **Plugin reachability**: for each `requires.plugins[]`, confirm the referenced spec actually resolves (npm package exists, ClawHub entry exists, git URL responds).
10. **Render preview**: CI generates a preview of how the detail page would look and posts it as a PR comment so the maintainer can visually review.

### Step 7: Maintainer review

The maintainer reviews the PR like any GitHub PR. Markdown is human-readable, so this is fast. Checks:

- Is the content safe and appropriate?
- Is the category correct?
- Does the personality file match the claimed use case?
- Any concerning patterns CI didn't catch (prompt injection attempts, manipulative framing, content that violates the store's policy)?

For MVP, the store has a single tier: published bundles. Verified/trusted authors get added to `verified.json` manually and their subsequent updates can be fast-tracked (auto-merge on green CI).

### Step 8: Merge → deploy

On merge to `main`:

1. `deploy-catalog.yml` runs.
2. `tools/build-catalog.ts` walks `bundles/`, reads every published version, produces:
   - `catalog.json` — flat array of bundles with minimal metadata (id, version, name, tagline, category, tags, icon URL, install count placeholder).
   - `bundles/<id>.json` — per-bundle detail blob (full description, rendered role files, file tree, changelog, screenshots).
   - `search-index.json` — precomputed Lunr/MiniSearch index over name, tagline, description, tags, and full text of all role files and all included markdown.
3. Outputs uploaded to CDN (Cloudflare R2 or Vercel's static asset host).
4. Website rebuild triggered (Vercel/Cloudflare Pages detects the CDN change and redeploys).
5. Bundle is live. Install count for v1 is "∞" or hidden because there's no telemetry yet.

### Updating an existing bundle

An author publishing `0.3.1 → 0.4.0` repeats steps 2-7. Registry rejects a re-published `0.3.1`. The CLI's `clawstore publish` helps by bumping the version automatically (prompting the author to choose major/minor/patch and summarize the changes for the changelog).

---

## 5. The update flow (detailed)

The user-side counterpart to publish. This is the flow that determines whether users trust the store long-term.

### Update detection

Three modes, per installed bundle, controlled by the bundle's `updatePolicy` field in the user's local install record (not in the bundle manifest — the user chooses):

- **`manual`** (default): user runs `clawstore update check` or `clawstore update <bundle-id>`. Nothing happens automatically.
- **`prompt`**: clawstore CLI checks for updates on every invocation (cheap — one HTTP call to `catalog.json`) and prints a single line at the bottom of any command output: *"2 updates available. Run `clawstore update` to review."*
- **`auto`**: new stable versions (not pre-releases, not major bumps) install silently at next check. Major bumps still prompt.

Users opt into each mode per bundle. Global default is `manual` because auto-updating third-party content on someone's machine without explicit consent is exactly the kind of thing that gets stores banned.

### The update command

```
$ clawstore update calorie-coach
```

Full sequence:

#### 5.1 Resolve

- Read local install record at `~/.clawstore/installs/calorie-coach.json` — knows current version, install timestamp, workspace path, plugin deps at install time, snapshot IDs.
- Fetch `catalog.json`, look up `calorie-coach`, compare versions.
- If no newer version: exit 0 with "already up to date."
- If newer version: fetch `bundles/calorie-coach.json` detail blob and the full bundle tarball for the new version.

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

The file list comes from comparing the vendor-managed file set of the old install against the new bundle's resolved file set. This is the most important part of the UX: the user sees exactly what's about to happen.

#### 5.3 Snapshot

- Compress the current workspace's vendor-managed files to `~/.clawstore/snapshots/calorie-coach/<timestamp>.tgz`.
- Record the snapshot id in the install record.
- Keep the last 5 snapshots per bundle. Older ones get garbage-collected.

#### 5.4 Validate the new bundle

- Run the same validator that ran at publish time.
- This should always pass (CI already enforced it), but re-check locally. If it fails, abort and leave the current install untouched.

#### 5.5 Resolve plugin changes

- For each plugin in new `requires.plugins` that either (a) didn't exist in the old version or (b) has a changed minVersion: run `openclaw plugin install <spec>`.
- For each plugin that was removed from `requires.plugins`: do NOT uninstall it automatically. Other bundles or the user may depend on it. Record the removal in the install record so `clawstore uninstall` can offer to clean it up later.
- If any plugin install fails, abort before touching workspace files.

#### 5.6 Resolve secret changes

- For each new secret in `requires.secrets[]`: prompt the user. Store via openclaw's auth profile APIs (never in the clawstore install record).
- For removed secrets: leave them. The user may want them for other things.

#### 5.7 Apply workspace changes atomically

Standard safe-update pattern:

1. Create a staging directory `~/.clawstore/staging/calorie-coach-0.4.0/`.
2. Extract the new bundle into staging.
3. Apply the role mapping (build composed role files, copy from-mapped role files).
4. Apply the include/exclude globs to produce the final workspace file set.
5. Copy user-managed files (`MEMORY.md`, anything under `notes/`, any file whose path matches user-preserve patterns) from the current workspace into staging.
6. **Rename** the current workspace to `~/.clawstore/graveyard/calorie-coach-<timestamp>/` (not delete — rename is atomic on POSIX and gives us a rollback escape hatch).
7. **Rename** staging into the workspace path.
8. If any step fails mid-way: rename graveyard back, abort with a clear error.

The graveyard directory gets cleaned up on the next successful update or explicit `clawstore prune`.

#### 5.8 Update agent config (if needed)

- Compare old `bundle.json agent.defaults` to new.
- If `model` / `thinking` / any other agent-level default changed: call `openclaw agents update <id>` with the new values. If openclaw doesn't support in-place update, delete and re-add the entry using the same workspace path.
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
- Does NOT revert plugin updates (those may have been shared with other bundles). Prints a notice about plugin versions it can't roll back.

### Failure modes we need to handle gracefully

| Failure | Behavior |
|---|---|
| Network down during fetch | Abort before any workspace changes |
| Validation fails on new bundle | Abort, keep old install |
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

1. Resolve bundle from catalog (or from a direct URL / tarball for sideloading).
2. Validate locally.
3. Show what will be installed (same diff UI as update, but "all new files").
4. Prompt for consent.
5. Resolve + install plugin deps via `openclaw plugin install`.
6. Prompt for required secrets, store via openclaw auth profiles.
7. Create the workspace directory (default: `~/.openclaw/agents/<id>/workspace/`).
8. Apply role mapping + include globs to populate workspace.
9. Take an initial snapshot (so a later rollback has something to revert to — it becomes a "fresh install" restore).
10. Call `openclaw agents add` with the bundle's `agent.defaults`.
11. Write the install record.
12. Print the ready-to-use command (`openclaw agent calorie-coach`).

### Sideloading

`clawstore install ./my-bundle.tgz` or `clawstore install https://example.com/bundle.tgz` uses the same flow but skips the catalog lookup. For development and private sharing. Marked in the install record as `source: "sideload"` so it's never auto-updated by catalog polling.

---

## 7. The uninstall flow (summary)

```
$ clawstore uninstall calorie-coach
```

1. Read the install record.
2. Call `openclaw agents delete <id>` (the agents.list entry).
3. Prompt: preserve user files? *Default yes.* If yes, move `MEMORY.md` and `notes/` (and anything else flagged user-managed) to `~/.clawstore/orphans/calorie-coach-<timestamp>/` so the user can recover them.
4. Prompt: uninstall plugin deps? Show the list with a note for each one of "also used by <other bundles>" or "not used elsewhere". Default NO. Safer to leave plugins installed; users who care can prune manually.
5. Delete the workspace directory.
6. Remove the install record.
7. Keep snapshots in place for a configurable period (default 30 days) in case the user reinstalls and wants their old data back.

---

## 8. Doctor / repair flow

```
$ clawstore doctor
$ clawstore doctor <bundle-id>
$ clawstore doctor --fix
```

Detects and optionally fixes drift between what the install record says and what's actually on disk:

- Workspace directory missing.
- Role file missing or hash mismatch (user edited a vendor-managed file; we warn, offer to re-copy).
- Plugin dep missing (plugin was uninstalled out of band).
- Secret missing from openclaw auth profiles.
- Install record references a version no longer in the catalog (orphaned install — still works, but future updates unavailable).
- Stale graveyard directories from interrupted updates.
- Stale snapshot files beyond retention.

`--fix` runs a re-install against the recorded version without touching user files.

---

## 9. CLI command surface

Organized by persona.

### Author commands

```
clawstore init                      # scaffold bundle.json in current dir
clawstore validate [path]           # lint a bundle
clawstore pack [path]               # produce a local tarball
clawstore preview [path] [--run]    # install into scratch workspace
clawstore publish [path]            # open a registry PR
clawstore diff <id> [version]       # compare local bundle to a published version
```

### User commands

```
clawstore install <id>[@version]    # or a URL / tarball path for sideload
clawstore uninstall <id>
clawstore update [id]               # update one or all
clawstore update check              # dry run — show what's available, don't install
clawstore list                      # installed bundles
clawstore search <query>            # hits catalog + search-index
clawstore info <id>                 # detail, mirrors the website detail page in the terminal
clawstore rollback <id>             # restore last snapshot
clawstore doctor [id] [--fix]
clawstore prune                     # clean up graveyards, old snapshots, orphans
clawstore policy <id> manual|prompt|auto   # set update policy per bundle
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

1. **Lint** — run `tools/validate.ts` on the changed bundle(s). Post findings as PR comments inline on the offending lines.
2. **Security** — executable scan + secret scan + known-bad pattern scan. Hard fail on any finding.
3. **Schema** — validate `bundle.json` against the JSON schema.
4. **Version check** — new version > previous versions for the same `id`.
5. **Ownership** — PR author matches `OWNERS` for the `id`, or `id` is unclaimed.
6. **Plugin reachability** — every plugin spec in `requires.plugins` resolves.
7. **Render preview** — generate a Markdown summary that mimics the website detail page and post as a PR comment.

### `deploy-catalog.yml`

Triggered: push to `main`.

Jobs:

1. **Build catalog** — run `tools/build-catalog.ts` to generate `catalog.json`, per-bundle detail blobs, search index.
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
- **Markdown rendering**: `remark` + `rehype-highlight` + a custom component for internal bundle file references (click a link like "read knowledge/foods/fruits.md" and expand that file inline).
- **Deploy**: Cloudflare Pages or Vercel. Both have generous free tiers and good cache invalidation.

### Pages

- `/` — home. Featured, trending (by recent changes as a proxy until install telemetry exists), new this week, all categories.
- `/browse/[category]` — category listing, alphabetical unless the category is specifically about runtime order.
- `/bundle/[id]` — detail page. Icon, tagline, description, screenshots, rendered `SOUL.md` inline (hero section), rendered `AGENTS.md` below, file tree browser with click-to-preview, required plugins as badges (link to each plugin's page if we eventually have one), required secrets as a "you'll need" callout, author, version, changelog, install command.
- `/bundle/[id]/files/[...path]` — individual file previews. Rendered markdown for MDs, pretty-printed JSON, raw for unknown.
- `/search?q=...` — search results. Filters by category, tag, required plugin.
- `/publish` — static docs: how to publish a bundle, link to the author CLI docs, link to the schema.
- `/policy` — what's allowed, what isn't, how to report a problem.
- `/about` — what clawstore is, relationship to openclaw, who runs it.

### "Install" button UX

MVP: generates a one-liner copy-paste:

```
clawstore install calorie-coach
```

Post-MVP: custom URL scheme `clawstore://install?id=calorie-coach` registered by the CLI at install time. Clicking the button launches the CLI directly. Nice polish but has cross-platform quirks (OS registration, browser security prompts), so it's v2.

---

## 12. Trust and security model

### What clawstore enforces

- **Bundles are inert content.** No executables. Enforced by CI.
- **Plugin deps flow through openclaw's security scan.** We don't re-implement plugin security; we rely on openclaw's existing `install-security-scan` and update pipeline.
- **Human-readable review.** All content is markdown or well-known data formats. Maintainers can actually read and judge bundles before publishing.
- **Versioned, immutable publishes.** You can't silently change an already-published version. You can only publish a new version.
- **Secret scanning at publish time.** Reject bundles that contain API-key-looking strings in shipped content.

### What clawstore doesn't enforce (but should in v2)

- **Cryptographic signing.** MVP trusts git commit signatures + GitHub auth. v2 adds a per-author signing key, stored in `OWNERS`, and CI verifies bundle signatures.
- **Content moderation at scale.** MVP is maintainer PR review. If the store succeeds, this won't scale and needs automation.
- **Prompt-injection analysis.** A malicious bundle could craft content designed to jailbreak the user's other agents via shared context. Out of scope for MVP. Flag for post-MVP.

### The one hard line

No code in bundles. Ever. The moment bundles can run code, the security story collapses into "re-invent plugin sandboxing," and clawstore loses its main differentiator — that bundles are auditable by humans in under a minute.

If a bundle needs runtime behavior beyond reading files, it adds a plugin to `requires.plugins`. That plugin goes through openclaw's existing security review. Clean separation.

---

## 13. MVP scope

**In scope for MVP:**

- Bundle format (schema, validator, JSON schema file)
- One reference bundle (`calorie-coach` as the canonical example — built end-to-end)
- Clawstore CLI: `init`, `validate`, `pack`, `preview`, `publish`, `install`, `update`, `uninstall`, `list`, `info`, `rollback`, `doctor`
- Registry repo with CI (validate-pr.yml, deploy-catalog.yml)
- Catalog builder
- Discovery website: home, category browse, detail page, file preview, search
- Manual update policy by default

**Explicitly NOT in MVP:**

- Payments
- Ratings or reviews
- Install telemetry
- Auto-update as a global default
- Shared knowledge packs
- Localization
- Custom URL scheme for one-click install
- Cryptographic bundle signing
- Automated content moderation
- Paid publishing
- Admin dashboard (just a git repo + a website)

---

## 14. Open questions

1. **CLI stack**: Node + TypeScript (easiest interop with openclaw's own stack) vs Go (single static binary) vs Rust (performance + single binary). Recommendation: TypeScript for MVP because we'll be shelling out to the openclaw CLI and reading openclaw config files anyway, and Node is already on every openclaw user's machine.
2. **Registry repo hosting**: GitHub (assumed) or self-host Gitea? GitHub is the right call for MVP — discoverability, `gh` CLI integration, free CI.
3. **Website stack**: Astro vs Next.js static export. Astro is slightly simpler for content-heavy sites; Next.js is more familiar. Pick the one the implementer knows best.
4. **Maximum bundle size**: 100 MB feels right but we have no data. May need to lower or raise based on first real bundles.
5. **Shared knowledge packs timing**: when does this become necessary? First time two unrelated bundles both ship the same 5 MB of nutrition data. Until then, duplication is fine.
6. **Verified tier**: when do we introduce it? Probably when there are ~20 bundles and duplicate-of-existing-bundle spam starts appearing.
7. **Telemetry stance**: do we want install counts ever? If yes, it requires a backend — decide before committing to a fully static MVP.
8. **Payments**: same. If there's any chance we want paid bundles, the `bundle.json` schema should leave a `price` field as reserved (even if always `"free"`) so we don't have to break compat later.
9. **Do we fork openclaw to get an `onUpdate` hook for agents?** No — stays on public contracts only. Any config updates flow through existing `openclaw agents add` / `openclaw agents delete`.
10. **Name** — `clawstore` is a working name. Final decision before public launch.

---

## 15. Suggested milestones

In order, with each milestone independently shippable and testable:

1. **Bundle format v1 frozen**: JSON schema committed to this repo, test fixtures, schema doc.
2. **Reference bundle**: a real `calorie-coach` built end-to-end as the worked example. Becomes the first registry entry AND the test fixture for the validator.
3. **Validator library**: pure function, takes a bundle directory, returns a structured error report. Used by CLI and registry CI both.
4. **Clawstore CLI — author side**: `init`, `validate`, `pack`, `preview`. No network. No end-user commands yet. Ship early for dogfooding.
5. **Registry repo scaffolding**: schema file, OWNERS pattern, empty bundles dir, CI workflows wired, categories.json seeded.
6. **Clawstore CLI — user side against a local registry**: `install`, `update`, `uninstall`, `list`, `rollback`, `doctor`. Targets a locally-cloned registry path instead of a CDN. Everything works except discovery.
7. **Catalog builder**: produces `catalog.json` + detail blobs + search index. Tested by pointing milestone 6's CLI at catalog output instead of raw registry.
8. **Discovery website**: home, categories, detail, file preview, search. Points at a local catalog first, then at a real CDN.
9. **End-to-end publish against a real registry**: first bundle submitted via PR, merged, appears on the site, installed via the CLI. This is the "it works" milestone.
10. **Second and third real bundles**: different categories, different plugin dependency shapes. Exercises the flows with variety.
11. **Update flow hardening**: snapshots, rollback, graveyard recovery, atomic rename, failure-mode tests. Only once step 9 proves the happy path.
12. **Public launch prep**: docs, publish/ policy pages, contribution guide, a small featured list, launch blog post.

---

## Appendix A — Files touched by clawstore on the user's machine

For auditability. Clawstore creates and manages files at these paths:

```
~/.clawstore/
├── config.json                           # user prefs: default update policy, registry URL
├── catalog-cache/                        # last fetched catalog, with etag
├── installs/
│   └── <bundle-id>.json                  # install record per bundle
├── snapshots/
│   └── <bundle-id>/
│       └── <timestamp>.tgz               # last N vendor-managed state snapshots
├── graveyard/                            # renamed-not-deleted old workspaces, cleaned by prune
├── orphans/                              # user files preserved from uninstalls
├── staging/                              # in-flight install/update work, cleaned on success
└── preview/                              # scratch workspaces for `clawstore preview`
```

The actual agent workspace lives under `~/.openclaw/agents/<id>/workspace/` — that's openclaw's territory, clawstore just populates it.

## Appendix B — What we rely on openclaw for

Public surfaces only:

- `openclaw plugin install <spec>` — install plugin deps
- `openclaw plugin list` — check current plugin state
- `openclaw agents add` — register the agent in `agents.list`
- `openclaw agents delete` — unregister
- `openclaw agents show <id>` — read current agent state (for `clawstore init` autodetection)
- openclaw auth profile APIs — store secrets
- Workspace directory convention (`~/.openclaw/agents/<id>/workspace/`) and the four role filenames (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`) from openclaw's `src/agents/workspace.ts`

If openclaw changes any of these, clawstore adapts. We do not patch openclaw, do not import `src/**`, do not rely on undocumented behavior.
