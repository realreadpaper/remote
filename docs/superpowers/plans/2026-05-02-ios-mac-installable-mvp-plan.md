# iOS macOS Installable MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前本地终端远控垂直切片推进到 iOS TestFlight 客户端连接可安装 macOS Agent 的 MVP。

**Architecture:** 先保留 TypeScript monorepo 和 WebSocket relay 架构，补齐真机联调、绑定鉴权、持久设备身份、macOS Agent 包装、iOS EAS/TestFlight 和云端部署。MVP 继续使用云中转，P2P、桌面流、文件传输和广告 SDK 在后续计划中独立实现。

**Tech Stack:** pnpm workspaces, TypeScript, Zod, Fastify, WebSocket, PostgreSQL, Redis, Expo React Native, EAS Build, node-pty, macOS Keychain, Electron/Tauri 或 Swift shell wrapper.

---

## Scope Boundary

本计划交付：

- iPhone 真机可连接开发 Mac。
- 设备绑定和基础鉴权。
- Server 持久化用户、设备、绑定和会话元数据。
- macOS Agent 可安装版本。
- iOS TestFlight 构建。
- 云端测试环境。

本计划不交付：

- 远程桌面视频流。
- 文件上传下载。
- Windows Agent。
- P2P。
- 端到端加密。
- 广告 SDK。
- App Store 正式上架。

## File Structure

现有文件继续保留。计划新增或重点修改：

```text
apps/server/src/auth/
apps/server/src/pairing/
apps/server/src/persistence/
apps/server/src/sessions/
apps/server/tests/auth/
apps/server/tests/pairing/
apps/server/tests/persistence/
apps/agent/src/identity.ts
apps/agent/src/pairingClient.ts
apps/agent/src/sessionPolicy.ts
apps/agent/tests/identity.test.ts
apps/agent/tests/pairingClient.test.ts
apps/mobile/src/screens/DeviceListScreen.tsx
apps/mobile/src/screens/PairingScreen.tsx
apps/mobile/src/screens/SessionScreen.tsx
apps/mobile/src/storage/secureStorage.ts
apps/mobile/tests/sessionClient.test.ts
packages/protocol/src/messages.ts
docs/runbooks/physical-iphone-to-mac.md
docs/runbooks/testflight-build.md
docs/runbooks/macos-agent-package.md
```

## Phase 1: iPhone 真机开发闭环

### Task 1: 固化真机运行手册

**Files:**
- Create: `docs/runbooks/physical-iphone-to-mac.md`
- Modify: `README.md`

- [x] 写入真机前置条件：iPhone 和 Mac 在同一局域网、Mac 防火墙允许本地 server、Expo Go 已安装。
- [x] 写入 server 启动命令：`HOST=0.0.0.0 pnpm dev:server`。
- [x] 写入 Agent 启动命令：`REMOTE_SERVER_URL=ws://127.0.0.1:8787/ws/agent REMOTE_DEVICE_ID=mac-dev pnpm dev:agent`。
- [x] 写入 Mobile 启动命令：`EXPO_PUBLIC_REMOTE_WS_URL=ws://<mac-lan-ip>:8787/ws/mobile pnpm dev:mobile`。
- [x] 写入验收命令：在 iPhone 输入 `pwd`、`printf "__PHONE__%s\n" "$PWD"`、`ping 127.0.0.1` 后点 `Ctrl+C`。
- [x] 运行 `pnpm test`、`pnpm typecheck`、`pnpm build`。
- [x] 提交：`git commit -m "docs: add physical iphone mac runbook"`。

### Task 2: 修正移动端连接配置体验

**Files:**
- Modify: `apps/mobile/src/protocol/sessionClient.ts`
- Modify: `apps/mobile/App.tsx`
- Test: `apps/mobile/tests/sessionClient.test.ts`

- [x] 增加连接失败错误分类：server unreachable、device offline、session rejected、protocol error。
- [x] 在 UI 中展示当前 WebSocket URL 和设备 ID，便于真机调试。
- [x] 增加测试：当 socket 无法打开时，store 进入明确错误状态。
- [x] 运行：`pnpm --filter @remote/mobile test`。
- [x] 提交：`git commit -m "feat: improve mobile connection diagnostics"`。

