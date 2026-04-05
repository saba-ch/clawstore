# OpenClaw Integration

Clawstore is a third-party distribution layer. It is **not** a fork of OpenClaw, does not patch OpenClaw core, does not import OpenClaw's `src/**`, and does not rely on undocumented behavior. Every OpenClaw interaction goes through public CLI surfaces enumerated below. If OpenClaw changes one of these, Clawstore adapts — OpenClaw never bends for Clawstore.

The sibling ecosystem consists of three things:

- **OpenClaw** — the runtime. Registers agents, loads workspaces, runs plugins, wires skills, resolves secrets. System of record for everything at runtime.
- **ClawHub** — the plugin and skill registry. Clawstore resolves runtime dependencies through it at install time via `openclaw plugins install` / `openclaw skills install`.
- **Clawstore** — this project. Distributes agent packages (inert content). Never re-hosts plugins or skills.

## Public surfaces Clawstore depends on

Every command and filesystem convention Clawstore touches, verified against the OpenClaw docs in the sibling repo.

### CLI commands

| Command | Used by | Purpose |
|---|---|---|
| `openclaw plugins install <spec>` | install, update | Install a plugin dependency declared in `dependencies.plugins[]`. Runs OpenClaw's existing install-security-scan. |
| `openclaw plugins list` | doctor | Check current plugin state for drift detection. |
| `openclaw skills install <slug>` | install, update | Install a skill dependency declared in `dependencies.skills[]` via ClawHub. |
| `openclaw agents add <id> --workspace <path> --model <model>` | install, update (when `agent.defaults` changes) | Register the agent in `agents.list` after the workspace is populated. |
| `openclaw agents delete <id>` | uninstall, update (when `agent.defaults` changes) | Unregister the agent. Also step one of the "delete + re-add" flow when agent defaults change — OpenClaw has no in-place `agents update`. |
| `openclaw agents list --json` | `init` | Read current agent state so `clawstore init` can auto-detect plugins and secrets bound to an existing agent. |
| `openclaw agents set-identity` | install (optional) | Wire `IDENTITY.md` values into `agents.list[].identity` on first install. |

Every invocation is a subprocess call. There is no shared library, no embedded OpenClaw runtime, no monkey-patch.

### Filesystem conventions

| Path | Owned by | Clawstore's usage |
|---|---|---|
| `~/.openclaw/workspace-<id>/` | OpenClaw | Populated by Clawstore on install. Canonical multi-agent workspace location per OpenClaw's `docs/concepts/agent-workspace.md` and `docs/concepts/multi-agent.md`. |
| `~/.openclaw/.env` | OpenClaw | Dotenv file OpenClaw reads for known secret keys. Clawstore writes `setup.secrets[].target: "env"` values here with operator consent. |
| `~/.openclaw/` (everything else) | OpenClaw | Not touched by Clawstore. |
| `~/.clawstore/` | Clawstore | Install records, snapshots, graveyard, orphans, staging, previews. See [Install Flow § Files on disk](install-flow.md#files-on-disk). |

### Canonical workspace filenames

Clawstore supports OpenClaw's full canonical workspace filename set:

`AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `IDENTITY.md`, `MEMORY.md`, `HEARTBEAT.md`, `BOOT.md`, `BOOTSTRAP.md`

These names are OpenClaw's contract. Clawstore's `openclaw.entrypoints` manifest field maps package-relative paths onto these canonical names at install time. The lifecycle rules for each file (package-managed, template-once, never-managed) are enumerated in [Agent Package § Workspace file conventions](agent-package.md#workspace-file-conventions).

## The dependency contract

Plugin and skill dependencies live **outside** the Clawstore trust boundary. Clawstore does not re-host, re-sign, or re-validate them — it relies on the sibling ecosystem's existing security and install pipelines.

### Plugins

```json
{ "spec": "clawhub:@someone/nutrition-api", "required": true, "minVersion": "1.2.0" }
```

At install or update time, Clawstore runs `openclaw plugins install <spec>` for each entry. The accepted spec forms (`clawhub:<name>[@version]`, bare `<name>`, `<name>@<marketplace>`, local paths) are whatever `openclaw plugins install` accepts — Clawstore passes the string through.

At publish time, the backend performs a **reachability check** only: confirm the ClawHub entry exists, the npm package exists, or the git URL responds. It does not download or scan the plugin — that's OpenClaw's job at install time on the operator's machine.

### Skills

```json
{ "slug": "food-search", "required": false }
```

Resolved through `openclaw skills install <slug>` against ClawHub. There is no Clawstore-hosted skill registry. Same reachability check at publish time.

### Providers

```json
"providers": { "any": ["anthropic", "openai"] }
```

Declares acceptable runtime model providers. Clawstore does not install providers — it checks at install time that the operator has at least one matching provider configured in OpenClaw. If not, it prompts the operator to configure one via standard OpenClaw mechanisms before proceeding.

### Secrets

Secrets declared in `setup.secrets[]` with `target: "env"` are prompted at install and written to `~/.openclaw/.env` — OpenClaw's documented location for known secret keys. Clawstore never stores secret values in its own install records. Other target kinds are reserved for future use and are not supported at MVP.

See [Agent Package § Dependency contract](agent-package.md#dependency-contract) for the full manifest field reference.

## The `agents update` gap

OpenClaw has no in-place `openclaw agents update` command. When an installed agent's `agent.defaults` (model, thinking mode, etc.) change across a version boundary, Clawstore uses the documented two-step sequence:

1. `openclaw agents delete <id>`
2. `openclaw agents add <id> --workspace <path> --model <new-model>`

This preserves workspace and session state because the workspace path stays the same — only the `agents.list` entry is rewritten. Clawstore detects the need for this sequence by diffing the old and new `agent.defaults` during update; if nothing at that level changed, the `agents.list` entry is not touched at all, preserving any operator customizations.

See [Update and Rollback § Update agent config (if needed)](update-and-rollback.md#update-agent-config-if-needed).

## Why no `onUpdate` hook in OpenClaw

Clawstore deliberately does not fork OpenClaw to add a post-update hook for installed agents, and it does not ask OpenClaw to add one upstream. The "delete + re-add" flow is a short and fully-documented path; an `onUpdate` hook would tie Clawstore's update lifecycle to an OpenClaw-specific surface and make both projects harder to evolve independently.

This is the same principle that keeps Clawstore inert-content-only: each project owns its layer, and the contracts between them are narrow and documented.

## Adaptation policy

If OpenClaw changes any of the surfaces listed above, Clawstore adapts within its own code. The CLI subprocess calls are centralized in one module; adapting to a renamed flag is a one-file change. The reviewer-confirmed baseline of documented OpenClaw surfaces is what this integration is built on, and the Clawstore CLI pins a minimum OpenClaw version in its own startup check so that drift between the two is detected early and reported clearly to the operator.

## Cross-references

- [Install Flow](install-flow.md) — the full install pipeline, including every OpenClaw call it makes
- [Update and Rollback](update-and-rollback.md) — the update sequence, including the `agents delete` + `agents add` swap
- [Agent Package § Dependency contract](agent-package.md#dependency-contract) — manifest field reference
- [Documentation hub](README.md)
