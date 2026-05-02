# Terminal-First Remote Control

## Product Documents

- [Product design](docs/superpowers/specs/2026-05-01-terminal-first-remote-control-prd.md)
- [Technical design](docs/superpowers/specs/2026-05-01-terminal-first-remote-control-technical-design.md)
- [iOS to macOS installable MVP implementation](docs/superpowers/specs/2026-05-02-ios-mac-installable-mvp-implementation.md)
- [Feature implementation principles](docs/superpowers/specs/2026-05-02-feature-implementation-principles.md)
- [External network access design](docs/superpowers/specs/2026-05-02-external-network-access-design.md)
- [Installable MVP implementation plan](docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md)
- [External network cloud relay plan](docs/superpowers/plans/2026-05-02-external-network-cloud-relay-plan.md)

## Local MVP Foundation

This workspace uses `pnpm` through Corepack. Set it up and install dependencies:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
```

If `pnpm --version` already reports `9.15.0`, the `corepack prepare` step is optional.

### iOS Simulator and Local Development

Start the development server. By default it listens on `127.0.0.1:8787`:

```bash
pnpm dev:server
```

Start the macOS Agent:

```bash
REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
```

Start the mobile app:

```bash
pnpm dev:mobile
```

The mobile app defaults to `ws://127.0.0.1:8787/ws/mobile`, so the iOS simulator works with the local server without extra environment variables.

In the mobile app, tap `Connect`, type `pwd`, and tap `发送`.

Expected result: terminal output from the macOS Agent appears in the mobile terminal output panel.

For automated simulator smoke testing, start mobile with explicit autoconnect and a marker command:

```bash
EXPO_PUBLIC_REMOTE_AUTOCONNECT=1 \
EXPO_PUBLIC_REMOTE_SMOKE_COMMAND='printf "__APP_SIM__%s\n" "$PWD"' \
pnpm --filter @remote/mobile exec expo start --ios --localhost --port 8081
```

Expected result: the simulator opens a terminal session and prints a marker like `__APP_SIM__/Users/<name>`.

### Physical Device Development

Detailed iPhone steps are in [Physical iPhone to Mac Runbook](docs/runbooks/physical-iphone-to-mac.md).

Start the server on all network interfaces:

```bash
HOST=0.0.0.0 pnpm dev:server
```

If the Agent runs on the same development machine as the server, keep its server URL local:

```bash
REMOTE_SERVER_URL=ws://127.0.0.1:8787/ws/agent REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
```

If the Agent runs on another machine, point it at the server's LAN address instead:

```bash
REMOTE_SERVER_URL=ws://<dev-machine-lan-ip>:8787/ws/agent REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
```

Start the mobile app with the development machine's LAN address:

```bash
EXPO_PUBLIC_REMOTE_WS_URL=ws://<dev-machine-lan-ip>:8787/ws/mobile pnpm dev:mobile
```

Optional Agent environment variables:

- `REMOTE_SERVER_URL`: Agent relay URL. Defaults to `ws://127.0.0.1:8787/ws/agent`.
- `REMOTE_DEVICE_NAME`: Display name reported to the relay. Defaults to the machine hostname.
- `SHELL`: Shell spawned for terminal sessions. Defaults to `/bin/zsh` when unset.

## Local Verification

Run the workspace checks:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Verify the local vertical slice:

1. Start the server:

   ```bash
   pnpm dev:server
   ```

   Confirm it listens on `127.0.0.1:8787`.

2. In another terminal, check health:

   ```bash
   curl http://127.0.0.1:8787/health
   ```

   Expected:

   ```json
   {"ok":true}
   ```

3. Start the macOS Agent:

   ```bash
   REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
   ```

   Confirm it registers with the server.

4. Check registered devices:

   ```bash
   curl http://127.0.0.1:8787/devices
   ```

   Expected response includes `mac-dev`, capabilities `["terminal"]`, and `online: true`.

5. Optionally verify WebSocket terminal routing with a smoke probe:

   ```bash
   pnpm --filter @remote/server exec node --input-type=module <<'EOF'
   import WebSocket from "ws";

   const ws = new WebSocket("ws://127.0.0.1:8787/ws/mobile");
   const timeout = setTimeout(() => {
     console.error("Timed out waiting for __PWD__ marker output.");
     ws.close();
     process.exit(1);
   }, 5000);
   let buffer = "";

   ws.on("open", () => {
     ws.send(JSON.stringify({ type: "session.open", deviceId: "mac-dev" }));
   });

   ws.on("message", (data) => {
     const message = JSON.parse(data.toString());
     console.log(message);

     if (message.type === "session.opened") {
       ws.send(JSON.stringify({
         type: "terminal.input",
         sessionId: message.sessionId,
         data: "printf \"__PWD__%s\\n\" \"$PWD\"\n"
       }));
       return;
     }

     if (message.type === "terminal.output") {
       buffer += message.data;
       if (/__PWD__\/[^\r\n]+/.test(buffer)) {
         clearTimeout(timeout);
         ws.close();
       }
     }
   });

   ws.on("error", (error) => {
     clearTimeout(timeout);
     console.error(error);
     process.exit(1);
   });
   EOF
   ```

   The Agent PTY starts in `$HOME` by default, so the marker commonly prints `__PWD__/Users/<name>` on macOS.

6. Verify the Expo command does not fail immediately:

   ```bash
   pnpm --filter @remote/mobile exec expo --help
   ```

Stop the development server and Agent processes when verification is complete.

### Troubleshooting Connect Failures

- Confirm the server is running and listening on the right host. Physical devices need `HOST=0.0.0.0 pnpm dev:server`.
- Confirm the mobile app uses the matching URL: simulator default `ws://127.0.0.1:8787/ws/mobile`, physical device `EXPO_PUBLIC_REMOTE_WS_URL=ws://<dev-machine-lan-ip>:8787/ws/mobile`.
- Check `curl http://127.0.0.1:8787/devices` and confirm the Agent is listed with `online: true`.
- Confirm the mobile app device ID matches the Agent ID. The default is `mac-dev` when you start the Agent with `REMOTE_DEVICE_ID=mac-dev`.
