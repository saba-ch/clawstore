---
title: Trust & Safety
description: What Clawstore enforces, what it doesn't, and how moderation works.
---

Clawstore is an open-publish registry — any authenticated GitHub user can publish. There's no PR review and no human in the hot path. This page explains the security model and moderation approach.

## What Clawstore enforces

Hard guarantees implemented in code:

| Guarantee | How it works |
|-----------|-------------|
| **Agents are inert content** | The validator rejects any executable bit, blocked extensions (`.sh`, `.js`, `.py`, `.exe`, etc.), and known binary formats. Runs both locally and server-side. |
| **Authenticated publish** | Publishing requires GitHub OAuth. First publish claims the package ID; subsequent publishes check ownership. |
| **Immutable versions** | Published versions can never be overwritten. Yanking hides a version but doesn't delete it. |
| **Secret scanning** | Publish rejects files containing API-key-like strings (AWS keys, OpenAI keys, etc.). Hard fail, not a warning. |
| **Plugin security via OpenClaw** | Plugin dependencies flow through `openclaw plugins install` and OpenClaw's existing security pipeline. Clawstore only verifies reachability at publish time. |
| **Validator parity** | CLI and server run the exact same validator library. If it's clean locally, it's accepted remotely. |

## The one hard line

**No code in agents. Ever.**

No executable files, no scripts, no "we'll allow signed scripts" compromise. If an agent needs runtime behavior beyond reading files, it adds a plugin to `dependencies.plugins`, and that plugin goes through OpenClaw's security review.

This is what keeps packages human-auditable in under a minute.

## Known gaps (MVP)

Shipped intentionally, each with a planned path forward:

| Gap | Future plan |
|-----|-------------|
| **No cryptographic signing** | MVP trusts GitHub OAuth + server tokens. v2 adds per-author signing keys with install-time verification. |
| **No automated content moderation** | Moderation is reactive (report + yank). If abuse outpaces response, add automated scanners. |
| **No prompt-injection analysis** | A malicious agent could craft content to influence other agents via shared context. Flagged for post-MVP research. |
| **No install telemetry** | Download counts are based on tarball fetches, not confirmed installs. |

## How moderation works

Moderation is **post-hoc** — no human blocks the publish path.

### The flow

1. **Report** — every detail page on useclawstore.com has a report button. Rate-limited to 10 per hour per IP.
2. **Queue** — reports land in the moderation queue for maintainers.
3. **Triage** — maintainers review the report and the offending version.
4. **Action:**
   - **Yank** the version (hide from resolution, keep for audit)
   - **Delist** the whole package (hide all versions)
   - **Escalate** for GitHub TOS violations
5. **Close** the report with a disposition.

### Review moderation

Reviews follow the same reactive model:

- One review per user per agent
- Owners can't review their own packages
- Rate-limited to 30 review writes per hour
- Maintainers can delete any review (spam, abuse)

## The trust contract

Clawstore makes three promises to operators:

1. **No package is executable.** Enforced by the validator at both ends.
2. **Installing can't modify files you created.** Enforced by the user-state boundary in install and update pipelines.
3. **Every update is rollback-able and every uninstall preserves your files by default.** Enforced by snapshots and atomic rename patterns.

Everything else — whether an agent's knowledge base is accurate, whether its persona is safe, whether its author is trustworthy — is the operator's judgment call, informed by the package content they can read before installing.

## Channels

| Channel | Description |
|---------|-------------|
| **`community`** | Default. Open publish. Reports go to the shared moderation queue. |
| **`official`** | Curated allowlist. Same publish flow but only maintainers can set the `official` flag. Faster moderation triage. |
| **`private`** | Post-MVP. Only accessible to authenticated org members. |
