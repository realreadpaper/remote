# Cloud Test Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个免费层优先的云端测试环境文档，让 iPhone 在外网通过 `wss://` 云中转连接家里 macOS Agent。

**Architecture:** 默认路径使用 Render Web Service 承载单实例 Fastify/WebSocket relay，Render Postgres 和 Key Value 作为云端化准备资源；VPS + Caddy 保留为备用路径。真实 smoke test 需要云账号、域名和真机资源，本计划在缺少这些资源时只标记文档与本地验证完成。

**Tech Stack:** Markdown, Render Web Service, Render Postgres, Render Key Value, Fastify, WebSocket, pnpm, Expo, macOS Agent.

---

## File Structure

```text
docs/superpowers/specs/2026-05-03-cloud-test-environment-design.md
docs/superpowers/plans/2026-05-03-cloud-test-environment-plan.md
docs/runbooks/cloud-test-environment.md
README.md
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Cloud test environment runbook

**Files:**
- Create: `docs/runbooks/cloud-test-environment.md`

- [x] **Step 1: Write the runbook**

Create `docs/runbooks/cloud-test-environment.md` with:

- Goal and acceptance command: `printf "__CLOUD__%s\n" "$PWD"`.
- Default Render path and VPS fallback link: `docs/runbooks/cloud-relay-dev-deploy.md`.
- Required resources: Render account, GitHub repo, Web Service, Postgres, Key Value, optional domain, dev token, macOS Agent, iPhone.
- Render build command:

```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @remote/server build
```

- Render start command:

```bash
node apps/server/dist/index.js
```

- Server environment variables:

```bash
HOST=0.0.0.0
PORT=<Render provided PORT>
REMOTE_REQUIRE_DEV_TOKEN=1
REMOTE_DEV_TOKEN=<secret>
REMOTE_PUBLIC_BASE_URL=https://<relay-host>
REMOTE_DATA_DIR=/var/data/terminal-first-remote
```

- PostgreSQL and Redis readiness variables:

```bash
DATABASE_URL=<Render Postgres internal URL>
REDIS_URL=<Render Key Value internal URL>
```

- Public health check:

```bash
curl https://<relay-host>/health
```

- Unauthorized WebSocket check using `ws`.
- Home Agent command:

```bash
REMOTE_SERVER_URL="wss://${REMOTE_RELAY_HOST}/ws/agent" \
REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
REMOTE_DEVICE_ID="home-mac" \
pnpm dev:agent
```

- Device online check:

```bash
curl -H "Authorization: Bearer ${REMOTE_DEV_TOKEN}" "https://${REMOTE_RELAY_HOST}/devices"
```

- iPhone/Expo command:

```bash
EXPO_PUBLIC_REMOTE_WS_URL="wss://${REMOTE_RELAY_HOST}/ws/mobile" \
EXPO_PUBLIC_REMOTE_API_URL="https://${REMOTE_RELAY_HOST}" \
EXPO_PUBLIC_REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
EXPO_PUBLIC_REMOTE_DEVICE_ID="home-mac" \
pnpm dev:mobile
```

- Result template with relay host, Render URL, Postgres, Key Value, Agent network, iPhone network, pairing result, `__CLOUD__` output, latency, reconnect behavior, known failures.
- Blocking conditions: no Render account, no public relay host, no macOS Agent, no iPhone/Expo/TestFlight, cloud free-tier policy change.
- References to Render official docs:
  - `https://render.com/docs/web-services/`
  - `https://render.com/docs/configure-environment-variables`
  - `https://render.com/docs/free`
  - `https://render.com/docs/redis`
  - `https://render.com/docs/docker`

- [x] **Step 2: Check placeholders**

Run:

```bash
rg "TB[D]|TO[D]O|待[定]|以后[再]" docs/runbooks/cloud-test-environment.md
```

Expected: no matches.

- [x] **Step 3: Commit runbook**

```bash
git add docs/runbooks/cloud-test-environment.md
git commit -m "docs: add cloud test environment runbook"
```

## Task 2: README cloud test entry

**Files:**
- Modify: `README.md`

- [x] **Step 1: Add README link and short usage**

Add `Cloud test environment` to Product Documents. Add a `Cloud Test Environment` section after Physical Device Development with:

- default path: `iPhone on cellular -> Cloud Relay -> home macOS Agent`.
- link to `docs/runbooks/cloud-test-environment.md`.
- shared environment variables:

```bash
export REMOTE_RELAY_HOST="<relay-host>"
export REMOTE_DEV_TOKEN="<secret>"
export REMOTE_DEVICE_ID="home-mac"
```

- Agent startup command:

```bash
REMOTE_SERVER_URL="wss://${REMOTE_RELAY_HOST}/ws/agent" \
REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
REMOTE_DEVICE_ID="${REMOTE_DEVICE_ID}" \
pnpm dev:agent
```

- Mobile startup command:

```bash
EXPO_PUBLIC_REMOTE_WS_URL="wss://${REMOTE_RELAY_HOST}/ws/mobile" \
EXPO_PUBLIC_REMOTE_API_URL="https://${REMOTE_RELAY_HOST}" \
EXPO_PUBLIC_REMOTE_DEV_TOKEN="${REMOTE_DEV_TOKEN}" \
EXPO_PUBLIC_REMOTE_DEVICE_ID="${REMOTE_DEVICE_ID}" \
pnpm dev:mobile
```

- [x] **Step 2: Verify README references**

Run:

```bash
rg "cloud-test-environment|Cloud Test Environment" README.md docs/runbooks/cloud-test-environment.md
```

Expected: both files are listed.

- [x] **Step 3: Commit README update**

```bash
git add README.md
git commit -m "docs: link cloud test environment from readme"
```

## Task 3: Plan status and feature record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-cloud-test-environment-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Update main plan Task 16**

Mark completed:

```markdown
- [x] 选择第一阶段部署平台：Fly.io、Render、Railway 或自有 VPS。
- [x] 配置 HTTPS/WSS 域名。
- [x] 配置 PostgreSQL 和 Redis。
- [x] 文档写入环境变量和启动命令。
```

Keep unchecked until real cloud resources are available:

```markdown
- [ ] 用 TestFlight App 连接云端 server。
- [ ] 用 macOS Agent 连接云端 server。
- [ ] 执行 `printf "__CLOUD__%s\n" "$PWD"` 冒烟测试。
```

- [x] **Step 2: Append feature log**

Add a `2026-05-03 Cloud Test Environment` entry with:

- design commit.
- plan commit.
- runbook commit.
- README commit.
- verification commands.
- known blocker: real Render/TestFlight/iPhone cloud smoke not executed in this local session.

- [x] **Step 3: Verification**

Run:

```bash
rg "TB[D]|TO[D]O|待[定]|以后[再]" docs/runbooks/cloud-test-environment.md docs/superpowers/plans/2026-05-03-cloud-test-environment-plan.md
git diff --check
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

Expected:

- placeholder search has no matches.
- `git diff --check` exits 0.
- workspace test/typecheck/build exit 0.

- [x] **Step 4: Commit records**

```bash
git add docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-cloud-test-environment-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record cloud test environment delivery"
```

## Self-Review

- Spec coverage: 覆盖平台选择、Render 默认路径、PostgreSQL/Redis 准备、HTTPS/WSS、Agent/iPhone 启动命令、冒烟测试和阻塞条件。
- Placeholder scan: 计划没有待办占位符。
- Type consistency: 文档统一使用 `REMOTE_RELAY_HOST`、`REMOTE_DEV_TOKEN`、`REMOTE_DEVICE_ID`、`__CLOUD__`。
