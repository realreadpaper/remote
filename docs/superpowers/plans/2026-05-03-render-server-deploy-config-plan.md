# Render Server Deploy Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在仓库中交付 Render Blueprint + Dockerfile，让真实公网 Server 可以按默认云中转路径部署。

**Architecture:** 根目录 `render.yaml` 描述 Render Web Service、Key Value 和 Postgres；根目录 `Dockerfile` 构建并启动 `@remote/server`；运行手册记录部署、接入、云 smoke 和失败诊断。Server 业务代码不变，本任务只交付云部署入口和可验证流程。

**Tech Stack:** Render Blueprint、Docker、Node.js 22、Corepack、pnpm 9.15.0、Fastify WebSocket Server。

---

## 文件结构

- Create: `Dockerfile`，Render Docker runtime 的镜像构建和启动入口。
- Create: `.dockerignore`，减少 Docker build context，排除依赖、构建产物、移动端原生工程和本地状态。
- Create: `render.yaml`，Render Blueprint 资源定义。Web Service 和 Key Value 放入 `services`，Postgres 放入 `databases`。
- Modify: `docs/runbooks/cloud-test-environment.md`，补充 Blueprint 部署、token 获取、Docker 验证和云 smoke。
- Modify: `docs/superpowers/records/feature-log.md`，记录本功能状态、提交、验证和后续。
- Existing uncommitted but not part of this task: `apps/mobile/package.json`、`apps/mobile/ios/`，由 iOS 真机安装生成，不纳入 Server 部署提交。

## Task 1: 写入 Render Docker 配置

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `render.yaml`

- [x] **Step 1: 确认 Render Blueprint 字段**

Run: 查阅 Render Blueprint 官方文档。

Expected: 确认 Docker 服务使用 `runtime: docker`、`dockerfilePath`、`dockerContext`；Postgres 使用 `databases`；Key Value 使用 `services` 里的 `type: keyvalue` 和 `ipAllowList`；资源连接字符串可通过 `fromDatabase`、`fromService` 注入。

- [x] **Step 2: 新增 Dockerfile**

Create `Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/package.json
COPY apps/server/package.json apps/server/package.json

RUN pnpm install --frozen-lockfile --filter @remote/server...

COPY packages/protocol packages/protocol
COPY apps/server apps/server

RUN pnpm --filter @remote/protocol build && pnpm --filter @remote/server build
RUN pnpm prune --prod

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 8787

CMD ["node", "apps/server/dist/index.js"]
```

- [x] **Step 3: 新增 .dockerignore**

Create `.dockerignore`:

```dockerignore
.git
.DS_Store
node_modules
**/node_modules
**/dist
**/build
coverage
.env
.env.*
!.env.example
apps/mobile/ios
apps/mobile/android
apps/mobile/.expo
apps/mobile/.expo-shared
apps/agent-desktop/out
apps/agent-desktop/dist
```

- [x] **Step 4: 新增 render.yaml**

Create `render.yaml`:

```yaml
services:
  - type: web
    name: remote-terminal-server
    runtime: docker
    plan: free
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /health
    numInstances: 1
    envVars:
      - key: HOST
        value: 0.0.0.0
      - key: REMOTE_REQUIRE_DEV_TOKEN
        value: "1"
      - key: REMOTE_DEV_TOKEN
        generateValue: true
      - key: DATABASE_URL
        fromDatabase:
          name: remote-terminal-postgres
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: remote-terminal-redis
          type: keyvalue
          property: connectionString
  - type: keyvalue
    name: remote-terminal-redis
    plan: free
    ipAllowList: []

databases:
  - name: remote-terminal-postgres
    plan: free
    ipAllowList: []
```

- [x] **Step 5: 配置自检**

Run:

```bash
git diff --check -- Dockerfile .dockerignore render.yaml
```

Expected: exit 0，无空白错误。

## Task 2: 更新真实 Server 运行手册

**Files:**
- Modify: `docs/runbooks/cloud-test-environment.md`

- [x] **Step 1: 写入 Blueprint 部署步骤**

Add sections that describe:

```markdown
## Render Blueprint Deploy

1. Push the repository to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Confirm Render detects `render.yaml`.
4. Apply the Blueprint.
5. Wait for `remote-terminal-server`, `remote-terminal-postgres`, and `remote-terminal-redis`.
6. Open `remote-terminal-server` environment variables and copy `REMOTE_DEV_TOKEN`.
7. Use the service URL as `REMOTE_RELAY_HOST`.
```

- [x] **Step 2: 写入 Docker 验证边界**

Add:

```text
## Local Docker Verification

If Docker is available:

    docker build -t remote-terminal-server:render .
    docker run --rm -p 8787:8787 -e PORT=8787 -e HOST=0.0.0.0 -e REMOTE_REQUIRE_DEV_TOKEN=1 -e REMOTE_DEV_TOKEN=local-render-smoke remote-terminal-server:render

If Docker is not available locally, do not mark image build verification complete. Let Render perform the first image build and record the Render build log result in the smoke template.
```

- [x] **Step 3: 更新云 smoke 结果模板**

Add fields:

```text
Blueprint apply result:
Docker build verification:
Render build log:
```

- [x] **Step 4: 文档自检**

Run:

```bash
rg -n "TO[D]O|TB[D]|填[入]|占[位]" docs/runbooks/cloud-test-environment.md docs/superpowers/specs/2026-05-03-render-server-deploy-config-design.md docs/superpowers/plans/2026-05-03-render-server-deploy-config-plan.md
```

Expected: no output.

## Task 3: 回归验证并记录交付状态

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: 运行 Server 测试**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: all server tests pass.

- [x] **Step 2: 运行全量回归**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

Expected: all commands exit 0.

- [x] **Step 3: 检查 Docker 可用性**

Run:

```bash
command -v docker
```

Expected: 如果没有输出，则记录 `Docker not available locally; image build not run`。

- [x] **Step 4: 更新功能日志**

Add entry:

```markdown
## 2026-05-03 Render 真实 Server 部署入口

**状态：** completed

**提交：**
- `<sha>` `feat: add render server deploy config`

**实现内容：**
- 新增 Render Blueprint，创建 Web Service、Postgres、Key Value。
- 新增 Dockerfile，使用 Node 22 + pnpm 构建并启动 `@remote/server`。
- 更新云测试手册，记录 Blueprint、token、Docker、Agent、iPhone smoke。

**验证：**
- `pnpm --filter @remote/server test`: pass
- `pnpm test`: pass
- `pnpm typecheck`: pass
- `pnpm build`: pass
- `git diff --check`: pass
- `docker build`: not run, Docker not available locally
```

- [x] **Step 5: 提交**

Run:

```bash
git add Dockerfile .dockerignore render.yaml docs/runbooks/cloud-test-environment.md docs/superpowers/specs/2026-05-03-render-server-deploy-config-design.md docs/superpowers/plans/2026-05-03-render-server-deploy-config-plan.md docs/superpowers/records/feature-log.md
git commit -m "feat: add render server deploy config"
```

Expected: commit succeeds and generated iOS files remain uncommitted.
