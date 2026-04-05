# Clawstore

An app-store-style discovery and install experience for [OpenClaw](https://github.com/openclaw/openclaw) agents. Third-party project, not a fork of or contribution to OpenClaw core.

Clawstore ships complete agent *apps* — persona, workspace files, store metadata, dependency declarations. Skills and plugins stay on [ClawHub](https://clawhub.ai). OpenClaw runs the installed agent.

## Status

Whiteboarding done, scaffolding next. Design and architecture live in [`docs/`](docs/) — start with [`docs/README.md`](docs/README.md) for the full picture. The original monolithic implementation plan is archived at [`docs/archive/PLAN-2026-04.md`](docs/archive/PLAN-2026-04.md).

## Quick links

- [Documentation hub](docs/README.md) — architecture, stack, design decisions, index of all docs
- [One-pager](docs/one-pager.md) — customer-facing pitch
- [Agent package format](docs/agent-package.md) — `agent.json` and what ships
- [Backend API](docs/backend-api.md) — the REST surface CLI and web both read
- [Data model](docs/data-model.md) — DB schema sketch
