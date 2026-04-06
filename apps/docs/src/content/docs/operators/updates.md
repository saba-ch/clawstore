---
title: Updates & Rollback
description: How to update agents, review changes before they land, and roll back if needed.
---

Two invariants govern every update:

1. **Nothing you created gets replaced silently.** `MEMORY.md`, notes, and operator-created files are always preserved.
2. **Every update is rollback-able.** A snapshot is taken before any file is touched.

## Update policies

Each agent has an update policy stored in its install record:

| Policy | Behavior |
|--------|----------|
| **`manual`** (default) | Nothing automatic. Run `clawstore update` explicitly. |
| **`prompt`** | Prints a one-liner when updates exist: `2 updates available. Run 'clawstore update' to review.` |
| **`auto`** | New stable versions install silently. Major bumps still prompt. |

Set the policy per agent:

```bash
clawstore policy @someone/calorie-coach prompt
```

## Checking for updates

```bash
clawstore update check
```

Dry run — shows available updates without installing anything. Checks all installed agents in one API call.

## Updating an agent

```bash
clawstore update @someone/calorie-coach
```

### The diff

Before touching anything, Clawstore shows exactly what will change:

```
Calorie Coach 0.3.1 -> 0.4.0

Files changed:
  M  AGENTS.md                            (rules/nutrition.md updated)
  M  knowledge/nutrition/macros.md
  A  knowledge/foods/restaurants.md       (NEW — 12 chains added)
  D  knowledge/foods/old-data.md          (removed)

Plugin dependencies:
  @someone/nutrition-api  1.2.0 -> 1.3.0   (minor bump, will update)
  @someone/image-vision   unchanged

Secrets required:
  NUTRITIONIX_API_KEY     already configured
  OPENAI_API_KEY          NEW — will prompt

User files (preserved):
  MEMORY.md
  notes/ (4 files)

Proceed? [Y/n]
```

This is the most important UX in Clawstore: you see exactly what's about to happen before any byte moves.

### What happens on update

1. **Snapshot** — backs up current vendor-managed files
2. **Validate** — re-validates the new version locally
3. **Resolve plugins** — installs new/updated plugins; doesn't remove old ones automatically
4. **Prompt for new secrets** — only for newly added secrets
5. **Atomic apply** — stages new files, preserves user files, swaps directories atomically
6. **Update record** — saves the new version and snapshot info

### Atomic file swap

Updates use a safe rename pattern:

1. Extract new agent into a staging directory
2. Copy your user files (MEMORY.md, notes, etc.) into staging
3. Rename current workspace to a graveyard directory (atomic on POSIX)
4. Rename staging into the workspace path
5. If anything fails mid-swap, the graveyard is renamed back

The graveyard is cleaned up on the next successful update or by `clawstore prune`.

## Rolling back

```bash
clawstore rollback @someone/calorie-coach
```

Restores the most recent snapshot using the same atomic rename pattern. The install record reverts to the previous version.

:::note
Rollback doesn't revert plugin updates — other agents may share those plugins. You'll see a notice about which plugin versions couldn't be reverted.
:::

Rollback is one level deep. To go back further, roll back once, then install a specific older version:

```bash
clawstore install @someone/calorie-coach@0.3.0
```

## Failure modes

| Failure | What happens |
|---------|-------------|
| Network down during fetch | Abort before any workspace changes |
| Validation fails on new version | Abort, keep old install |
| Plugin install fails | Abort, keep old install, clean staging |
| Operator cancels at diff prompt | Abort, nothing touched |
| Disk full during rename | Graveyard intact, rename back, abort |
| Process killed mid-update | Next Clawstore run detects orphaned graveyard, offers recovery |

At every failure point, either the old install is fully intact, or the graveyard holds enough state to reconstruct it.
