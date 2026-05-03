# TestFlight Build Runbook

## Goal

Build the iOS mobile app with Expo EAS and submit it to TestFlight for internal testing.

This runbook prepares the client for the default cloud relay path:

```text
iPhone TestFlight app -> wss://api.example.com/ws/mobile
```

## References

- Expo EAS build profiles: https://docs.expo.dev/build/eas-json/
- Expo EAS environment variables: https://docs.expo.dev/eas/environment-variables/
- Expo app config: https://docs.expo.dev/versions/latest/config/app/
- Expo app version fields: https://docs.expo.dev/build-reference/app-versions/
- Expo TestFlight command: https://docs.expo.dev/build-reference/npx-testflight/

## Current App Identity

The repo config uses:

```text
expo.name = Remote Terminal
expo.slug = remote-terminal
expo.ios.bundleIdentifier = com.terminalfirst.remote
expo.version = 0.1.0
expo.ios.buildNumber = 1
```

Before a real TestFlight upload, confirm the bundle identifier is available in your Apple Developer account. Change it before the first production build if your organization uses another reverse-DNS namespace.

## Prerequisites

- Expo account.
- Apple Developer Program membership.
- App Store Connect access.
- `eas-cli` available through `npx` or installed globally.
- Cloud relay reachable over `https://` and `wss://`.
- `REMOTE_DEV_TOKEN` configured if the relay requires dev token during internal testing.

Login:

```bash
npx eas-cli login
npx eas-cli whoami
```

## Configure Project

If this is the first EAS build for the project:

```bash
cd apps/mobile
npx eas-cli build:configure --platform ios
```

If EAS adds an `extra.eas.projectId` value to `app.json`, commit it only after confirming it belongs to this Expo project.

## Configure Build URLs

`apps/mobile/eas.json` contains three profiles:

- `development`: local simulator/internal development, defaults to `127.0.0.1`.
- `preview`: internal build pointed at `https://api.example.com`.
- `production`: production/TestFlight build pointed at `https://api.example.com`.

For a real relay, replace `api.example.com` in `apps/mobile/eas.json` before building or use EAS environment variables for the same `EXPO_PUBLIC_` names.

The app reads:

```text
EXPO_PUBLIC_REMOTE_WS_URL
EXPO_PUBLIC_REMOTE_API_URL
EXPO_PUBLIC_REMOTE_DEV_TOKEN
EXPO_PUBLIC_REMOTE_DEVICE_ID
```

Do not commit real dev tokens. Set sensitive values in EAS:

```bash
cd apps/mobile
npx eas-cli env:create --environment production --name EXPO_PUBLIC_REMOTE_DEV_TOKEN --value "<secret>" --visibility sensitive
```

For public client variables that are safe to include in the binary:

```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_REMOTE_WS_URL --value "wss://api.example.com/ws/mobile" --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_REMOTE_API_URL --value "https://api.example.com" --visibility plaintext
```

`EXPO_PUBLIC_` values are embedded in the client bundle. A dev token in this variable is only a temporary internal-test gate, not a production secret.

## Local Config Verification

From repo root:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build
```

Print Expo config:

```bash
cd apps/mobile
npx expo config --type public
```

Confirm:

- `ios.bundleIdentifier` is `com.terminalfirst.remote` or your chosen bundle id.
- `ios.buildNumber` is set.
- `plugins` includes `expo-secure-store`.

## Build Internal Preview

Use this before TestFlight:

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile preview
```

Install the internal build on a registered device and run the cloud relay smoke test in `docs/runbooks/external-network-smoke-test.md`.

## Build Production Binary

```bash
cd apps/mobile
npx eas-cli build --platform ios --profile production
```

Wait for the build to finish. Save the EAS build URL in the release notes or feature log.

## Submit To TestFlight

Option A: submit latest production build:

```bash
cd apps/mobile
npx eas-cli submit --platform ios --profile production --latest
```

Option B: build and submit through the current Expo TestFlight helper:

```bash
cd apps/mobile
npx testflight
```

During submission, provide the Apple ID, App Store Connect app, and team when prompted. Prefer not to commit account-specific identifiers unless this repo is private to that Apple team.

## TestFlight Acceptance

On an invited tester iPhone:

1. Install the build from TestFlight.
2. Ensure the cloud relay is running.
3. Ensure the home macOS Agent is connected to `wss://api.example.com/ws/agent`.
4. Pair the phone with the Agent.
5. Tap `Connect`.
6. Run:

   ```bash
   printf "__TESTFLIGHT__%s\n" "$PWD"
   ```

Expected:

- Output contains `__TESTFLIGHT__`.
- `Ctrl+C` stops `ping 127.0.0.1`.
- Forget clears the local token and allows re-pairing.

## Common Failures

### Bundle identifier is unavailable

Change `expo.ios.bundleIdentifier` before the first production build and rerun `eas build:configure`.

### Missing credentials

Run:

```bash
cd apps/mobile
npx eas-cli credentials --platform ios
```

Let EAS manage credentials for the MVP unless a specific enterprise signing policy requires manual certificates.

### Build uses wrong relay

Check `apps/mobile/eas.json` and EAS environment variables. `EXPO_PUBLIC_` variables are embedded in the app at build time.

### App cannot pair

- Confirm `EXPO_PUBLIC_REMOTE_API_URL` uses `https://`.
- Confirm `EXPO_PUBLIC_REMOTE_WS_URL` uses `wss://`.
- Confirm dev token is configured in EAS if the relay requires it.
- Check Server logs for `Unauthorized`, `Rate limit exceeded`, or pairing request errors.
