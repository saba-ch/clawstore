---
title: Auth & Ownership
description: How authentication, scopes, and package ownership work in Clawstore.
---

Clawstore uses GitHub OAuth for all authentication. There are two surfaces: **sessions** for the web and **bearer tokens** for the CLI. Both are backed by the same GitHub identity.

## Identity

There is one kind of identity: an authenticated GitHub user. No email-only sign-up, no magic links, no org accounts at MVP.

On first sign-in, Clawstore creates your user record and seeds your profile from GitHub (username, display name, avatar).

## Logging in on the web

1. Click "Sign in with GitHub" on [useclawstore.com](https://useclawstore.com)
2. Authorize on GitHub
3. You're signed in with a session cookie

Standard OAuth flow. Sessions are managed by Better Auth.

## Logging in from the CLI

The CLI uses the OAuth 2.0 **Device Authorization** flow:

```bash
clawstore login
```

1. The CLI requests a device code from the backend
2. Your browser opens to a `/device` page on useclawstore.com showing a user code
3. If you're not signed in, sign in with GitHub first
4. Confirm the code matches what your terminal shows and click **Approve**
5. The CLI receives a bearer token and stores it in `~/.clawstore/auth.json` (permissions `0600`)

Subsequent `clawstore login` calls are silent — the token is already cached.

:::tip
To invalidate CLI tokens, sign out from the web at useclawstore.com. This revokes the underlying session.
:::

## Scopes

Your **scope** is your GitHub username, lowercased. It's assigned automatically — you don't choose it.

- GitHub login `Someone` -> scope `@someone`
- All your packages live under `@someone/` (e.g., `@someone/calorie-coach`)
- You can publish as many packages as you want under your scope
- You **cannot** publish under anyone else's scope

If you rename yourself on GitHub, the old scope stays bound to your Clawstore account. New publishes still use the scope from your first sign-in.

## Ownership

Ownership is claimed on first publish and enforced on every subsequent publish.

### How it works

1. You publish `@someone/calorie-coach` for the first time
2. Clawstore records you as the **owner** of that package ID
3. Every future publish of `@someone/calorie-coach` checks that you're the same user

One owner per package at MVP. Ownership transfer isn't supported — the workaround is to publish under a new ID and yank the old one.

### Publish authorization

On every `clawstore publish`:

| Check | What happens on failure |
|-------|------------------------|
| **Authentication** | Bearer token missing or invalid -> `401` |
| **Scope match** | Package scope doesn't match your GitHub username -> `403` |
| **Ownership** | Package exists and you're not the owner -> `403` |
| **Version monotonicity** | Version isn't newer than existing versions -> `409` |

### What ownership grants

| Action | Owner | Maintainer | Anyone |
|--------|-------|------------|--------|
| Publish new versions | Yes | No | No |
| Yank own versions | Yes | Yes | No |
| Un-yank versions | No | Yes | No |
| View package details | Yes | Yes | Yes |
| File a report | Yes | Yes | Yes |
| Review a package | No | Yes | Yes |

Notable rules:
- **Owners can't un-yank** — yanking usually means something was wrong; reversing it requires a maintainer
- **Owners can't review their own package** — prevents self-promotion

## Profile

Your public profile at `useclawstore.com/users/username` shows:
- Display name and avatar (from GitHub)
- Bio, website, location (editable)
- Your published packages with download counts and ratings
