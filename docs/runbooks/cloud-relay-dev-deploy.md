# Cloud Relay Dev Deploy Runbook

## Goal

Deploy the development relay so both the macOS Agent and iPhone connect outward to a public `wss://` endpoint.

Default product path:

```text
macOS Agent -> wss://api.example.com/ws/agent
iPhone App   -> wss://api.example.com/ws/mobile
```

Home DDNS, port forwarding, IPv6 direct access, and reverse tunnels remain advanced self-hosted options. They are not required for the default user flow.

## Prerequisites

- A VPS or cloud VM with a public IPv4 or IPv6 address.
- A DNS record such as `api.example.com` pointing to the VPS.
- Node.js 22 or newer.
- Corepack and `pnpm@9.15.0`.
- Caddy or Nginx for TLS termination.
- TCP ports `80` and `443` open on the VPS firewall.
- A long random development token.

Generate a token:

```bash
openssl rand -base64 32
```

## Server Environment

The Node server should listen only on loopback. Caddy or Nginx terminates TLS and proxies to it.

```bash
export HOST=127.0.0.1
export PORT=8787
export REMOTE_REQUIRE_DEV_TOKEN=1
export REMOTE_DEV_TOKEN="<secret>"
export REMOTE_PUBLIC_BASE_URL="https://api.example.com"
export REMOTE_DATA_DIR="/var/lib/terminal-first-remote"
```

`REMOTE_DATA_DIR` keeps pairing bindings and session tokens across server restarts. The current JSON store is suitable for a single-process development relay.

## Build On The VPS

```bash
git clone <repo-url> /opt/terminal-first-remote
cd /opt/terminal-first-remote
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm build
```

Create the data directory:

```bash
sudo mkdir -p /var/lib/terminal-first-remote
sudo chown "$USER":"$USER" /var/lib/terminal-first-remote
```

Start manually for a first check:

```bash
HOST=127.0.0.1 \
PORT=8787 \
REMOTE_REQUIRE_DEV_TOKEN=1 \
REMOTE_DEV_TOKEN="<secret>" \
REMOTE_PUBLIC_BASE_URL="https://api.example.com" \
REMOTE_DATA_DIR="/var/lib/terminal-first-remote" \
node apps/server/dist/index.js
```

Verify locally on the VPS:

```bash
curl http://127.0.0.1:8787/health
```

Expected:

```json
{"ok":true}
```

## Caddy TLS Proxy

Install Caddy, then create `/etc/caddy/Caddyfile`:

```caddyfile
api.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

Reload:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Verify public HTTPS:

```bash
curl https://api.example.com/health
```

Expected:

```json
{"ok":true}
```

## Nginx TLS Proxy

Use this only if Caddy is not available. The key requirement is WebSocket upgrade headers.

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## systemd Service

Create `/etc/systemd/system/terminal-first-remote.service`:

```ini
[Unit]
Description=Terminal First Remote Relay
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/terminal-first-remote
Environment=HOST=127.0.0.1
Environment=PORT=8787
Environment=REMOTE_REQUIRE_DEV_TOKEN=1
Environment=REMOTE_DEV_TOKEN=<secret>
Environment=REMOTE_PUBLIC_BASE_URL=https://api.example.com
Environment=REMOTE_DATA_DIR=/var/lib/terminal-first-remote
ExecStart=/usr/bin/node apps/server/dist/index.js
Restart=always
RestartSec=3
User=remote
Group=remote

[Install]
WantedBy=multi-user.target
```

If the deployment user is not `remote`, adjust `User`, `Group`, and file ownership.

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now terminal-first-remote
sudo systemctl status terminal-first-remote
```

Logs:

```bash
journalctl -u terminal-first-remote -f
```

## pm2 Alternative

```bash
pnpm add -g pm2
HOST=127.0.0.1 \
PORT=8787 \
REMOTE_REQUIRE_DEV_TOKEN=1 \
REMOTE_DEV_TOKEN="<secret>" \
REMOTE_PUBLIC_BASE_URL="https://api.example.com" \
REMOTE_DATA_DIR="/var/lib/terminal-first-remote" \
pm2 start apps/server/dist/index.js --name terminal-first-remote
pm2 save
```

## WebSocket Checks

Unauthorized sockets should be closed:

```bash
node --input-type=module <<'EOF'
import WebSocket from "ws";
const ws = new WebSocket("wss://api.example.com/ws/mobile");
ws.on("close", (code, reason) => {
  console.log({ code, reason: reason.toString() });
  process.exit(code === 1008 ? 0 : 1);
});
ws.on("open", () => ws.send(JSON.stringify({ type: "session.open", deviceId: "mac-dev" })));
ws.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
EOF
```

Authorized Agent and Mobile checks are covered in `docs/runbooks/external-network-smoke-test.md`.

## Troubleshooting

### `/health` works locally but not publicly

- DNS may not point to the VPS.
- Ports `80` or `443` may be blocked.
- Caddy or Nginx may not be running.

Check:

```bash
dig api.example.com
sudo ss -ltnp | grep -E ':80|:443|:8787'
sudo systemctl status caddy
```

### WebSocket fails but `/health` works

- Reverse proxy may be missing upgrade headers.
- URL path may be wrong. Agent must use `/ws/agent`; Mobile must use `/ws/mobile`.
- Token may be missing or wrong.

### Agent connects but Mobile cannot pair

- Confirm `REMOTE_PUBLIC_BASE_URL=https://api.example.com`.
- Confirm HTTP pairing routes carry `Authorization: Bearer <secret>`.
- Check server logs for `Unauthorized`, `Rate limit exceeded`, or pairing code errors.

### Server restart loses pairing

- Confirm `REMOTE_DATA_DIR` is set and writable.
- Confirm `pairing-store.json` and `session-tokens.json` exist after pairing.
