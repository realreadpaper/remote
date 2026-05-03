# External Network Cloud Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前局域网终端远控扩展为默认云中转外网连接，让 iPhone 在蜂窝网络下通过 `wss://` 云端服务连接家里的 macOS Agent。

**Architecture:** 保持现有 `Mobile -> Server -> Agent -> PTY` 垂直切片，先把 server 部署成公网 WSS Relay，并增加最小开发鉴权、连接模式配置、云端运行手册和外网冒烟测试。家庭公网直连、DDNS、IPv6、第三方隧道只作为高级配置入口，不进入默认连接路径。

**Tech Stack:** pnpm workspaces, TypeScript, Fastify, WebSocket, Zod, Expo React Native, node-pty, Caddy/Nginx, TLS, VPS/Cloud VM.

---

## Scope Boundary

本计划交付：

- 云中转外网开发版。
- `wss://` server URL 配置。
- Agent 和 Mobile 的连接模式配置。
- 最小开发 token，避免裸 WebSocket 暴露公网。
- 外网部署 runbook。
- iPhone 蜂窝网络连接 Mac 的验收步骤。

本计划不交付：

- 完整账号系统。
- 完整设备绑定。
- P2P。
- TURN。
- 文件和桌面中转。
- 端到端加密。
- 家庭公网直连 UI。

这些能力进入后续独立计划。

## File Structure

```text
apps/server/src/config.ts
apps/server/src/auth/devToken.ts
apps/server/src/ws.ts
apps/server/tests/auth/devToken.test.ts
apps/server/tests/ws.test.ts
apps/agent/src/config.ts
apps/mobile/src/config/runtimeConfig.ts
apps/mobile/tests/runtimeConfig.test.ts
docs/runbooks/cloud-relay-dev-deploy.md
docs/runbooks/external-network-smoke-test.md
docs/superpowers/specs/2026-05-02-external-network-access-design.md
```

## Phase 1: 公网 Relay 最小安全边界

### Task 1: Server 运行配置

**Files:**
- Create: `apps/server/src/config.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/tests/config.test.ts`

- [x] 增加 `loadServerConfig(env)`。
- [x] 配置项包括 `host`、`port`、`requireDevToken`、`devToken`、`publicBaseUrl`。
- [x] 默认开发配置保持 `host=127.0.0.1`、`port=8787`。
- [x] 当 `REMOTE_REQUIRE_DEV_TOKEN=1` 且缺少 `REMOTE_DEV_TOKEN` 时，server 启动失败。
- [x] 测试默认配置、云端配置、缺 token 失败。
- [x] 运行 `pnpm --filter @remote/server test`。
- [x] 提交 `git commit -m "feat: add server runtime config"`。

### Task 2: 最小开发 token

**Files:**
- Create: `apps/server/src/auth/devToken.ts`
- Modify: `apps/server/src/ws.ts`
- Test: `apps/server/tests/auth/devToken.test.ts`
- Test: `apps/server/tests/ws.test.ts`

- [x] 实现 `validateDevToken({ expectedToken, providedToken })`。
- [x] 支持 WebSocket query：`?token=<token>`。
- [x] 支持 header：`authorization: Bearer <token>`。
- [x] `requireDevToken=false` 时保持局域网开发兼容。
- [x] `requireDevToken=true` 时，缺 token 或 token 错误直接关闭 socket。
- [x] 测试 Agent 和 Mobile 两条 WebSocket 都执行 token 校验。
- [x] 运行 `pnpm --filter @remote/server test`。
- [x] 提交 `git commit -m "feat: guard websocket relay with dev token"`。

### Task 3: Agent 云端 URL 和 token

**Files:**
- Modify: `apps/agent/src/config.ts`
- Modify: `apps/agent/src/agentClient.ts`
- Test: `apps/agent/tests/config.test.ts`
- Test: `apps/agent/tests/agentClient.test.ts`

- [x] Agent 支持 `REMOTE_SERVER_URL=wss://dev-api.example.com/ws/agent`。
- [x] Agent 支持 `REMOTE_DEV_TOKEN`。
- [x] 当 token 存在时，Agent 在 URL 上附加 query token。
- [x] 保持本地默认 `ws://127.0.0.1:8787/ws/agent`。
- [x] 测试本地默认、云端 URL、token query 拼接。
- [x] 运行 `pnpm --filter @remote/agent test`。
- [x] 提交 `git commit -m "feat: support cloud relay agent auth config"`。

