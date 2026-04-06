# Install Flow

The operator's experience — install, uninstall, and doctor. Updates and rollback are covered separately in [Update and Rollback](update-and-rollback.md) because that's where the real complexity lives.

Clawstore installs the app; OpenClaw runs it. Every step below is a transparent, resumable sequence the operator can follow along with.

## `clawstore install`

```
$ clawstore install @someone/calorie-coach
$ clawstore install @someone/calorie-coach@0.3.1
```

The flow, in order:

1. **Resolve the version.** `GET /v1/agents/:scope/:name` returns the package with its `latest` version manifest. If the operator pinned a version, `GET /v1/agents/:scope/:name/versions/:version` is used instead. Yanked versions are only returned when explicitly pinned.
2. **Download the tarball.** `GET /v1/agents/:scope/:name/versions/:version/tarball`. Content-addressed URL with long-TTL immutable caching — the CLI verifies the content hash on arrival.
3. **Validate locally.** Run `packages/validator` against the downloaded tarball. This should always pass (the backend already validated at publish time), but re-running locally catches truncated downloads and tampered caches.
4. **Show the install plan.** Exactly which files, plugins, skills, and secrets are about to land on the system:

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
5. **Resolve plugin and skill dependencies.** For each `dependencies.plugins[]` entry, run `openclaw plugins install <spec>`. For each `dependencies.skills[]` entry, run `openclaw skills install <slug>`. Required dependencies that fail to resolve abort the install before any workspace files are written. Optional dependencies prompt the operator.
6. **Check provider prerequisites.** Verify the operator has at least one of the `dependencies.providers.any` providers configured in OpenClaw. If not, prompt to configure one or abort.
7. **Prompt for required secrets.** For each `setup.secrets[]` entry with `target: "env"`, prompt for the value and write `KEY=value` to `~/.openclaw/.env`. Clawstore never stores secret values in its own install record.
8. **Create the workspace directory.** Default: `~/.openclaw/workspace-<id>/`, matching OpenClaw's documented multi-agent convention.
9. **Populate the workspace.** Apply `openclaw.entrypoints` (copy mapped files to their canonical workspace filenames at the workspace root), then `openclaw.templates` (write-once: only if the target does not already exist), then the remaining `files` globs.
10. **Take an initial snapshot.** Store under `~/.clawstore/snapshots/<agent-id>/<timestamp>.tgz`. A later `clawstore rollback` restores to this as the "fresh install" baseline.
11. **Register with OpenClaw.** `openclaw agents add <id> --workspace <path> --model <model>` with values from `agent.defaults`. Optionally call `openclaw agents set-identity` to wire `IDENTITY.md` values.
12. **Write the install record.** `~/.clawstore/installs/<agent-id>.json` captures the resolved version, install timestamp, workspace path, resolved plugin versions, snapshot ids, and the source (catalog vs. sideload).
13. **Print the ready-to-use hint.** `Start a session: openclaw chat calorie-coach`.

If any step fails after workspace creation (step 8), the staging and workspace directories are torn down and the install record is not written. Plugin and secret state already applied is left in place — other agents may depend on the same plugins.

## Sideloading

```
$ clawstore install ./my-agent.tgz
$ clawstore install https://example.com/agent.tgz
```

Same flow, but skips the catalog lookup. The install record is marked `source: "sideload"` so background update polling never touches it — sideloaded agents update only when the operator explicitly runs `clawstore install` again against a newer file. Intended for local development and private sharing.

## `clawstore uninstall`

```
$ clawstore uninstall calorie-coach
```

1. Read the install record.
2. Call `openclaw agents delete <id>` to remove the entry from `agents.list`.
3. **Prompt: preserve user files?** Default yes. On yes, move `MEMORY.md`, any materialized `USER.md`, operator-authored notes, and any other non-vendor-managed files to `~/.clawstore/orphans/<agent-id>-<timestamp>/`. The user-state boundary from [Agent Package § User-state boundary](agent-package.md#user-state-boundary) decides what's vendor vs. operator.
4. **Prompt: uninstall plugin dependencies?** Show each plugin with a note: "also used by `<other agent ids>`" or "not used elsewhere." Default NO — safer to leave plugins installed; operators who care can prune manually.
5. Delete the workspace directory.
6. Remove the install record.
7. Keep snapshots in place for a configurable retention period (default 30 days) in case the operator reinstalls and wants their old data back.

Uninstalling is deliberately conservative. The hard rule is that nothing the operator created gets deleted without an explicit yes.

## `clawstore doctor`

```
$ clawstore doctor
$ clawstore doctor calorie-coach
$ clawstore doctor --fix
```

Detects and optionally fixes drift between the install record and what's actually on disk:

- Workspace directory missing.
- Entrypoint file missing or hash mismatch (operator edited a vendor-managed file; warn, offer to re-copy).
- Plugin dependency missing (plugin was uninstalled out of band — detected via `openclaw plugins list`).
- Secret declared in `setup.secrets` but absent from `~/.openclaw/.env` (for `target: "env"` entries).
- Install record references a version no longer in the catalog (orphaned install — still works, but future updates unavailable).
- Stale graveyard directories from interrupted updates.
- Stale snapshot files beyond retention.

`--fix` performs a re-install against the recorded version without touching user files. It uses the same install pipeline as a fresh install but with preservation rules borrowed from [Update and Rollback § Apply workspace changes atomically](update-and-rollback.md#apply-workspace-changes-atomically).

## Files on disk

Every file Clawstore writes to the operator's machine, for auditability:

```
~/.clawstore/
├── config.json              # operator prefs: default update policy, backend base URL
├── auth.json                # API token (0600), obtained via `clawstore login`
├── api-cache/               # short-TTL response cache for the backend API
├── installs/
│   └── <agent-id>.json      # install record per agent
├── snapshots/
│   └── <agent-id>/
│       └── <timestamp>.tgz  # vendor-managed state snapshots
├── graveyard/               # renamed-not-deleted old workspaces, cleaned by `prune`
├── orphans/                 # user files preserved from uninstalls
├── staging/                 # in-flight install/update work, cleaned on success
└── preview/                 # scratch workspaces for `clawstore preview`
```

The agent workspace itself lives under `~/.openclaw/workspace-<id>/`, which is OpenClaw's territory — Clawstore only populates it. Clawstore may also write secret key/value pairs to `~/.openclaw/.env` when an installed agent declares `setup.secrets[].target: "env"`.

## Cross-references

- [Update and Rollback](update-and-rollback.md) — update detection, diffing, snapshots, rollback
- [Agent Package § User-state boundary](agent-package.md#user-state-boundary) — what's preserved vs. replaced
- [OpenClaw Integration](openclaw-integration.md) — every OpenClaw command Clawstore invokes
- [CLI Reference](cli.md) — operator commands at a glance
- [Documentation hub](README.md)
