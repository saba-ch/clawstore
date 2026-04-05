# Clawstore

An app-store-style discovery and install experience for [openclaw](https://github.com/openclaw/openclaw) agents. Third-party project — not a fork of or contribution to openclaw core.

## What it is

- A **bundle format** for packaging openclaw agents as inspectable markdown (+ arbitrary reference files).
- A **static git-backed registry** of public bundles.
- A **discovery website** for browsing, searching, and previewing agents before installing.
- A **CLI** (`clawstore`) that handles publish, install, update, uninstall, and doctor flows by gluing openclaw's existing public CLI surfaces.

## Why it exists

Openclaw agents today are config-only and not packageable. Users can't easily discover, install, or share agents built by other people. Clawstore adds that layer without touching openclaw core — everything flows through openclaw's public plugin marketplace, `openclaw agents add`, `openclaw plugin install`, and auth-profile APIs.

## Status

Whiteboarding / planning. No code yet. See [`docs/PLAN.md`](docs/PLAN.md) for the implementation plan, with publish and update lifecycles worked out in detail.

## Core design decisions (locked)

- **Agent = freeform markdown bundle.** Author ships any directory layout they want; a `bundle.json` manifest maps author files to openclaw's four required role filenames (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`).
- **Plugins are referenced, not vendored.** Bundle manifest declares plugin specs; installer resolves them via `openclaw plugin install`.
- **Bundles are inert.** No executables, no scripts. Enforced at registry CI. Trust surface is as small as "can a human read this markdown and decide if it's safe".
- **Registry is a git repo.** One monorepo, one folder per bundle. PRs are the publish mechanism. CI is the validator.
- **Website is static.** Reads a generated `catalog.json`. Zero backend for MVP. Vercel or Cloudflare Pages.
- **MEMORY.md is never shipped.** User state is sacred. Vendor-managed files get replaced on update; user-managed files are preserved.

## Non-goals (MVP)

- Payments / paid agents
- Ratings or reviews (requires backend)
- Per-user install telemetry
- Auto-update by default (opt-in)
- Shared knowledge packs between bundles
- Localization
- Custom browser URL scheme for one-click install

All of these are reachable after MVP if the concept lands.
