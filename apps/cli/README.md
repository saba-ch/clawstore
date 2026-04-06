<p align="center">
  <h1 align="center">Clawstore</h1>
  <p align="center"><strong>The package manager for OpenClaw agents.</strong></p>
  <p align="center">
    Discover, install, and publish AI agent packages.<br/>
    One command to add any agent to your OpenClaw setup.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/clawstore"><img src="https://img.shields.io/npm/v/clawstore" alt="npm version"></a>
  <a href="https://github.com/saba-ch/clawstore/blob/main/LICENSE"><img src="https://img.shields.io/github/license/saba-ch/clawstore" alt="license"></a>
  <a href="https://github.com/saba-ch/clawstore/actions/workflows/ci.yml"><img src="https://github.com/saba-ch/clawstore/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <a href="https://useclawstore.com">Website</a> ·
  <a href="#install">Install</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#publishing">Publishing</a> ·
  <a href="#commands">Commands</a>
</p>

---

[OpenClaw](https://github.com/openclaw/openclaw) agents are powerful — but finding and sharing them is hard. There's no central place to browse what's available, no standard way to package an agent, and no `install` command.

**Clawstore is a package registry and CLI for OpenClaw agents.** Think npm for AI agents — search the store, install with one command, publish your own.

```bash
# Install an agent
clawstore install @saba-ch/calorie-coach

# Search the registry
clawstore search "productivity"

# Publish your own
clawstore publish ./my-agent
```

> **What ships in a package:** persona files, workspace data, knowledge bases, store metadata, and dependency declarations — everything needed to run an agent. OpenClaw handles execution.

## Install

```bash
npm install -g clawstore
```

Or run directly with npx:

```bash
npx clawstore search coach
```

## Usage

### Browse and install agents

```bash
# Search by keyword
clawstore search "code review"

# Get details about an agent
clawstore info @scope/agent-name

# Install an agent
clawstore install @scope/agent-name

# Install a specific version
clawstore install @scope/agent-name@1.2.0

# List installed agents
clawstore list

# Check for updates
clawstore update
```

### Browse on the web

Visit [useclawstore.com](https://useclawstore.com) to browse agents by category, read descriptions, and see download stats.

## Publishing

### 1. Create your agent package

```bash
clawstore init
```

This scaffolds an `agent.json` manifest and the recommended directory structure:

```
my-agent/
├── agent.json          # Package manifest
├── app/
│   ├── IDENTITY.md     # Agent persona
│   ├── AGENTS.md       # Agent capabilities
│   └── knowledge/      # Knowledge base files
└── store/
    ├── icon.png        # Store listing icon
    └── screenshots/    # Store listing screenshots
```

### 2. Validate and publish

```bash
# Check your package is valid
clawstore validate

# Preview the tarball
clawstore pack

# Log in with GitHub
clawstore login

# Publish to the registry
clawstore publish
```

## Commands

| Command | Description |
|---------|-------------|
| `clawstore search <query>` | Search for agents |
| `clawstore info <id>` | Show agent details |
| `clawstore install <id>` | Install an agent |
| `clawstore list` | List installed agents |
| `clawstore update` | Check for updates |
| `clawstore init` | Scaffold a new agent package |
| `clawstore validate` | Validate agent.json and package structure |
| `clawstore pack` | Create a tarball preview |
| `clawstore login` | Authenticate with GitHub |
| `clawstore publish` | Publish to the registry |
| `clawstore yank <id@version>` | Yank a published version |

## Links

- [Website](https://useclawstore.com) — browse agents, categories, and user profiles
- [API](https://api.useclawstore.com/v1/health) — REST API for the registry
- [Agent package format](https://github.com/saba-ch/clawstore/blob/main/docs/agent-package.md) — full spec for `agent.json`
- [Publish flow](https://github.com/saba-ch/clawstore/blob/main/docs/publish-flow.md) — how publishing works end to end

---

<p align="center">
  Built by <a href="https://github.com/saba-ch"><strong>Saba</strong></a> · MIT License
</p>
