# Cloud Test Environment Runbook

## Goal

Verify the default external-network path:

```text
iPhone on cellular -> Render Web Service -> home macOS Agent
```

The acceptance command is:

```bash
printf "__CLOUD__%s\n" "$PWD"
```

Expected result: the iPhone terminal displays output containing `__CLOUD__`.

## Default Platform

Use Render for the first-stage free-tier-friendly test environment. Render is the default because it provides a managed public Web Service, HTTPS, environment variables, Postgres, and Key Value resources with low setup overhead.

Use [Cloud Relay Dev Deploy Runbook](cloud-relay-dev-deploy.md) when Render free resources are unavailable or when testing on a self-owned VPS.

Free-tier constraints:

- Free resources are for development validation only.
- Free Web Services can sleep or restart.
- Free Postgres and Key Value limits can change.
- Key Value free instances are not persistent across restart.
- Do not scale the Web Service horizontally until WebSocket session routing is implemented.

## Render Blueprint Deploy

The repository includes `render.yaml` and `Dockerfile` for the default cloud relay.

1. Push the repository to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Confirm Render detects the root `render.yaml`.
4. Apply the Blueprint.
5. Wait for these resources:
   - `remote-terminal-server`
   - `remote-terminal-postgres`
   - `remote-terminal-redis`
6. Open `remote-terminal-server` in the Render Dashboard.
7. Copy the generated `REMOTE_DEV_TOKEN` from the service environment variables.
8. Use the Web Service host as `REMOTE_RELAY_HOST`, without `https://`.

The Blueprint keeps `remote-terminal-server` at one instance because pairing, session tokens, and terminal sessions are not yet fully distributed across Postgres and Redis.

## Local Docker Verification

If Docker is available locally, verify the image before deploying:

```bash
docker build -t remote-terminal-server:render .
docker run --rm \
  -p 8787:8787 \
  -e PORT=8787 \
  -e HOST=0.0.0.0 \
  -e REMOTE_REQUIRE_DEV_TOKEN=1 \
  -e REMOTE_DEV_TOKEN=local-render-smoke \
  remote-terminal-server:render
```

In another terminal:

```bash
curl "http://127.0.0.1:8787/health"
```

Expected:

```json
{"ok":true}
```

If Docker is not available locally, do not mark image build verification complete. Let Render perform the first image build and record the Render build log result in the smoke template.

## Required Resources

- Render account.
- GitHub repository connected to Render.
- Render Web Service for `@remote/server`.
- Render Postgres for cloud persistence readiness.
- Render Key Value for Redis-compatible presence readiness.
- Optional custom domain such as `api.example.com`.
- Long random development token.
- macOS machine running the Agent.
- iPhone using Expo or TestFlight.

Generate a token:

```bash
openssl rand -base64 32
```

## Render Web Service

Manual Web Service creation is the fallback path when Blueprint deploy is unavailable. Prefer the Blueprint path above.

Build command:

```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @remote/server build
```

Start command:

```bash
node apps/server/dist/index.js
```

Environment variables:

```bash
HOST=0.0.0.0
REMOTE_REQUIRE_DEV_TOKEN=1
REMOTE_DEV_TOKEN=<secret>
REMOTE_PUBLIC_BASE_URL=https://<relay-host>
REMOTE_DATA_DIR=/var/data/terminal-first-remote
```

Render provides `PORT`; do not hard-code it unless the platform explicitly asks for a port value.

The Blueprint uses Docker runtime instead of the manual build/start commands, but the same runtime environment variables apply.

## PostgreSQL And Key Value

Create both resources before the first cloud smoke test:

```bash
DATABASE_URL=<Render Postgres internal URL>
REDIS_URL=<Render Key Value internal URL>
```

Current status:

- Task 14 added PostgreSQL schema and repositories.
- Task 15 added Redis-compatible presence store.
- Server runtime config reads `DATABASE_URL` and `REDIS_URL`.
- Business store wiring is still pending, so the smoke test must use one Web Service instance.
- Do not mark multi-instance cloud readiness complete until pairing/session token stores use PostgreSQL and presence uses Redis in the running server.

## Public Health Check

From any network:

```bash
export REMOTE_RELAY_HOST="<relay-host>"
curl "https://${REMOTE_RELAY_HOST}/health"
```

Expected:

```json
{"ok":true}
```

## Unauthorized WebSocket Check

Run this from a local machine. It should exit successfully only when the server closes the unauthorized socket with code `1008`.