## Phase 2: 设备身份、配对与鉴权

### Task 3: 扩展协议消息

**Files:**
- Modify: `packages/protocol/src/messages.ts`
- Modify: `packages/protocol/src/index.ts`
- Test: `packages/protocol/tests/messages.test.ts`

- [x] 增加 `pairing.created`、`pairing.requested`、`pairing.approved`、`pairing.rejected`。
- [x] 增加 `auth.sessionToken`。
- [x] 增加 `device.status`。
- [x] 增加 `terminal.snapshot`。
- [x] 增加 schema 测试：合法消息通过，缺少 `deviceId`、`pairingCode`、`sessionId` 时失败。
- [x] 运行：`pnpm --filter @remote/protocol test`。
- [x] 提交：`git commit -m "feat: add pairing and auth protocol messages"`。

### Task 4: Agent 持久设备身份

**Files:**
- Create: `apps/agent/src/identity.ts`
- Modify: `apps/agent/src/config.ts`
- Modify: `apps/agent/src/agentClient.ts`
- Test: `apps/agent/tests/identity.test.ts`

- [x] 实现 `loadOrCreateDeviceIdentity()`，优先读取本地身份文件，缺失时生成 UUID 和密钥。
- [x] 开发期身份文件保存到 `~/.remote-terminal-agent/identity.json`。
- [x] 生产期切换到 macOS Keychain 的接口预留在同一模块。
- [x] Agent 注册时使用持久 `deviceId`，不再依赖固定 `REMOTE_DEVICE_ID`。
- [x] 测试：首次调用生成身份，第二次调用返回同一身份，损坏文件会拒绝启动并给出明确错误。
- [x] 运行：`pnpm --filter @remote/agent test`。
- [x] 提交：`git commit -m "feat: persist agent device identity"`。

### Task 5: Server 配对状态机

**Files:**
- Create: `apps/server/src/pairing/pairingStore.ts`
- Create: `apps/server/src/pairing/pairingService.ts`
- Modify: `apps/server/src/ws.ts`
- Test: `apps/server/tests/pairing/pairingService.test.ts`

- [x] 实现一次性配对码创建、哈希保存、过期校验和使用标记。
- [x] Agent 连接后可以请求创建配对码。
- [x] Mobile 提交配对请求后，server 推送给对应 Agent。
- [x] Agent approve 后，server 创建绑定关系。
- [x] 测试：过期码失败、重复使用失败、Agent 拒绝失败、Agent approve 成功。
- [x] 运行：`pnpm --filter @remote/server test`。
- [x] 提交：`git commit -m "feat: add device pairing state machine"`。

### Task 6: Mobile 扫码绑定界面

**Files:**
- Create: `apps/mobile/src/screens/PairingScreen.tsx`
- Create: `apps/mobile/src/storage/secureStorage.ts`
- Modify: `apps/mobile/App.tsx`
- Test: `apps/mobile/tests/sessionClient.test.ts`

- [x] 增加扫码或手动输入配对码入口。
- [x] 绑定成功后把 mobile client id 和登录 token 存到安全存储。
- [x] 绑定失败展示明确原因：过期、已使用、Agent 拒绝、网络失败。
- [x] 测试：绑定成功写入本地状态，绑定失败不污染已有设备列表。
- [x] 运行：`pnpm --filter @remote/mobile test`。
- [x] 提交：`git commit -m "feat: add mobile device pairing flow"`。

### Task 7: 会话短期 token

**Files:**
- Create: `apps/server/src/auth/sessionToken.ts`
- Modify: `apps/server/src/sessionHub.ts`
- Modify: `apps/server/src/ws.ts`
- Modify: `apps/mobile/src/protocol/sessionClient.ts`
- Modify: `apps/agent/src/agentClient.ts`
- Test: `apps/server/tests/sessionHub.test.ts`
- Test: `apps/mobile/tests/sessionClient.test.ts`

- [x] Server 打开会话前校验绑定关系。
- [x] Server 为每次连接生成短期 `sessionToken`。
- [x] Mobile 打开会话时携带 token。
- [x] Agent 只接收 server 已验证的会话打开请求。
- [x] 测试：未绑定设备连接失败，过期 token 失败，正确 token 成功。
- [x] 运行：`pnpm test`。
- [x] 提交：`git commit -m "feat: require authorized session tokens"`。

