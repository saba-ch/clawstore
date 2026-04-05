# Clawstore

An app-store-style discovery and install experience for [OpenClaw](https://github.com/openclaw/openclaw) agents. Third-party project, not a fork of or contribution to OpenClaw core.

## What it is

- A format for shipping a **complete agent package**: persona, workspace files, store metadata, and dependency declarations.
- A **static git-backed registry** of public agent packages.
- A **discovery website** for browsing, searching, and previewing agents before installing.
- A **CLI** (`clawstore`) that installs, updates, uninstalls, previews, and publishes agent packages by gluing together OpenClaw's public CLI surfaces.

## What it is not

Clawstore is **not** a marketplace for executable extensions.

- **Skills and plugins stay on ClawHub / OpenClaw install flows.**
- **Agent packages only declare dependencies.** They do not vendor plugins, skills, or arbitrary code.
- **User state is never part of the package.** `MEMORY.md`, notes, logs, and other user-managed files stay local and are preserved across updates.

The intended model is the same as an app store that installs an app but asks the operator to install external runtime dependencies separately. Clawstore ships the agent app. ClawHub ships the dependencies.

## Why it exists

OpenClaw already has strong primitives for agent workspaces, skills, plugins, and auth. What it does not have yet is a clean distribution layer for shipping a complete agent as a product.

Example: "Calorie Coach" should be installable as a full agent app with:

- a persona and operating instructions
- curated workspace files and reference data
- screenshots, description, and store metadata
- declared plugin and skill dependencies
- required setup steps such as secrets or provider prerequisites

Clawstore adds that layer without patching OpenClaw core.

## Status

Whiteboarding / planning. No code yet. See [`docs/PLAN.md`](docs/PLAN.md) for the implementation plan.

## Core design decisions

- **Primary unit = agent package.** Clawstore distributes complete agents, not individual skills or plugins.
- **Dependencies are declared, not bundled.** Required plugins are installed through `openclaw plugins install`; optional or required skills stay on ClawHub / `openclaw skills install`.
- **Packages are inert content.** No executables, no scripts, no vendored runtime code. Registry CI enforces that boundary.
- **The package owns only vendor-managed workspace files.** User-managed files are preserved on update and uninstall.
- **Registry is a git repo.** One package per folder, versioned by directory, published through pull requests.
- **Website is static.** Reads generated catalog JSON. Zero backend for MVP.

## Non-goals (MVP)

- Payments / paid agents
- Ratings or reviews
- Per-user install telemetry
- Auto-update by default
- Shared knowledge packs between packages
- Localization
- One-click custom URL scheme install

All of these can come later if the concept works.
