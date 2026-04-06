# Trust and Moderation

Clawstore is an open-publish registry: any authenticated GitHub user can publish, there is no PR review, there is no human in the hot path. That only works if the technical trust model is strict and the moderation model is reactive-but-real. This document is the honest accounting of what's enforced, what isn't, and why.

## What Clawstore enforces

Hard guarantees, implemented in code and impossible to bypass through the normal publish path.

| Enforcement | How |
|---|---|
| **Agents are inert content.** | Shared `@clawstore/validator` library runs both locally (`clawstore validate`) and server-side on `POST /v1/publish`. Rejects any executable bit, any blocked extension (`.sh`, `.js`, `.ts`, `.py`, `.exe`, `.dll`, …), and any known binary format that smells executable (ELF, Mach-O, PE). See [Agent Package § What ships, what doesn't](agent-package.md#what-ships-what-doesnt). |
| **Authenticated publish with per-ID ownership.** | Better Auth handles GitHub OAuth. Publishing requires a bearer token resolved to a user. First publish of an `id` claims it; every subsequent publish checks `packages.owner_user_id === caller.id`. See [Auth and Ownership](auth-and-ownership.md). |
| **Immutable versions.** | D1 unique constraint on `(scope, name, version)` plus an application-level "insert only, never update" rule. Authors can yank a version (hide from resolution) but cannot overwrite. See [Data Model § Immutability rules](data-model.md#immutability-rules). |
| **Secret scanning at publish time.** | Publish endpoint rejects agents that contain API-key-looking strings in shipped content: AWS keys, OpenAI keys, generic `[A-Z_]+_API_KEY=...`, etc. Hard fail, not a warning. |
| **Plugin and skill dependencies flow through OpenClaw's own scanners.** | Clawstore never re-implements plugin security; `openclaw plugins install` runs OpenClaw's existing `install-security-scan` and update pipeline. Clawstore only verifies reachability at publish time (the spec resolves to a real package). |
| **Validator parity between CLI and backend.** | One library, imported by both. No "server has stricter rules" case. If the CLI says valid, the server says valid, and vice versa. Any server-only check (authentication, ownership, version monotonicity) is by definition a check the CLI cannot run without contacting the backend, and those are enumerated explicitly in [Publish Flow § Step 6](publish-flow.md#step-6-clawstore-publish). |

There is no separate CI gate. The publish endpoint itself is the gate. The only CI in the Clawstore monorepo is the standard lint + type-check + unit-test pipeline that runs on the repo's own source — the validator library's tests, `apps/api` integration tests, etc.

## What Clawstore does not enforce (MVP)

Gaps we know about. Shipped with them on purpose; each has a v2 path.

| Gap | v2 path |
|---|---|
| **Cryptographic signing.** | MVP trusts GitHub OAuth + server-stored API tokens. v2 adds a per-author signing key and verifies agent signatures at publish time. Operators verify on install. |
| **Automated content moderation.** | MVP is reactive: report button + moderation queue + yank/delist tools. No pre-publish human gate, no LLM-based content classifier. If abuse outpaces reactive moderation, add scanners. |
| **Prompt-injection analysis.** | A malicious agent could craft content designed to jailbreak operator-owned agents via shared context (shared memory, shared knowledge files). Out of scope for MVP. Flagged for post-MVP research. |
| **Install telemetry.** | No counts of real-world installs. Download counter on versions is incremented on tarball fetch, but a fetch is not an install and we do not publish the number until it is signal-rich enough to be useful. |

## The one hard line

**No code in agents. Ever.**

The moment agents can run code, the security story collapses into "re-invent plugin sandboxing," and Clawstore loses its main differentiator — that agents are auditable by humans in under a minute. If an agent needs runtime behavior beyond reading files, it adds a plugin to `dependencies.plugins`. That plugin goes through OpenClaw's existing security review. Clean separation.

No "we'll allow signed scripts" compromise. No "only in the official channel" compromise. No code, full stop.

## Publish-time validation

Every check that runs at publish time is listed in [Publish Flow § Step 6](publish-flow.md#step-6-clawstore-publish). Two notes on implementation:

- **Deterministic parity.** CLI and backend import the *same* `@clawstore/validator` binary. Zero divergence between "clean locally" and "accepted remotely" for the content-level checks.
- **Server-only checks are explicit.** Authentication, ownership, and version monotonicity are the only checks the CLI cannot run — because they require database state the CLI does not have. Everything else the CLI can verify before hitting the network.

## Moderation flow

Post-hoc. No human on the hot path. The pipeline:

1. **Report.** Every detail page on `useclawstore.com` has a report button. Operators without accounts can file a report; rate-limited hard per IP (10 per hour — see [Backend API § Rate limits](backend-api.md#rate-limits)). Optional auth lets maintainers cross-reference reports against the reporter.
2. **Queue.** Reports land in the `reports` table in D1 and show up in the maintainer queue. See [Data Model § `reports`](data-model.md#reports).
3. **Triage.** Maintainers review the report, fetch the offending version, and decide: dismiss, yank the version, delist the package, or escalate.
4. **Action.**
   - **Yank.** `POST /v1/agents/:scope/:name/versions/:version/yank` — hides from resolution but keeps the row for audit. Reversible by a maintainer via `unyank` (owners cannot unyank their own yanked versions, to avoid accidental re-exposure of bad content).
   - **Delist the whole package.** Hides every version of a package. Same audit-trail guarantee as yank.
   - **Escalate.** Out-of-band process, e.g. for GitHub TOS violations that need the author's OAuth account revoked — not something the CLI or web can do directly.
5. **Close the report.** `POST /v1/reports/:id/resolve` with the disposition. The queue stays clean.

### Review moderation

Reviews follow the same reactive moderation model as packages. There is no pre-publish review gate.

**What's enforced:**
- One review per user per agent (database constraint).
- Agent owners cannot review their own agents (application-level 403).
- Rate-limited to 30 review writes per hour per user.
- Review text is capped (title: 120 chars, body: 2000 chars).

**What's not enforced (MVP):**
- No automated spam detection or sentiment analysis on review text.
- No "verified install" badge — Clawstore does not track whether the reviewer actually installed the agent, because install telemetry is client-side only.

**Moderation flow for reviews:**
- Users can report a review the same way they report a package — via the report button.
- Maintainers can delete any review via `DELETE /v1/agents/:scope/:name/reviews/:id`. The review row is hard-deleted, and the agent's `avg_rating` and `review_count` are recalculated.
- If review abuse becomes systematic (coordinated downvoting, spam rings), the v2 path is to add review-specific flags to the `reports` table and automated detection. Not built at MVP.

### Channels

Moderation behavior differs slightly by channel, but the flow is the same:

- **`community`** — default home of open publish. Reports land in the shared queue.
- **`official`** — curated allowlist, same publish flow but with a `channel: "official"` flag that only maintainers can set. Reports against official packages are flagged for faster triage.
- **`private`** — post-MVP. Resolvable only by authenticated members of the owning org. Reporting is internal.

See [Data Model § Channels](data-model.md#channels) for how this is persisted.

## The trust contract with operators

Clawstore makes three promises to operators:

1. **No package is executable.** Enforced by the validator, at both ends.
2. **Installing a package cannot modify files the operator created.** Enforced by the user-state boundary in the install and update pipelines. See [Agent Package § User-state boundary](agent-package.md#user-state-boundary).
3. **Every update is rollback-able and every uninstall preserves operator files by default.** Enforced by snapshots and the atomic rename + graveyard pattern. See [Update and Rollback](update-and-rollback.md).

Everything else — whether a particular agent's knowledge base is accurate, whether its persona is safe for a given audience, whether its author is trustworthy — is the operator's judgment call, informed by the package content they can read before they install.

## Cross-references

- [Publish Flow](publish-flow.md) — the full publish pipeline and validator order of operations
- [Auth and Ownership](auth-and-ownership.md) — how the owner claim works
- [Backend API § Reports and moderation](backend-api.md#reports-and-moderation) — endpoint contracts
- [Data Model § `reports`](data-model.md#reports) — the reports table
- [Documentation hub](README.md)
