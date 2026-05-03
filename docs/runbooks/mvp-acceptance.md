# MVP Acceptance Runbook

## Goal

Validate the iOS-to-macOS installable MVP before TestFlight expansion or external testing.

Every item must be recorded as:

```text
Status: pass | fail | blocked
Environment:
Build:
Device:
Steps executed:
Actual result:
Evidence:
Notes:
```

Rules:

- `pass`: steps were executed and matched expected results.
- `fail`: steps were executed and did not match expected results.
- `blocked`: steps could not be executed because a required device, build, account, cloud resource, or permission was missing.
- Any `fail` blocks release.
- Any `blocked` item on the default user path blocks external TestFlight testing.

## Environment Matrix

Run as many environments as available:

| Environment | Required For | Server | Agent | Mobile |
| --- | --- | --- | --- | --- |
| LAN simulator | development regression | `127.0.0.1:8787` | local Mac | iOS simulator |
| LAN physical iPhone | install and local device checks | LAN IP | local/home Mac | Expo or development build |
| Cloud cellular iPhone | external-network MVP | Render/VPS `wss://` | home Mac | TestFlight or Expo on iPhone |

Cloud cellular is mandatory before external testers use the product.

## Shared Setup

Local server:

```bash
pnpm dev:server
```

Local Agent:

```bash
REMOTE_DEVICE_ID=home-mac pnpm dev:agent
```

Cloud Agent:

```bash
REMOTE_SERVER_URL="wss://${REMOTE_RELAY_HOST}/ws/agent" \
REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
REMOTE_DEVICE_ID="home-mac" \
pnpm dev:agent
```

Local mobile:

```bash
pnpm dev:mobile
```

Cloud mobile:

```bash
EXPO_PUBLIC_REMOTE_WS_URL="wss://${REMOTE_RELAY_HOST}/ws/mobile" \
EXPO_PUBLIC_REMOTE_API_URL="https://${REMOTE_RELAY_HOST}" \
EXPO_PUBLIC_REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
EXPO_PUBLIC_REMOTE_DEVICE_ID="home-mac" \
pnpm dev:mobile
```

## 1. New Install, Pairing, Binding

Purpose: verify a fresh phone can bind to a Mac through the approved pairing flow.

Steps:

1. Install a fresh app build or clear app storage.
2. Start server and Agent.
3. Confirm the Agent prints or exposes a pairing code.
4. Open the mobile app.
5. Enter or scan the pairing code.
6. Approve the pairing request on the Agent.
7. Confirm mobile shows the device as paired.
8. Close and reopen the mobile app.
9. Confirm the binding is still present.

Expected:

- Pairing code is accepted.
- Agent approval is required.
- Mobile stores the binding.
- Reopening the app does not require pairing again.

Record:

```text
Status:
Environment:
Build:
Device:
Pairing code method:
Binding persisted after app restart:
Evidence:
Notes:
```

## 2. Unbound Phone Rejection

Purpose: verify an unbound phone cannot connect to a protected device.

Steps:

1. Use a second mobile client or clear the current mobile app storage.
2. Do not pair the phone.
3. Attempt to open a terminal session for `home-mac`.
4. Observe the mobile error.
5. Check server logs if available.

Expected:

- Session is rejected.
- Mobile shows a clear authorization or pairing-required state.
- Agent does not receive terminal input from the unbound phone.

Record:

```text
Status:
Environment:
Build:
Unbound client id:
Error shown:
Agent received input: yes | no
Evidence:
Notes:
```

## 3. Terminal Command Smoke

Purpose: verify the core product goal: open terminal and run commands.

Steps:

1. Pair the phone and Agent.
2. Tap `Connect`.
3. Run:

   ```bash
   pwd
   ```

4. Run:

   ```bash
   ls
   ```

5. Run inside a git repository:

   ```bash
   git status
   ```

6. Run inside a JavaScript project:

   ```bash
   npm run dev
   ```

7. Stop `npm run dev` with `Ctrl+C` if it stays running.

Expected:

- Output appears in order.
- Commands execute on the Mac, not on the phone.
- Long output remains readable.
- Errors are shown as terminal output, not as app crashes.

Record:

```text
Status:
Environment:
Build:
pwd output:
ls output observed: yes | no
git status output observed: yes | no
npm run dev output observed: yes | no
Evidence:
Notes:
```

## 4. Long Command Interrupt

Purpose: verify long-running commands can be interrupted from the phone.

Steps:

1. Open a terminal session.
2. Run:

   ```bash
   ping 127.0.0.1
   ```

3. Wait for at least three ping lines.
4. Tap or send `Ctrl+C`.
5. Run:

   ```bash
   printf "__AFTER_CTRL_C__%s\n" "$PWD"
   ```

Expected:

