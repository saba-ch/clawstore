---
title: CLI Commands
description: Complete reference for every clawstore CLI command.
---

`clawstore` is a Node 20+ CLI published to npm. Install globally or run via npx:

```bash
npm install -g clawstore
# or
npx clawstore <command>
```

## Author commands

| Command | Description |
|---------|-------------|
| `clawstore init` | Scaffold an `agent.json` in the current directory. Detects existing workspace files, plugins, and secrets. |
| `clawstore validate [path]` | Run the validator against a package directory. Pure local, no network. |
| `clawstore pack [path]` | Create a local tarball. Runs `validate` first; refuses to pack on failure. |
| `clawstore preview [path] [--run]` | Install into an isolated scratch workspace. `--run` starts an ephemeral OpenClaw session. |
| `clawstore login` | Authenticate with GitHub via the device authorization flow. Token stored in `~/.clawstore/auth.json`. |
| `clawstore publish [path]` | Upload to the registry. Runs `validate` + `pack` first. |
| `clawstore yank <id>@<version> [--reason]` | Mark a published version as yanked. Owner-only. |
| `clawstore diff <id> [version]` | Compare local package to a published version. |

## Operator commands

| Command | Description |
|---------|-------------|
| `clawstore install <id>[@version]` | Install an agent. Also accepts a local `.tgz` path or URL for sideloading. |
| `clawstore uninstall <id>` | Remove an agent. Prompts about preserving user files and plugins. |
| `clawstore update [id]` | Update one agent (or all if `id` omitted). Shows a diff before touching files. |
| `clawstore update check` | Dry-run — print available updates, install nothing. |
| `clawstore list` | Show installed agents with versions and update policies. |
| `clawstore search <query>` | Search the registry from the terminal. |
| `clawstore info <id>` | Show package details in the terminal. |
| `clawstore rollback <id>` | Restore the most recent snapshot. |
| `clawstore doctor [id] [--fix]` | Detect and optionally repair drift between install record and disk. |
| `clawstore prune` | Clean up graveyard directories, expired snapshots, and orphans. |
| `clawstore policy <id> manual\|prompt\|auto` | Set update policy for an installed agent. |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | User-facing error (validation failure, permission denied, aborted by operator) |
| `2` | Network or backend error (retryable) |
| `3` | Local state corruption — run `clawstore doctor` |
| `4` | Internal bug (includes stack trace) |

## Configuration

### Base URL

The CLI defaults to `https://api.useclawstore.com/v1`. Override with:

```bash
# Environment variable
export CLAWSTORE_API_URL=https://your-instance.example.com/v1

# Or config file
# ~/.clawstore/config.json
{ "apiUrl": "https://your-instance.example.com/v1" }
```

### Files

| Path | Purpose |
|------|---------|
| `~/.clawstore/auth.json` | API bearer token (permissions `0600`) |
| `~/.clawstore/config.json` | Preferences: default update policy, API URL |
| `~/.clawstore/installs/<id>.json` | Install record per agent |
| `~/.clawstore/snapshots/<id>/` | Rollback snapshots |
