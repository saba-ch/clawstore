# Publish Flow

The author's experience, from "I have a working agent on my machine" to "my agent is live on the store." Six CLI commands, one HTTPS upload, no PR reviews, no deploy pipeline.

The flow is designed so that the local validator the author runs (`clawstore validate`) and the server-side validator the backend runs (`POST /v1/agents/publish`) are the same library. If it's clean locally, it's accepted remotely — modulo the server-only checks that the CLI cannot know without contacting the backend (authentication, ownership, version monotonicity).

## Prerequisite: a working agent

The author has been using an OpenClaw agent they built locally — the workspace has real `AGENTS.md`, `SOUL.md`, `USER.md`, `TOOLS.md`, `IDENTITY.md`, plus whatever knowledge files they've accumulated. They want to share it.

An agent package is derived from that workspace, not built from scratch. `clawstore init` meets the author where they already live.

## Step 1: `clawstore init`

```
$ cd ~/.openclaw/workspace-calorie-coach
$ clawstore init
```

- Scans the current directory for the canonical workspace entrypoint files.
- Prompts for `id`, `name`, `tagline`, `category`, `license`.
- Detects plugins currently configured for this agent (reads `openclaw agents list --json` and filters by id) and offers to pre-fill `dependencies.plugins`.
- Detects secrets the agent currently uses and offers to pre-fill `setup.secrets` (keys only, never values).
- Writes an `agent.json` draft.
- Writes a starter store-facing `README.md`.

Outcome: the workspace is now *also* a Clawstore package. The author keeps using it with OpenClaw as before; an `agent.json` at the root does not disturb OpenClaw.

## Step 2: `clawstore validate`

```
$ clawstore validate
```

Pure local, no network. Runs the shared `packages/validator` library — the same code that runs server-side on `POST /v1/agents/publish`. Reports:

