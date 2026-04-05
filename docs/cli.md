# CLI Reference

`clawstore` is a Node 20 binary published to npm as `clawstore`. Commands are wired with [Commander](https://github.com/tj/commander.js) and interactive prompts come from [`@clack/prompts`](https://github.com/bombshell-dev/clack); the binary is bundled with `tsup`. Commands are organized by persona — authors publish, operators install, both use a small shared set of inspection commands.

The CLI imports `@clawstore/schema` and `@clawstore/validator` from the workspace, so `clawstore validate` runs the exact same code the backend publish endpoint runs. Network calls go through `@clawstore/sdk`, the typed fetch client shared with the web app.

## Author commands

| Command | Summary |
|---|---|
| `clawstore init` | Scaffold an `agent.json` in the current directory. Detects existing workspace files, plugins, and secrets and offers to pre-fill. See [Publish Flow § Step 1](publish-flow.md#step-1-clawstore-init). |
| `clawstore validate [path]` | Run the shared validator library against a package directory. Pure local, no network. See [Publish Flow § Step 2](publish-flow.md#step-2-clawstore-validate). |
| `clawstore pack [path]` | Produce a local tarball. Runs `validate` first; refuses to pack on failure. Writes a sidecar hash manifest. |
| `clawstore preview [path] [--run]` | Install into a scratch workspace under `~/.clawstore/preview/`. `--run` drops into an ephemeral OpenClaw session. See [Publish Flow § Step 4](publish-flow.md#step-4-clawstore-preview). |
| `clawstore login` | GitHub OAuth via the browser; backend issues an API token; stored in the OS keychain. See [Auth and Ownership](auth-and-ownership.md). |
| `clawstore publish [path]` | Authenticated upload to `POST /v1/publish`. Runs `validate` + `pack` first. See [Publish Flow § Step 6](publish-flow.md#step-6-clawstore-publish). |
| `clawstore yank <id>@<version> [--reason <text>]` | Mark a published version as yanked. Owner-only. |
| `clawstore diff <id> [version]` | Compare the current local package to a published version. Useful before `publish`. |

## Operator commands

| Command | Summary |
|---|---|
| `clawstore install <id>[@version]` | Install an agent from the catalog. Tarball path or URL is accepted for sideloading. See [Install Flow](install-flow.md). |
| `clawstore uninstall <id>` | Remove an agent, prompt about preserving user files and plugins. See [Install Flow § `clawstore uninstall`](install-flow.md#clawstore-uninstall). |
| `clawstore update [id]` | Update one agent, or all agents when `id` is omitted. Shows the diff before touching files. See [Update and Rollback](update-and-rollback.md). |
| `clawstore update check` | Dry-run — print available updates, install nothing. Backed by `POST /v1/updates`. |
| `clawstore list` | Installed agents with current version and update policy. |
| `clawstore search <query>` | Hits `GET /v1/packages?q=...`. Terminal-side equivalent of the website search. |
| `clawstore info <id>` | Package detail in the terminal. Mirrors the website detail page. |
| `clawstore rollback <id>` | Restore the most recent snapshot. See [Update and Rollback § Rollback](update-and-rollback.md#rollback). |
| `clawstore doctor [id] [--fix]` | Detect and optionally repair drift between install record and disk. See [Install Flow § `clawstore doctor`](install-flow.md#clawstore-doctor). |
| `clawstore prune` | Clean up graveyard directories, expired snapshots, and orphans beyond retention. |
| `clawstore policy <id> manual\|prompt\|auto` | Set update policy for an installed agent. See [Update and Rollback § Update detection](update-and-rollback.md#update-detection). |

## Internal / hidden

These exist for debugging and bug reports. Not part of the stable CLI contract.

| Command | Summary |
|---|---|
| `clawstore _debug install-record <id>` | Dump the install record JSON. |
| `clawstore _debug snapshots <id>` | List snapshots for an agent with sizes and timestamps. |
| `clawstore _debug api <path>` | Raw `GET` against the backend, signed with the current token. Useful for filing backend bug reports. |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | User-facing error (validation failure, permission denied, aborted by operator). |
| `2` | Network or backend error. Retryable. |
| `3` | Local state corruption (install record, graveyard, snapshot). `clawstore doctor` is the follow-up. |
| `4` | Internal bug. Includes a stack trace and a prompt to file a report. |

## Base URL

The CLI ships with `https://api.clawstore.dev/v1` hardcoded as the default. Override via the `CLAWSTORE_API_URL` environment variable or the `apiUrl` key in `~/.clawstore/config.json`. Enterprise or private deployments should set this once at install time.

## Cross-references

- [Publish Flow](publish-flow.md) — what the author commands do in sequence
- [Install Flow](install-flow.md) — what the operator commands do in sequence
- [Update and Rollback](update-and-rollback.md) — update detection modes and the update pipeline
- [Auth and Ownership](auth-and-ownership.md) — `clawstore login` and tokens
- [Documentation hub](README.md)
