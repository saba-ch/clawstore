# Clawstore

## An App Store for AI Agents

You built a useful OpenClaw agent. It has a persona, a workspace full of reference knowledge, a few plugin dependencies, and the right operating instructions. It works. People want it.

Today, the only way to share it is to tell someone "clone this repo, copy these files into your workspace, install these plugins, set these env vars, then `openclaw agents add`." That's not distribution. That's a README and hope.

Clawstore removes that wall. Publish your agent once with `clawstore publish`. Anyone can install it with `clawstore install @you/your-agent`. The dependencies resolve, the secrets get prompted for, the workspace populates, OpenClaw registers the agent. One command in, one command out.

## What this looks like

```
You:        clawstore install @someone/calorie-coach

Clawstore:  Calorie Coach 0.3.1 by @someone
            Log meals by chat, get daily nutrition summaries

            This package will:
              - create workspace at ~/.openclaw/workspace-calorie-coach
              - install 1 required plugin: @someone/nutrition-api 1.2.0
              - prompt for 1 secret: NUTRITIONIX_API_KEY
              - register agent in OpenClaw with model openai/gpt-5.4

            Proceed? [Y/n] y

            Installing plugin @someone/nutrition-api... done
            NUTRITIONIX_API_KEY: ***************
            Writing workspace files... 14 files, 112 KB
            Registering agent with OpenClaw... done

            Calorie Coach is ready.
            Start a session: openclaw chat calorie-coach

You:        openclaw chat calorie-coach

Agent:      Hey. Log a meal by describing it, ask me for nutrition
            info, or say "summary" for today's totals. What did you
            have?
```

From share link to working agent in under a minute. Clawstore installed the app; OpenClaw runs it.

## How it works

```
Any OpenClaw user  ->  clawstore CLI  ->  Clawstore API  ->  OpenClaw + ClawHub
                                          (packages)           (plugins, skills,
                                                                 agent registry)
```

1. Authors publish agent packages through an authenticated API (`clawstore login` with GitHub, `clawstore publish`).
2. Operators discover packages on `clawstore.dev` or via `clawstore search`.
3. The CLI downloads the package, resolves its plugin and skill dependencies through OpenClaw's existing install flows, prompts for required secrets, populates the workspace, and registers the agent.
4. The package itself is inert content — markdown, JSON, images, reference files. No executable code, ever.

Every installed agent stays updateable, rollback-able, and safely uninstallable. User-created files like `MEMORY.md` are preserved across every lifecycle operation.

## What an agent package is

An **agent package** is everything an operator needs to install and run an agent *except* the things that come from somewhere else:

**In the package**:
- Store metadata: name, description, tagline, category, screenshots, icon
- Persona files: `AGENTS.md`, `SOUL.md`, `USER.md` template, `TOOLS.md`, `IDENTITY.md`
- Workspace content: curated markdown, knowledge files, JSON data
- Declared dependencies: plugin specs, skill slugs, required secrets, provider prerequisites
- A manifest (`agent.json`) that ties it all together

**Not in the package**:
- Plugin binaries or skill bundles (installed separately through OpenClaw / ClawHub)
- Operator secrets (prompted at install time, written to `~/.openclaw/.env`)
- User state (`MEMORY.md`, notes, logs — always operator-owned)
- Any executable file

The boundary is deliberate: Clawstore ships the *app*, not the runtime. That keeps packages human-auditable in under a minute and keeps the security story clean.

## What you get

**For authors**:
- `clawstore init` scaffolds a package from your existing OpenClaw workspace
- `clawstore validate` runs the exact checks the server will run on publish — no surprises
- `clawstore preview` installs your package into a scratch workspace so you can feel the first-run UX
- `clawstore publish` uploads the package with a single command after `clawstore login`
- Immutable versioned publishes: you can yank a bad release but you can never accidentally overwrite a good one

**For operators**:
- One command to install, one to update, one to uninstall, one to roll back
- A diff UI that shows exactly which files and dependencies will change on update
- Automatic snapshots before every update, with `clawstore rollback` as an escape hatch
- A `clawstore doctor` command that detects and repairs drift between installed agents and their install records
- `clawstore.dev` for browsing, searching, and inspecting packages before you install them

**For the ecosystem**:
- Clawstore lives alongside OpenClaw and ClawHub. It never forks either, never patches core, never replaces the plugin or skill install flows.
- Every documented OpenClaw CLI surface Clawstore touches is enumerated up front. If those contracts change, Clawstore adapts.

## Who it is for

- **Agent authors** who have built a useful OpenClaw agent and want a real distribution channel instead of README-and-hope
- **Operators** who want to try agents built by other people without cloning repos, reading setup instructions, and manually wiring plugin dependencies
- **Teams** building on OpenClaw who need a consistent way to ship internal agents across their organization

Clawstore is *not*:
- A marketplace for plugins or skills (use ClawHub)
- A replacement for OpenClaw's runtime (Clawstore only distributes; OpenClaw still runs)
- A code distribution system (agents are inert content, enforced by validation)
- A paid store (no payments, no ratings, no install telemetry at launch)

## Current status

Pre-code. Architecture, stack, and data model are locked. Implementation begins from the [Documentation hub](README.md).

Relationship with the sibling ecosystem:

- **OpenClaw** — the runtime. Clawstore depends on documented public CLI surfaces only.
- **ClawHub** — the plugin and skill registry. Clawstore resolves plugin/skill dependencies through it at install time.
- **Clawstore** — the agent package registry and distribution layer. Third-party, not a fork.