```bash
pnpm --filter @remote/server exec node --input-type=module <<'EOF'
import WebSocket from "ws";

const host = process.env.REMOTE_RELAY_HOST;
if (!host) {
  console.error("REMOTE_RELAY_HOST is required");
  process.exit(1);
}

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

## Start Home Agent

On the Mac that will be controlled:

```bash
export REMOTE_RELAY_HOST="<relay-host>"
export REMOTE_DEV_TOKEN="<secret>"
export REMOTE_DEVICE_ID="home-mac"

REMOTE_SERVER_URL="wss://${REMOTE_RELAY_HOST}/ws/agent" \
REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
REMOTE_DEVICE_ID="${REMOTE_DEVICE_ID}" \
pnpm dev:agent
```

Expected:

- Agent connects to the relay.
- Agent registers as `home-mac`.
- Agent prints or accepts pairing workflow.

## Verify Device Online

From any terminal:

```bash
curl -H "Authorization: Bearer ${REMOTE_DEV_TOKEN}" "https://${REMOTE_RELAY_HOST}/devices"
```

Expected response includes:

```json
{
  "deviceId": "home-mac",
  "online": true,
  "lastSeenAt": "2026-05-03T00:00:00.000Z"
}
```

The timestamp value will differ.

## Start iPhone App

For Expo development:

```bash
EXPO_PUBLIC_REMOTE_WS_URL="wss://${REMOTE_RELAY_HOST}/ws/mobile" \
EXPO_PUBLIC_REMOTE_API_URL="https://${REMOTE_RELAY_HOST}" \
EXPO_PUBLIC_REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
EXPO_PUBLIC_REMOTE_DEVICE_ID="${REMOTE_DEVICE_ID}" \
pnpm dev:mobile
```

For TestFlight, the build must be produced with equivalent public config values. Confirm the app displays the expected relay host before pairing.

## Cloud Terminal Smoke

On the iPhone:

1. Disable Wi-Fi.
2. Confirm cellular data is active.
3. Open the app.
4. Pair with the Agent.
5. Tap `Connect`.
6. Run:

   ```bash
   printf "__CLOUD__%s\n" "$PWD"
   ```

Expected:

- Output contains `__CLOUD__`.
- The path after `__CLOUD__` is the Mac shell working directory.
- Reopening the app should reconnect or show a clear reconnect action.

## Result Template

```text
Date:
Relay host:
Render service URL:
Custom domain:
Blueprint apply result:
Docker build verification:
Render build log:
Postgres resource:
Key Value resource:
Agent network:
iPhone network:
Pairing result:
__CLOUD__ output:
First command latency:
Reconnect behavior:
Known failures:
```

## Failure Diagnosis

### Health Check Fails

```bash
curl -v "https://${REMOTE_RELAY_HOST}/health"
```

Check:

- Render service is deployed.
- Start command is `node apps/server/dist/index.js`.
- `HOST=0.0.0.0`.
- Build completed successfully.

### Unauthorized Check Does Not Close With 1008

Check:

- `REMOTE_REQUIRE_DEV_TOKEN=1`.
- `REMOTE_DEV_TOKEN` is non-empty.
- Web Service was restarted after env changes.

### Agent Missing Or Offline

```bash
curl -H "Authorization: Bearer ${REMOTE_DEV_TOKEN}" "https://${REMOTE_RELAY_HOST}/devices"
```

Check:

- Agent URL uses `/ws/agent`.
- Agent token matches server token.
- Home network allows outbound `443`.
- Render logs show a WebSocket connection.

### Mobile Cannot Pair

Check:

- Mobile uses `/ws/mobile`.
- `EXPO_PUBLIC_REMOTE_API_URL` uses `https://`.
- `EXPO_PUBLIC_REMOTE_WS_URL` uses `wss://`.
- Expo was restarted after env changes.
- Agent prompt was approved.

## Blocking Conditions

Real cloud smoke cannot be marked complete without:

- Render account or equivalent public cloud account.
- Public relay host.
- macOS Agent machine.
- iPhone with Expo or TestFlight.
- Matching `REMOTE_DEV_TOKEN` across server, Agent, and Mobile.

When these are missing, only runbook and local repository verification can be marked complete.

## References

- Render Web Services: https://render.com/docs/web-services/
- Render Environment Variables: https://render.com/docs/configure-environment-variables
- Render Deploy for Free: https://render.com/docs/free
- Render Key Value: https://render.com/docs/redis
- Render Docker: https://render.com/docs/docker
