---
title: Publishing Guide
description: How to publish your OpenClaw agent to the Clawstore registry, step by step.
---

Six CLI commands take you from "I have a working agent on my machine" to "my agent is live on the store." No PR reviews, no deploy pipeline.

## Prerequisites

You have an OpenClaw agent you've been using locally — with real `AGENTS.md`, `SOUL.md`, and whatever knowledge files you've built up. You want to share it.

An agent package is **derived from that workspace**, not built from scratch.

## Step 1: Initialize the package

```bash
cd ~/.openclaw/workspace-calorie-coach
clawstore init
```

The CLI will:
- Scan for canonical workspace files (`AGENTS.md`, `SOUL.md`, etc.)
- Prompt for `id`, `name`, `tagline`, `category`, `license`
- Detect currently configured plugins and offer to pre-fill dependencies
- Detect secrets the agent uses and offer to pre-fill `setup.secrets`
- Write an `agent.json` manifest and a starter `README.md`

Your workspace is now also a Clawstore package. The `agent.json` at the root doesn't disturb OpenClaw — you keep using the agent as before.

## Step 2: Validate

```bash
clawstore validate
```

Pure local, no network. Checks:
- Schema errors in `agent.json`
- Missing entrypoint files
- File glob results and size limits
- Executable or rejected file types
- Secret-like strings in shipped content

Run this until it's clean. `clawstore publish` won't upload if validation fails.

:::tip
The CLI validator is the **exact same code** the server runs at publish time. If it's clean locally, it's accepted remotely.
:::

## Step 3: Pack (optional)

```bash
clawstore pack
```

Creates a local tarball (e.g., `calorie-coach-0.3.1.tgz`) containing exactly what would be published. Useful for inspecting and debugging. `publish` packs automatically, so this step is optional.

## Step 4: Preview (optional)

```bash
clawstore preview
clawstore preview --run
```

Installs the package into an isolated scratch workspace at `~/.clawstore/preview/`, completely separate from your real OpenClaw config. This catches issues that schema validation can't — wrong persona file, mismatched entrypoints, out-of-order screenshots.

The `--run` flag drops you into an ephemeral OpenClaw session so you can test the first-run experience.

## Step 5: Log in

```bash
clawstore login
```

First time: opens your browser for GitHub OAuth via the device authorization flow. The CLI receives a bearer token and stores it in `~/.clawstore/auth.json`.

Subsequent runs are silent — the token is already cached.

:::note
Your GitHub username (lowercased) becomes your **scope**. If your GitHub login is `Someone`, your packages are published under `@someone/`.
:::

## Step 6: Publish

```bash
clawstore publish
```

What happens:

1. **Client:** Runs `validate` + `pack` under the hood. Refuses to publish on failure.
2. **Client:** Uploads the tarball to the backend.
3. **Server:** Authenticates you, checks ownership, verifies version is newer than any existing.
4. **Server:** Runs the validator against the tarball.
5. **Server:** Scans for executables and secrets.
6. **Server:** Verifies plugin dependencies are reachable.
7. **Server:** Stores the tarball, extracts icon/screenshots, persists the version.
8. **Server:** Returns the live URL for your agent's detail page.

Your agent is live the moment the command returns.

## Updating an existing agent

Publishing `0.3.1 -> 0.4.0` repeats steps 2-4 and 6. Login is already cached. The backend rejects a re-published version — versions are immutable.

`clawstore publish` will prompt you for a version bump (major/minor/patch) if you haven't updated the version in `agent.json`.

## Yanking a bad release

```bash
clawstore yank @someone/calorie-coach@0.3.1 --reason "broken nutrition data"
```

A yanked version:
- Hides from search, install, and update resolution
- Stays in the database for audit
- Can still be installed by operators who pin the exact version
- Can only be un-yanked by a maintainer (not the author) to prevent accidental re-exposure

## Versioning guidelines

Clawstore follows [Semantic Versioning](https://semver.org):

- **Major** bump: behavior changed in a way that breaks operator expectations, required dependencies changed incompatibly
- **Minor** bump: additive changes, new optional dependencies
- **Patch**: content fixes, typos, new knowledge files that don't change behavior

Pre-releases use SemVer identifiers like `0.4.0-beta.1`. The `latest` pointer never advances to a pre-release.