- Schema errors in `agent.json`.
- Entrypoint resolution errors (files named in `openclaw.entrypoints` or `openclaw.templates` that do not exist in the package tree).
- `files` glob results (the full file list that would be shipped).
- Size and file-count against the limits in [Agent Package § Size limits](agent-package.md#size-limits).
- Broken internal references (e.g. `AGENTS.md` says "read `knowledge/foods/fruits.md`" but no such file exists in the package).
- Executable or rejected-file-type findings.
- Warnings for binaries, oversize individual files, and suspicious patterns (phone numbers, email addresses, obvious API-key-looking strings in shipped content).

Fast feedback loop. Authors run this until it's clean. `clawstore publish` refuses to upload if validation fails.

## Step 3: `clawstore pack`

```
$ clawstore pack
```

- Produces a local tarball, e.g. `calorie-coach-0.3.1.tgz`, containing exactly what would be published.
- Runs `validate` first; refuses to pack on failure.
- Writes a sidecar manifest of file hashes for later integrity checks.

`pack` is primarily for debugging and for sideloading during development — `publish` packs on its own.

## Step 4: `clawstore preview`

```
$ clawstore preview
$ clawstore preview --run
```

- Installs the packed tarball into a scratch workspace under `~/.clawstore/preview/<agent-id>/`, completely isolated from the author's real OpenClaw config.
- Does not touch `agents.list`, does not install real plugins (uses stub plugin manifests to simulate resolution).
- Lets the author `cd` into the scratch workspace and inspect exactly what operators will see: resolved entrypoint files, the copied knowledge tree, the store assets, everything.
- `--run` temporarily registers the scratch workspace with an ephemeral OpenClaw agent via `openclaw agents add`, drops into an interactive session for "does this actually feel right" checks, and cleans up with `openclaw agents delete` on exit.

The preview step catches the class of bugs that schema validation cannot: "the author shipped the wrong persona file," "the entrypoint mapping is off by one directory," "the store screenshots are out of order."

## Step 5: `clawstore login`

```
$ clawstore login
```

- First time: initiates the OAuth 2.0 Device Authorization flow. The CLI requests a device code, opens the browser to a `/device` page on the web frontend, where the operator signs in with GitHub and approves the device. The CLI polls for a bearer token and stores it in `~/.clawstore/auth.json` with `0600` permissions.
- Subsequent invocations are silent — the token is already present.

See [Auth and Ownership](auth-and-ownership.md) for the full device authorization flow.

## Step 6: `clawstore publish`

```
$ clawstore publish
```

Client side:

1. Run `validate` + `pack` under the hood. Refuse to publish on validation failure.
2. `POST /v1/agents/publish` with the tarball as the `tarball` file part and a redundant `metadata` JSON part (lets the server reject obviously broken uploads before reading the tarball).
3. Present the backend's structured response to the user: live URLs for the detail page, the tarball, and each asset.

Server side (the publish endpoint runs, in order):

1. **Authentication** — verify the bearer token, resolve it to a user.
2. **Ownership** — if the `id` already exists, verify the caller is the owner. If it doesn't, claim it for this user. One owner per ID at MVP. See [Auth and Ownership § Ownership](auth-and-ownership.md#ownership).
3. **Version monotonicity** — the new version must be strictly greater than any existing published version for this `id`.
4. **Deterministic validation** — run `packages/validator` against the uploaded tarball. Identical to the `clawstore validate` logic the author already ran locally.
5. **Executable scan + secret scan** — hard fail on any finding.
6. **Plugin reachability** — for each `dependencies.plugins[]`, confirm the spec resolves (ClawHub entry exists, npm package exists, git URL responds).
7. **Extract assets** — stream the tarball, write the full `.tgz` to `tarballs/:scope/:name/:version.tgz` in R2, extract icon and screenshots to `assets/:scope/:name/:version/...` with immutable cache headers.
8. **Persist** — insert the version row in D1, update the agent's `latest_version_id` pointer (unless this is a pre-release), insert the owner claim if this is the agent's first publish.
9. **Return** — canonical URLs for the detail page, the tarball, and every asset.

The agent is live the moment the endpoint returns. There is no merge step, no deploy pipeline, no cache invalidation ceremony.

The full endpoint contract lives in [Backend API § Publish and yank](backend-api.md#publish-and-yank).

## Updating an existing agent

Publishing `0.3.1 → 0.4.0` repeats steps 2–4 and 6. `login` is already cached. The backend rejects a re-published `0.3.1` on version monotonicity — versions are immutable, see [Data Model § Immutability rules](data-model.md#immutability-rules).

`clawstore publish` bumps the version automatically when run without an explicit new version: it prompts for major/minor/patch and collects a one-line changelog entry that lands in the version detail blob.

## Yanking a bad release

```
$ clawstore yank @someone/calorie-coach@0.3.1 --reason "broken nutrition data"
```

A yanked version hides from resolution (`install`, `search`, `update`) but stays in D1 for audit. Operators with a pinned version can still install it — yank is a deprecation signal, not a delete. Only the package owner can yank their own versions; the inverse operation (`unyank`) is maintainer-only to prevent accidental re-exposure of bad content.

See [Backend API § Publish and yank](backend-api.md#publish-and-yank) for the endpoint shape.

## Moderation

There is no pre-publish human review. Moderation is post-hoc. The hot path never blocks on a human. See [Trust and Moderation](trust-and-moderation.md) for the report flow, maintainer tools, and the reasoning behind the open-publish stance.

## Cross-references

- [Backend API § Publish and yank](backend-api.md#publish-and-yank) — the endpoint contract
- [Agent Package](agent-package.md) — what the validator runs against
- [Auth and Ownership](auth-and-ownership.md) — login, tokens, the owner claim
- [Trust and Moderation](trust-and-moderation.md) — post-hoc moderation
- [CLI Reference](cli.md) — command-by-command summary
- [Documentation hub](README.md)