## Phase 3: 终端体验补强

### Task 8: 终端快捷键和信号

**Files:**
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`
- Modify: `apps/agent/src/terminalSession.ts`
- Modify: `packages/protocol/src/messages.ts`
- Test: `apps/agent/tests/terminalSession.test.ts`
- Test: `apps/mobile/tests/terminalStore.test.ts`

- [x] 增加 `Tab`、`Esc`、方向键、`Ctrl+C` 按钮。
- [x] `Ctrl+C` 发送 `\x03`，`Tab` 发送 `\t`，方向键发送 ANSI sequence。
- [x] 增加 `terminal.signal`，用于后续明确表达 `SIGINT`、`EOF`。
- [x] 测试：点击快捷键后 session client 发送正确 payload。
- [x] 运行：`pnpm test`。
- [x] 提交：`git commit -m "feat: add mobile terminal shortcut keys"`。

### Task 9: 断线保留和 snapshot

**Files:**
- Modify: `apps/agent/src/terminalSession.ts`
- Modify: `apps/agent/src/agentClient.ts`
- Modify: `apps/server/src/sessionHub.ts`
- Modify: `apps/mobile/src/protocol/sessionClient.ts`
- Test: `apps/agent/tests/terminalSession.test.ts`
- Test: `apps/server/tests/sessionHub.test.ts`

- [x] Agent 在 mobile 断开后保留 PTY 5 分钟。
- [x] Agent 为每个会话保留有限输出环形缓冲区。
- [x] Mobile 重连后请求 `terminal.snapshot`。
- [x] Server 验证 session owner 后转发恢复请求。
- [x] 测试：断线后 PTY 未立即关闭，超时后关闭，snapshot 包含最近输出。
- [x] 运行：`pnpm test`。
- [x] 提交：`git commit -m "feat: support terminal session recovery"`。

## Phase 4: macOS Agent 可安装版本

### Task 10: Agent GUI 壳选型和最小包装

**Files:**
- Create: `apps/agent-desktop/package.json`
- Create: `apps/agent-desktop/src/main.ts`
- Create: `apps/agent-desktop/src/App.tsx`
- Create: `docs/runbooks/macos-agent-package.md`

- [ ] 选择 Electron 或 Tauri。当前推荐 Electron，原因是 Node Agent 和 `node-pty` 集成路径最短。
- [ ] 主窗口展示设备名称、在线状态、配对二维码、终端能力开关。
- [ ] 菜单栏展示连接状态和退出入口。
- [ ] Agent core 保持在 `apps/agent`，desktop 壳只负责 UI、生命周期和配置。
- [ ] 写入本地打包步骤。
- [ ] 提交：`git commit -m "feat: add macos agent desktop shell"`。

### Task 11: macOS 签名和公证

**Files:**
- Modify: `apps/agent-desktop/package.json`
- Create: `docs/runbooks/macos-agent-package.md`

- [ ] 配置应用 bundle id。
- [ ] 配置 hardened runtime。
- [ ] 配置 Developer ID Application 签名。
- [ ] 配置 notarization 命令。
- [ ] 文档写明证书、环境变量、打包、验证和常见失败原因。
- [ ] 提交：`git commit -m "docs: add macos signing and notarization runbook"`。

## Phase 5: iOS TestFlight

### Task 12: EAS 构建配置

**Files:**
- Create: `apps/mobile/eas.json`
- Modify: `apps/mobile/app.json`
- Create: `docs/runbooks/testflight-build.md`

- [x] 配置 bundle identifier。
- [x] 配置 iOS build profile：development、preview、production。
- [ ] 配置 app icon、splash、version 和 build number。
- [x] 配置 server URL 环境变量。
- [x] 写入 EAS 登录、构建、上传 TestFlight 的命令。
- [x] 提交：`git commit -m "chore: add eas testflight build config"`。

### Task 13: iOS 前后台和重连

**Files:**
- Modify: `apps/mobile/src/protocol/sessionClient.ts`
- Modify: `apps/mobile/App.tsx`
- Test: `apps/mobile/tests/sessionClient.test.ts`

- [ ] App 进入后台时暂停主动输入，保持 session id。
- [ ] App 回前台时检查 socket 状态。
- [ ] socket 断开时自动重连一次，失败后展示手动重连按钮。
- [ ] 重连成功后请求 `terminal.snapshot`。
- [ ] 测试：后台断开后回前台触发恢复流程。
- [ ] 运行：`pnpm --filter @remote/mobile test`。
- [ ] 提交：`git commit -m "feat: handle mobile background reconnection"`。

## Phase 6: 云端测试环境

### Task 14: 持久化层

**Files:**
- Create: `apps/server/src/persistence/db.ts`
- Create: `apps/server/src/persistence/schema.sql`
- Create: `apps/server/src/persistence/deviceRepository.ts`
- Create: `apps/server/src/persistence/bindingRepository.ts`
- Test: `apps/server/tests/persistence/deviceRepository.test.ts`

- [ ] 增加 PostgreSQL schema：users、devices、mobile_clients、device_bindings、sessions。
- [ ] 增加 repository，server 业务层不直接写 SQL。
- [ ] 开发测试使用本地数据库或 test container。
- [ ] 测试：设备注册 upsert、绑定创建、撤销绑定、查询用户设备列表。
- [ ] 运行：`pnpm --filter @remote/server test`。
- [ ] 提交：`git commit -m "feat: persist devices and bindings"`。

### Task 15: Redis 在线状态

**Files:**
- Create: `apps/server/src/presence/redisPresenceStore.ts`
- Modify: `apps/server/src/deviceRegistry.ts`
- Test: `apps/server/tests/deviceRegistry.test.ts`

- [ ] 将在线状态接口抽象为 store。
- [ ] 开发期可用内存 store。
- [ ] 云端使用 Redis store。
- [ ] WebSocket 断开时更新离线状态。
- [ ] 测试：上线、心跳、断开、过期。
- [ ] 运行：`pnpm --filter @remote/server test`。
- [ ] 提交：`git commit -m "feat: add redis-backed device presence"`。

### Task 16: 部署与冒烟测试

**Files:**
- Create: `docs/runbooks/cloud-test-environment.md`
- Modify: `README.md`

- [ ] 选择第一阶段部署平台：Fly.io、Render、Railway 或自有 VPS。
- [ ] 配置 HTTPS/WSS 域名。
- [ ] 配置 PostgreSQL 和 Redis。
- [ ] 文档写入环境变量和启动命令。
- [ ] 用 TestFlight App 连接云端 server。
- [ ] 用 macOS Agent 连接云端 server。
- [ ] 执行 `printf "__CLOUD__%s\n" "$PWD"` 冒烟测试。
- [ ] 提交：`git commit -m "docs: add cloud test environment runbook"`。

## Phase 7: 发布前验收

### Task 17: MVP 验收清单

**Files:**
- Create: `docs/runbooks/mvp-acceptance.md`

- [ ] 验证新设备首次安装、扫码、绑定。
- [ ] 验证未绑定手机无法连接。
- [ ] 验证终端命令：`pwd`、`ls`、`git status`、`npm run dev`。
- [ ] 验证长命令中断：`ping 127.0.0.1` + `Ctrl+C`。
- [ ] 验证 App 前后台切换。
- [ ] 验证 Agent 重启后设备身份不变。
- [ ] 验证 server 重启后绑定关系不丢失。
- [ ] 验证 Agent 本地关闭终端能力后，Mobile 连接失败并显示原因。
- [ ] 验证会话页不展示广告。
- [ ] 提交：`git commit -m "docs: add mvp acceptance checklist"`。

## Execution Order

推荐按阶段顺序推进，不跳过 Phase 1 和 Phase 2。真机体验能最早暴露输入和连接问题；绑定鉴权必须在 TestFlight 前完成；macOS 安装包和云部署放在后面，避免把产品体验问题带进发布链路。

## Completion Criteria

计划完成后，应达到：

- 测试用户可以安装 iOS TestFlight App。
- 测试用户可以安装 macOS Agent。
- 手机扫码绑定 Mac。
- 手机点击设备默认进入终端。
- 常见命令和长运行命令可用。
- 断线重连有明确行为。
- 未授权设备无法连接。
- 云端不保存终端内容。
