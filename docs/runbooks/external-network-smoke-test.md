# External Network Smoke Test Runbook

## Goal

Verify the default external-network path:

```text
Home macOS Agent -> Cloud Relay -> iPhone on cellular
```

The iPhone should be able to open a remote terminal and run a command while Wi-Fi is disabled.

## Inputs

Replace these values before running:

```bash
export REMOTE_RELAY_HOST="<relay-host>"
export REMOTE_DEV_TOKEN="<secret>"
export REMOTE_DEVICE_ID="home-mac"
```

Expected URLs:

```text
wss://${REMOTE_RELAY_HOST}/ws/agent
wss://${REMOTE_RELAY_HOST}/ws/mobile
https://${REMOTE_RELAY_HOST}
```

## Preflight

From any network:

```bash
curl "https://${REMOTE_RELAY_HOST}/health"
```

Expected:

```json
{"ok":true}
```

Verify unauthenticated access is rejected:

```bash
node --input-type=module <<'EOF'
import WebSocket from "ws";
const host = process.env.REMOTE_RELAY_HOST;
const ws = new WebSocket(`wss://${host}/ws/mobile`);
ws.on("close", (code, reason) => {
  console.log({ code, reason: reason.toString() });
  process.exit(code === 1008 ? 0 : 1);
});
ws.on("open", () => ws.send(JSON.stringify({ type: "session.open", deviceId: "home-mac" })));
ws.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
EOF
```

## Start The Agent At Home

On the Mac that will be controlled:

```bash
REMOTE_SERVER_URL="wss://${REMOTE_RELAY_HOST}/ws/agent" \
REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
REMOTE_DEVICE_ID="${REMOTE_DEVICE_ID}" \
pnpm dev:agent
```

Expected Agent output:

- It registers successfully.
- It displays a pairing code.
- It stays connected.

From another terminal, verify the cloud relay sees the Agent:

```bash
curl -H "Authorization: Bearer ${REMOTE_DEV_TOKEN}" "https://${REMOTE_RELAY_HOST}/devices"
```

Expected response includes:

```json
{
  "deviceId": "home-mac",
  "online": true
}
```

## Start The Mobile App

On the development Mac:

```bash
EXPO_PUBLIC_REMOTE_WS_URL="wss://${REMOTE_RELAY_HOST}/ws/mobile" \
EXPO_PUBLIC_REMOTE_API_URL="https://${REMOTE_RELAY_HOST}" \
EXPO_PUBLIC_REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
EXPO_PUBLIC_REMOTE_DEVICE_ID="${REMOTE_DEVICE_ID}" \
pnpm dev:mobile
```

Open the Expo QR code on the iPhone.

On the iPhone:

1. Disable Wi-Fi.
2. Confirm cellular data is active.
3. Open the app.
4. Confirm the app displays `wss://${REMOTE_RELAY_HOST}/ws/mobile`.

## Pair

1. Read the pairing code printed by the Agent.
2. Enter it in the Mobile pairing field.
3. Tap `Pair`.
4. Approve the request in the Agent terminal by entering `y`.

Expected:

- Mobile status becomes paired.
- Agent logs or console prompt confirms approval.
- Server stores the binding when `REMOTE_DATA_DIR` is configured.

## Terminal Smoke

In the Mobile terminal:

1. Tap `Connect`.
2. Run:

   ```bash
   printf "__CELL__%s\n" "$PWD"
   ```

3. Confirm the output contains `__CELL__`.
4. Run:

   ```bash
   uname -a
   ```

5. Run:

   ```bash
   ping 127.0.0.1
   ```

6. Tap `Ctrl+C`.

Expected:

- `__CELL__` appears with the Mac shell working directory.
- `uname -a` prints the Mac kernel information.
- `Ctrl+C` stops `ping`.

## Record Results

Record:

```text
Relay host:
Agent network:
iPhone network:
Pairing result:
First command latency:
Disconnect/reconnect behavior:
Error messages:
```

## Failure Diagnosis

### DNS

```bash
dig "${REMOTE_RELAY_HOST}"
curl -v "https://${REMOTE_RELAY_HOST}/health"
```

If DNS is wrong, fix the domain A/AAAA record and wait for propagation.

### TLS

```bash
openssl s_client -connect "${REMOTE_RELAY_HOST}:443" -servername "${REMOTE_RELAY_HOST}" </dev/null
```

The certificate must match the relay host and must not be expired.

### Token

Symptoms:

- WebSocket closes with code `1008`.
- HTTP pairing/status returns `401`.

Fix:

- Use the same `REMOTE_DEV_TOKEN` on Server, Agent, and Mobile.
- Restart Expo after changing `EXPO_PUBLIC_REMOTE_DEV_TOKEN`.

### Agent online state

```bash
curl -H "Authorization: Bearer ${REMOTE_DEV_TOKEN}" "https://${REMOTE_RELAY_HOST}/devices"
```

If the device is absent or offline:

- Confirm the Agent uses `/ws/agent`, not `/ws/mobile`.
- Confirm the Agent is on a network that allows outbound `443`.
- Check the Agent process logs.

### Pairing status

If pairing stays pending:

- Confirm the Agent received `pairing.requested`.
- Confirm the local prompt was approved with `y` or `yes`.
- Check server logs for `pairingRequestId`.

### Mobile cannot connect after pairing

- Confirm `EXPO_PUBLIC_REMOTE_WS_URL` uses `wss://`.
- Confirm `EXPO_PUBLIC_REMOTE_API_URL` uses `https://`.
- Confirm Mobile has a non-expired stored session token.
- Tap `Forget`, pair again, and retry.

## Advanced Options Are Not Default

Do not ask normal users to configure home router port forwarding for the default product path. DDNS, direct IPv6, manual port mapping, and reverse tunnels are only advanced self-hosting paths.
