# Terminal-First Remote Control

## Local MVP Foundation

This workspace uses `pnpm`. If `pnpm` is not on your `PATH`, enable it with Corepack or prepend the local Corepack shim path when running commands:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --version
```

Start the development server:

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

In the mobile app, tap `Connect`, type `pwd`, and tap `发送`.

Expected result: terminal output from the macOS Agent appears in the mobile terminal output panel.

## Local Verification

Run the workspace checks:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

Verify the local vertical slice:

1. Start the server:

   ```bash
   PATH="/tmp/codex-corepack-shims:$PATH" pnpm dev:server
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
   PATH="/tmp/codex-corepack-shims:$PATH" REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
   ```

   Confirm it registers with the server.

4. Check registered devices:

   ```bash
   curl http://127.0.0.1:8787/devices
   ```

   Expected response includes `mac-dev`, capabilities `["terminal"]`, and `online: true`.

5. If practical, verify WebSocket terminal routing with the mobile app or a temporary local client. The vertical slice is working when sending `pwd` through `/ws/mobile` returns terminal output from the Agent through the relay.

6. Verify the Expo command does not fail immediately:

   ```bash
   PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo --help
   ```

Stop the development server and Agent processes when verification is complete.