- `ping` starts and streams output.
- `Ctrl+C` stops `ping`.
- The session remains usable after interrupt.
- The marker `__AFTER_CTRL_C__` appears.

Record:

```text
Status:
Environment:
Build:
Ping output lines:
Ctrl+C stopped command: yes | no
Post-interrupt marker:
Evidence:
Notes:
```

## 5. iOS Background And Foreground

Purpose: verify the app behaves clearly when iOS suspends or resumes the WebSocket.

Steps:

1. Open a terminal session.
2. Run:

   ```bash
   printf "__BEFORE_BG__%s\n" "$PWD"
   ```

3. Send the app to background for 30 seconds.
4. Reopen the app.
5. If it reconnects automatically, run:

   ```bash
   printf "__AFTER_BG__%s\n" "$PWD"
   ```

6. If it shows `Reconnect`, tap it, then run the same command.

Expected:

- App does not crash.
- Background state does not send accidental input.
- Foreground returns to an active session or a clear reconnect action.
- `__AFTER_BG__` appears after reconnect.

Record:

```text
Status:
Environment:
Build:
Background duration:
Auto reconnected: yes | no
Manual reconnect needed: yes | no
After marker:
Evidence:
Notes:
```

## 6. Agent Restart Identity Persistence

Purpose: verify restarting the Agent does not create a new device identity.

Steps:

1. Start Agent with persistent identity enabled.
2. Pair mobile to `home-mac`.
3. Stop the Agent.
4. Start the Agent again with the same config.
5. Query devices:

   ```bash
   curl "http://127.0.0.1:8787/devices"
   ```

   Or for cloud:

   ```bash
   curl -H "Authorization: Bearer ${REMOTE_DEV_TOKEN}" "https://${REMOTE_RELAY_HOST}/devices"
   ```

6. Open a terminal from the already paired phone.

Expected:

- Device id remains stable.
- Mobile does not need to pair again.
- Device appears online after restart.

Record:

```text
Status:
Environment:
Build:
Device id before restart:
Device id after restart:
Pairing required again: yes | no
Evidence:
Notes:
```

## 7. Server Restart Binding Persistence

Purpose: verify binding data survives server restart.

Steps:

1. Configure persistent server data:

   ```bash
   export REMOTE_DATA_DIR="/tmp/terminal-first-remote-acceptance"
   ```

2. Start server.
3. Pair mobile and Agent.
4. Stop server.
5. Start server again with the same `REMOTE_DATA_DIR`.
6. Restart Agent if needed.
7. Open mobile and connect without pairing again.

Expected:

- Binding survives restart.
- Session token or binding state is still accepted.
- Mobile can connect after server restart.

Record:

```text
Status:
Environment:
Build:
REMOTE_DATA_DIR:
Binding survived restart: yes | no
Pairing required again: yes | no
Evidence:
Notes:
```

Cloud note: when PostgreSQL runtime wiring is not enabled, mark multi-instance or database-backed persistence checks as `blocked`.

## 8. Disabled Terminal Capability

Purpose: verify Mobile receives a clear failure when the Agent cannot provide terminal access.

Steps:

1. Start an Agent variant or config that registers without `terminal` capability.
2. Confirm `/devices` shows the device without `terminal`.
3. Attempt to open a terminal session from mobile.

Expected:

- Mobile cannot open terminal.
- Error explains that terminal capability is unavailable.
- Server does not route terminal input to an unsupported Agent.

Record:

```text
Status:
Environment:
Build:
Device capabilities:
Mobile error:
Input routed to Agent: yes | no
Evidence:
Notes:
```

If no current CLI flag exists to disable terminal capability, mark this item `blocked` and create an implementation follow-up.

## 9. No Ads On Terminal Session Page

Purpose: protect the core command experience.

Steps:

1. Open mobile home/device list.
2. Open terminal session.
3. Run:

   ```bash
   pwd
   ```

4. Inspect the terminal session page.

Expected:

- No banner, interstitial, rewarded ad, or layout-reserving ad slot appears in the terminal session page.
- Ads may be planned for non-session surfaces later, but not inside the active command surface.

Record:

```text
Status:
Environment:
Build:
Ads shown in terminal session: yes | no
Evidence:
Notes:
```

## Release Decision

Use this table before external TestFlight:

| Area | Required Status |
| --- | --- |
| Fresh install and pairing | pass |
| Unbound phone rejection | pass |
| Terminal commands | pass |
| Long command interrupt | pass |
| iOS background/foreground | pass |
| Agent restart identity | pass |
| Server restart binding | pass for chosen release environment |
| Disabled terminal capability error | pass or explicitly removed from release scope |
| No ads on terminal session page | pass |
| Cloud cellular smoke | pass before external testers |

Final decision:

```text
Release candidate:
Decision: pass | fail | blocked
Blocking items:
Approver:
Date:
```
