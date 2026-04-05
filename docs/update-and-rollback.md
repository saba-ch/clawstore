# Update and Rollback

The operator-side counterpart to publish. Updates are where store trust is built or lost: the operator has to believe that Clawstore will not clobber their work, will tell them exactly what it's about to do, and will let them undo it if they change their mind.

Two invariants govern every update:

1. **Nothing the operator authored gets replaced silently.** `MEMORY.md`, materialized `USER.md`, and operator-created notes are preserved by code, not by convention. See [Agent Package § User-state boundary](agent-package.md#user-state-boundary).
2. **Every update is rollback-able.** A snapshot of the vendor-managed file set is taken before a single file is touched, and `clawstore rollback` restores it with the same atomic-rename pattern the update uses.

## Update detection

Update mode is per-agent, stored in each agent's install record. The operator picks it — it is not a manifest field.

| Mode | Behavior |
|---|---|
| **`manual`** (default) | Nothing happens automatically. Operator runs `clawstore update check` or `clawstore update <id>` explicitly. |
| **`prompt`** | The CLI checks for updates on every invocation via `POST /v1/updates`. If updates exist, prints a single line at the bottom of any command output: `2 updates available. Run 'clawstore update' to review.` |
| **`auto`** | New stable versions (not pre-releases, not major bumps) install silently at next check. Major bumps still prompt. |

Global default is `manual`. Auto-updating third-party content on someone's machine without explicit consent is exactly the kind of thing that gets stores banned.

Set policy per agent:

```
$ clawstore policy @someone/calorie-coach prompt
```

Bulk update checks hit `POST /v1/updates` with `{ installs: [{ id, version }, ...] }` and receive `{ updates: [{ id, from, to, channel, yanked }] }` in one round-trip. See [Backend API § Updates](backend-api.md#updates).

## The update command

```
$ clawstore update @someone/calorie-coach
```

Full sequence, in order. Any step's failure aborts the update and leaves the previous install untouched.

### Resolve

- Read `~/.clawstore/installs/<agent-id>.json` — current version, install timestamp, workspace path, resolved plugin versions, snapshot ids.
- `GET /v1/packages/:scope/:name` for the current published manifest. Compare versions.
- No newer version: exit 0 with "already up to date."
- Newer version: fetch `GET /v1/packages/:scope/:name/versions/:new` (detail blob) and `GET /v1/packages/:scope/:name/versions/:new/tarball` (content).

### Show the diff

Before touching anything, show the operator exactly what changes:

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

The file list comes from diffing the vendor-managed file set of the old install against the new agent's resolved file set. This is the single most important UX in Clawstore: the operator sees exactly what's about to happen before any byte moves.

### Snapshot

- Compress the current workspace's vendor-managed files to `~/.clawstore/snapshots/<agent-id>/<timestamp>.tgz`.
- Record the snapshot id in the install record.
- Keep the last 5 snapshots per agent. Older ones are garbage-collected on next update or `clawstore prune`.

### Validate the new agent

- Run `packages/validator` against the downloaded tarball locally. The server already ran it at publish time; re-running locally catches truncated downloads and tampered caches.
- Any finding aborts — the old install stays intact.

### Resolve plugin changes

- For each plugin in the new `dependencies.plugins` that either (a) didn't exist in the old version or (b) has a changed `minVersion`: `openclaw plugins install <spec>`.
- For each plugin **removed** from `dependencies.plugins`: do NOT uninstall automatically. Other agents or the operator may depend on it. Record the removal in the install record so `clawstore uninstall` can offer to clean it up later.
- Any plugin install failure aborts before touching workspace files.

### Resolve secret changes

- New entries in `setup.secrets[]` with `target: "env"`: prompt for the value, append to `~/.openclaw/.env`.
- Removed secrets: leave them in `.env`. The operator may still need them for other purposes.

### Apply workspace changes atomically

Standard safe-update pattern, with a graveyard escape hatch:

1. Create a staging directory `~/.clawstore/staging/<agent-id>-<new-version>/`.
2. Extract the new agent into staging.
3. Apply `openclaw.entrypoints` (copy entrypoint-mapped files to canonical workspace filenames at the staging root).
4. Write `openclaw.templates` entries only if the target does not already exist in the current workspace (templates are write-once, per [Agent Package § Workspace file conventions](agent-package.md#workspace-file-conventions)).
5. Apply `files` globs to copy the remaining vendor-managed tree into staging.
6. Copy user-managed files from the current workspace into staging: `MEMORY.md`, any previously materialized `USER.md`, operator-authored notes. `BOOTSTRAP.md` is copied only if it still exists in the current workspace — a deleted `BOOTSTRAP.md` must not be recreated.
7. **Rename** the current workspace to `~/.clawstore/graveyard/<agent-id>-<timestamp>/`. Rename is atomic on POSIX and gives the rollback escape hatch.
8. **Rename** staging into the workspace path.
9. Any failure mid-sequence: rename graveyard back, clean up staging, abort with a clear error.

The graveyard is cleaned up on the next successful update or an explicit `clawstore prune`.

### Update agent config (if needed)

- Compare old `agent.defaults` to new.
- If `model`, `thinking`, or any other agent-level default changed: OpenClaw has no in-place `agents update` command, so the documented path is `openclaw agents delete <id>` followed by `openclaw agents add <id> --workspace <path> --model <model>` using the same workspace path. This preserves workspace and session state.
- If nothing at the `agents.list` level changed: do not touch the entry. Leave the operator's customizations alone.

### Record the new state

- Write the updated install record with the new version, new snapshot id, new timestamp, new resolved plugin versions.
- Print the success message and the rollback hint: `clawstore rollback <id>`.

## Rollback

```
$ clawstore rollback @someone/calorie-coach
```

- Read the latest snapshot id from the install record.
- Extract the snapshot into a fresh staging directory.
- Apply the same atomic rename as update: current workspace → graveyard, staging → workspace.
- Update the install record's version back to the previous one.
- Does NOT revert plugin updates — those may have been shared with other agents. Print a notice about plugin versions the rollback cannot undo.

Rollback is deliberately one level deep. If the operator wants to roll back twice, they rollback once, then re-update to an older pinned version.

## Failure modes

| Failure | Behavior |
|---|---|
| Network down during fetch | Abort before any workspace changes. |
| Validation fails on new agent | Abort, keep old install. |
| Plugin install fails mid-update | Abort, keep old install, clear staging. |
| Operator cancels at diff prompt | Abort, nothing touched. |
| Disk full during rename | Graveyard is still intact; rename back, abort. |
| Operator Ctrl-C during rename | Same — graveyard recovery. |
| Process killed between renames | On next Clawstore invocation, detect orphaned graveyard and offer to recover. |

The invariant: at every failure point, either the old install is fully intact, or the graveyard holds enough state to reconstruct it.

## Cross-references

- [Install Flow](install-flow.md) — the first-time install path
- [Backend API § Updates](backend-api.md#updates) — the batch update-check endpoint
- [Agent Package § User-state boundary](agent-package.md#user-state-boundary) — what's preserved
- [OpenClaw Integration](openclaw-integration.md) — the `agents delete` + `agents add` sequence
- [Documentation hub](README.md)