### Task 4: Mobile 云端 URL 和 token

**Files:**
- Modify: `apps/mobile/src/config/runtimeConfig.ts`
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`
- Test: `apps/mobile/tests/runtimeConfig.test.ts`

- [x] Mobile 支持 `EXPO_PUBLIC_REMOTE_WS_URL=wss://dev-api.example.com/ws/mobile`。
- [x] Mobile 支持 `EXPO_PUBLIC_REMOTE_DEV_TOKEN`。
- [x] 当 token 存在时，Mobile 在 URL 上附加 query token。
- [x] UI 继续显示当前连接目标，但 token 必须脱敏。
- [x] 测试默认 URL、云端 URL、token query、展示 URL 脱敏。
- [x] 运行 `pnpm --filter @remote/mobile test`。
- [x] 提交 `git commit -m "feat: support cloud relay mobile auth config"`。

## Phase 2: 云端部署

### Task 5: VPS 部署 runbook

**Files:**
- Create: `docs/runbooks/cloud-relay-dev-deploy.md`

- [x] 写明前置条件：VPS、域名、DNS、Node、pnpm、Caddy/Nginx。
- [x] 写明 server 环境变量：`HOST=127.0.0.1`、`PORT=8787`、`REMOTE_REQUIRE_DEV_TOKEN=1`、`REMOTE_DEV_TOKEN=<secret>`。
- [x] 写明 Caddy 反代配置：`api.example.com -> 127.0.0.1:8787`。
- [x] 写明 systemd 或 pm2 启动方式。
- [x] 写明 `/health` 验证。
- [x] 写明 WebSocket 连接排障。
- [x] 提交 `git commit -m "docs: add cloud relay deploy runbook"`。

### Task 6: 外网冒烟 runbook

**Files:**
- Create: `docs/runbooks/external-network-smoke-test.md`

- [x] 写明 Agent 启动命令：`REMOTE_SERVER_URL=wss://api.example.com/ws/agent REMOTE_DEV_TOKEN=<secret> pnpm dev:agent`。
- [x] 写明 Mobile 启动命令：`EXPO_PUBLIC_REMOTE_WS_URL=wss://api.example.com/ws/mobile EXPO_PUBLIC_REMOTE_DEV_TOKEN=<secret> pnpm dev:mobile`。
- [x] 写明 iPhone 关闭 Wi-Fi，使用蜂窝网络。
- [x] 写明验收命令：`printf "__CELL__%s\n" "$PWD"`。
- [x] 写明失败排查：DNS、TLS、token、Agent 在线状态、server 日志。
- [x] 提交 `git commit -m "docs: add external network smoke runbook"`。

## Phase 3: 验收

### Task 7: 本地回归

**Files:**
- No production file changes.

- [x] 运行 `pnpm test`。
- [x] 运行 `pnpm typecheck`。
- [x] 运行 `pnpm build`。
- [ ] 本地启动 server、Agent、mobile simulator。
- [ ] 发送 `printf "__LOCAL__%s\n" "$PWD"`。
- [ ] 确认输出包含 `__LOCAL__`。

### Task 8: 外网开发验收

**Files:**
- No production file changes.

- [ ] 部署 server 到公网域名。
- [ ] Agent 从家里 Wi-Fi 连接 `wss://api.example.com/ws/agent`。
- [ ] iPhone 关闭 Wi-Fi。
- [ ] Mobile 连接 `wss://api.example.com/ws/mobile`。
- [ ] 发送 `printf "__CELL__%s\n" "$PWD"`。
- [ ] 确认输出包含 `__CELL__`。
- [ ] 记录延迟、断线、重连和错误文案。

## Completion Criteria

- 普通用户路径明确为云端安全连接。
- 高级直连路径不进入默认连接流程。
- 公网 WebSocket 不允许裸连。
- iPhone 蜂窝网络能通过云端 Relay 控制家里 Mac 终端。
- 文档覆盖部署、验收和排障。
