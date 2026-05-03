# Release Readiness Audit

## Status

Date: 2026-05-03

The repository is code-complete for the local and placeholder-backed MVP path:

```text
iOS app -> cloud relay -> macOS Agent -> local shell
```

The default external-network product path is cloud relay. DDNS, port forwarding, IPv6 direct access, and reverse tunnels are advanced options only.

## Implemented

- Protocol messages for pairing, auth, device status, terminal I/O, terminal signal, and snapshot recovery.
- Server WebSocket relay for Agent and Mobile.
- Server pairing state machine, binding checks, short-lived session tokens, dev-token guard, rate limiting, device registry, JSON persistence, Postgres schema/repository readiness, and Redis presence store.
- Server release guard for placeholder public hosts and missing dev-token enforcement.
- Authenticated `GET /deployment/status` for cloud deployment checks without exposing secrets.
- macOS Agent terminal client with persistent device identity, terminal PTY, pairing flow, snapshot buffer, and session recovery.
- macOS Electron Agent shell with status UI and packaging/signing/notarization runbook.
- iOS Expo app with pairing UI, device state, terminal-first controls, shortcut keys, foreground/background reconnect behavior, token storage, and release placeholder guard.
- EAS preview/production profiles that use placeholders by default and fail fast in release mode unless real EAS environment variables override them.
- Render/Docker cloud deployment configuration and cloud smoke runbooks.

## Placeholder Policy

Checked-in public values must remain placeholders:

```bash
REMOTE_RELAY_HOST="<relay-host>"
REMOTE_DEV_TOKEN="<secret>"
EXPO_PUBLIC_REMOTE_RELAY_HOST="<relay-host>"
EXPO_PUBLIC_REMOTE_DEV_TOKEN="<secret>"
```

Release mode must use real environment values outside git:

```bash
REMOTE_RELEASE=1
REMOTE_REQUIRE_DEV_TOKEN=1
REMOTE_RELAY_HOST="<real-render-or-domain-host>"
REMOTE_DEV_TOKEN="<real-random-token>"
EXPO_PUBLIC_REMOTE_RELEASE=1
EXPO_PUBLIC_REMOTE_RELAY_HOST="<real-render-or-domain-host>"
EXPO_PUBLIC_REMOTE_DEV_TOKEN="<real-random-token>"
```

The code rejects placeholder hosts such as `api.example.com`, `.example.invalid`, and `<relay-host>` in release mode.

## Remaining Release Blockers

These cannot be marked complete from the repo alone:

- Create the real Render Blueprint deployment.
- Set `REMOTE_RELAY_HOST=<real-render-or-domain-host>` in Render and redeploy.
- Verify `https://${REMOTE_RELAY_HOST}/health`.
- Verify authenticated `https://${REMOTE_RELAY_HOST}/deployment/status`.
- Connect the home macOS Agent to `wss://${REMOTE_RELAY_HOST}/ws/agent`.
- Configure EAS production/preview environment variables with the real relay host and token.
- Build and install the real iOS preview/TestFlight binary.
- Run iPhone cellular smoke: `printf "__CLOUD__%s\n" "$PWD"`.
- Run the full MVP acceptance checklist on real devices.

## Verification Commands

Run from the repo root:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
git diff --check
```

Current verified result on 2026-05-03:

- `pnpm test`: pass, 265 tests passed.
- `pnpm typecheck`: pass.
- `pnpm build`: pass.
- `git diff --check`: pass.

## Release Decision

Internal local/LAN development can continue from this repo.

External testers should not receive a TestFlight build until the real Render/EAS/TestFlight steps above are completed and recorded in `docs/runbooks/mvp-acceptance.md`.
