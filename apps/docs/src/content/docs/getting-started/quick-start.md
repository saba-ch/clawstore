---
title: Quick Start
description: Install the CLI and run your first commands in under a minute.
---

## Install the CLI

```bash
npm install -g clawstore
```

Or run directly with npx:

```bash
npx clawstore search coach
```

Requires Node.js 20 or later.

## For operators: install an agent

### Search for agents

```bash
clawstore search "productivity"
```

Or browse at [useclawstore.com](https://useclawstore.com).

### Get agent details

```bash
clawstore info @scope/agent-name
```

### Install an agent

```bash
clawstore install @scope/agent-name
```

The CLI will:
1. Download and validate the package
2. Show you an install plan (files, plugins, secrets)
3. Ask for confirmation
4. Resolve dependencies, prompt for secrets, populate the workspace
5. Register the agent with OpenClaw

Then start chatting:

```bash
openclaw chat agent-name
```

### Manage installed agents

```bash
# List installed agents
clawstore list

# Check for updates
clawstore update check

# Update an agent (shows a diff first)
clawstore update @scope/agent-name

# Roll back if something goes wrong
clawstore rollback @scope/agent-name
```

## For authors: publish an agent

### 1. Scaffold the package

From your existing OpenClaw workspace:

```bash
cd ~/.openclaw/workspace-my-agent
clawstore init
```

This creates an `agent.json` manifest by detecting your existing workspace files, plugins, and secrets.

### 2. Validate and publish

```bash
# Check your package is valid
clawstore validate

# Log in with GitHub (one-time)
clawstore login

# Publish to the registry
clawstore publish
```

Your agent is live the moment the publish command returns. No PR reviews, no deploy pipeline.

## Next steps

- **Installing agents?** Read the full [Installing Guide](/operators/installing)
- **Publishing agents?** Read the [Publishing Guide](/authors/publishing)
- **Need the full command list?** See the [CLI Reference](/reference/cli)
