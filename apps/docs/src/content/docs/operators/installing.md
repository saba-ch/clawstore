---
title: Installing Agents
description: How to install, uninstall, and maintain agents from the Clawstore registry.
---

## Installing an agent

```bash
clawstore install @someone/calorie-coach
clawstore install @someone/calorie-coach@0.3.1   # pin a specific version
```

The install flow runs these steps in order:

1. **Resolve the version** — fetches the package metadata from the registry. If you pinned a version, that exact version is used.
2. **Download the tarball** — content-hash verified on arrival.
3. **Validate locally** — runs the same validator the server ran at publish time, catching truncated downloads or tampered caches.
4. **Show the install plan:**

   ```
   Calorie Coach 0.3.1 by @someone
   Log meals by chat, get daily nutrition summaries

   This package will:
     - create workspace at ~/.openclaw/workspace-calorie-coach
     - install 1 required plugin: @someone/nutrition-api 1.2.0
     - prompt for 1 secret: NUTRITIONIX_API_KEY
     - register agent in OpenClaw with model openai/gpt-5.4

   Proceed? [Y/n]
   ```

5. **Resolve dependencies** — installs plugins via `openclaw plugins install` and skills via `openclaw skills install`. Required dependencies that fail abort the install.
6. **Prompt for secrets** — writes values to `~/.openclaw/.env`. Clawstore never stores secret values itself.
7. **Create the workspace** — populates files at `~/.openclaw/workspace-<id>/`.
8. **Take a snapshot** — stores a backup for rollback.
9. **Register with OpenClaw** — runs `openclaw agents add` so the agent is ready to use.

Then you're ready:

```bash
openclaw chat calorie-coach
```

If any step fails after workspace creation, everything is cleaned up automatically.

## Sideloading

Install from a local file or URL instead of the registry:

```bash
clawstore install ./my-agent.tgz
clawstore install https://example.com/agent.tgz
```

Same install flow, but skips the catalog lookup. Sideloaded agents don't auto-update — you re-run `clawstore install` with a newer file when ready.

## Uninstalling

```bash
clawstore uninstall calorie-coach
```

The uninstall flow:

1. Removes the agent from OpenClaw's registry
2. **Asks if you want to preserve your files** (default: yes) — `MEMORY.md`, notes, and other files you created are moved to `~/.clawstore/orphans/`, not deleted
3. **Asks about plugin dependencies** — shows which plugins are shared with other agents (default: keep them)
4. Deletes the workspace
5. Keeps snapshots for 30 days in case you reinstall

:::note
Nothing you created gets deleted without explicit confirmation. Uninstalls are deliberately conservative.
:::

## Doctor

Detects and fixes drift between the install record and what's on disk:

```bash
clawstore doctor              # check all agents
clawstore doctor calorie-coach  # check one agent
clawstore doctor --fix        # auto-fix issues
```

Checks for:
- Missing workspace directory
- Missing or modified entrypoint files
- Missing plugin dependencies
- Missing secrets
- Orphaned install records
- Stale snapshots

`--fix` re-installs against the recorded version without touching your files.

## Files on disk

Everything Clawstore writes to your machine:

```
~/.clawstore/
├── config.json              # Your preferences (update policy, API URL)
├── auth.json                # API token from `clawstore login`
├── api-cache/               # Short-TTL response cache
├── installs/
│   └── <agent-id>.json      # Install record per agent
├── snapshots/
│   └── <agent-id>/
│       └── <timestamp>.tgz  # Rollback snapshots
├── graveyard/               # Old workspaces pending cleanup
├── orphans/                 # User files preserved from uninstalls
├── staging/                 # In-flight install/update work
└── preview/                 # Scratch workspaces for `clawstore preview`
```

Agent workspaces live under `~/.openclaw/workspace-<id>/` — that's OpenClaw's territory; Clawstore only populates it.
