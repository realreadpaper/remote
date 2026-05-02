# Physical iPhone to Mac Runbook

## Goal

Use a physical iPhone to open the mobile app, connect to the development server, and control the terminal hosted by the macOS Agent.

The iOS simulator path is still the default:

```bash
pnpm dev:server
REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
pnpm dev:mobile
```

The simulator uses `ws://127.0.0.1:8787/ws/mobile`, so no LAN address is required.

## Prerequisites

- iPhone and Mac are on the same Wi-Fi network.
- Expo Go is installed on the iPhone.
- macOS firewall allows incoming connections to the local development server.
- Dependencies are installed with Corepack and pnpm.

## Find the Mac LAN IP

Run:

```bash
ipconfig getifaddr en0
```

If Wi-Fi is not `en0`, list interfaces:

```bash
networksetup -listallhardwareports
```

Use the IP address reachable from the iPhone, for example `192.168.1.20`.

## Start the Server for LAN Access

Run:

```bash
HOST=0.0.0.0 pnpm dev:server
```

Verify locally:

```bash
curl http://127.0.0.1:8787/health
```

Expected:

```json
{"ok":true}
```

## Start the macOS Agent

If the Agent runs on the same Mac as the server:

```bash
REMOTE_SERVER_URL=ws://127.0.0.1:8787/ws/agent REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
```

If the Agent runs on a different Mac:

```bash
REMOTE_SERVER_URL=ws://<mac-lan-ip>:8787/ws/agent REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
```

Check that the Agent is online:

```bash
curl http://127.0.0.1:8787/devices
```

Expected response includes `mac-dev`, `terminal`, and `online: true`.

## Start the Mobile App for iPhone

Run:

```bash
EXPO_PUBLIC_REMOTE_WS_URL=ws://<mac-lan-ip>:8787/ws/mobile EXPO_PUBLIC_REMOTE_DEVICE_ID=mac-dev pnpm dev:mobile
```

Open the Expo QR code with the iPhone.

The mobile header shows the active device ID and WebSocket URL. For a physical iPhone, it must show the Mac LAN IP, not `127.0.0.1`.

## Smoke Test

In the mobile terminal:

1. Tap `Connect`.
2. Run:

   ```bash
   pwd
   ```

3. Run:

   ```bash
   printf "__PHONE__%s\n" "$PWD"
   ```

4. Run a long command:

   ```bash
   ping 127.0.0.1
   ```

5. Tap `Ctrl+C`.

Expected:

- `pwd` prints the Mac shell working directory.
- `__PHONE__` marker appears in the output.
- `Ctrl+C` stops `ping`.

## Common Failures

### Server unreachable

Cause:

- Server is not running.
- Server is bound to `127.0.0.1` instead of `0.0.0.0`.
- iPhone and Mac are not on the same network.
- macOS firewall blocks the port.

Fix:

```bash
HOST=0.0.0.0 pnpm dev:server
```

Then restart the mobile app with:

```bash
EXPO_PUBLIC_REMOTE_WS_URL=ws://<mac-lan-ip>:8787/ws/mobile pnpm dev:mobile
```

### Device is not online

Cause:

- Agent is not running.
- Agent uses a different `REMOTE_DEVICE_ID`.
- Agent connects to a different server URL.

Fix:

```bash
REMOTE_SERVER_URL=ws://127.0.0.1:8787/ws/agent REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
curl http://127.0.0.1:8787/devices
```

### Simulator works but iPhone fails

Cause:

- Simulator can use `127.0.0.1`, but physical iPhone cannot.

Fix:

- Use `ws://<mac-lan-ip>:8787/ws/mobile` for the iPhone.
- Keep `ws://127.0.0.1:8787/ws/mobile` only for the iOS simulator.
