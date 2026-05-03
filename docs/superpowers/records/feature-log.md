# 功能完成日志

## 2026-05-02 本地终端远控 MVP 基础

**状态：** completed

**提交：**
- `1882d14` `fix: close agent terminals on mobile disconnect`

**实现内容：**
- 建立 TypeScript monorepo。
- 建立 `packages/protocol` 协议包。
- 建立 Fastify + WebSocket server。
- 建立 macOS Agent CLI，使用 `node-pty` 打开本机 Shell。
- 建立 Expo React Native 移动端终端界面。
- 打通 Mobile -> Server -> Agent -> PTY -> Mobile 链路。

**涉及文件：**
- `packages/protocol/src/messages.ts`
- `apps/server/src/ws.ts`
- `apps/server/src/sessionHub.ts`
- `apps/agent/src/agentClient.ts`
- `apps/agent/src/terminalSession.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/src/protocol/sessionClient.ts`

**验证：**
- `pnpm test`: pass
- `pnpm typecheck`: pass
- `pnpm build`: pass
- 本地 WebSocket 冒烟：收到 `__PWD__/Users/hejianglong`

**已知风险：**
- 没有鉴权。
- 没有设备绑定。
- 状态在内存里。
- 不适合直接暴露公网。

**后续：**
- 增加外网最小安全边界。

## 2026-05-02 iOS 模拟器和真机开发流

**状态：** completed

**提交：**
- `d7f503e` `feat: prepare mobile simulator and iphone dev flow`
- `aa87a8d` `feat: add mobile simulator smoke mode`

**实现内容：**
- 修复 Expo iOS 入口。
- 增加 `@babel/runtime` 依赖。
- 增加模拟器自动连接和烟测命令配置。
- 移动端显示当前设备 ID 和 WebSocket URL。
- 增加连接失败分类。
- 增加终端快捷键：`Tab`、`Esc`、`Ctrl+C`、方向键。
- 增加真机接入手册。

**涉及文件：**
- `apps/mobile/index.js`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/src/config/runtimeConfig.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/src/components/terminalShortcuts.ts`
- `docs/runbooks/physical-iphone-to-mac.md`

**验证：**
- `pnpm test`: pass
- `pnpm typecheck`: pass
- `pnpm build`: pass
- iOS 模拟器自动连接：界面显示 `session open`
- 模拟器烟测输出：`__APP_SIM__/Users/hejianglong/Desktop/code/remote`
- WebSocket 端到端探针：收到 `__SCREEN__/Users/hejianglong`

**已知风险：**
- 仍是 Expo 开发模式，不是 TestFlight。
- 终端输出是纯文本，未做 ANSI 终端渲染。
- 输出缓冲无限增长。

**后续：**
- 增加 iOS TestFlight 配置。
- 增加输出缓冲限制和 ANSI 渲染。

## 2026-05-02 外网接入产品和技术设计

**状态：** completed

**提交：**
- `661b7bf` `docs: add external network access design`
- `a5e3036` `docs: refine cloud relay network strategy`

**实现内容：**
- 明确产品默认使用云中转。
- 明确 DDNS、端口映射、IPv6、反向隧道为高级选项。
- 补充外网接入原理、家庭地址转换、CGNAT 判断。
- 补充云中转产品设计、成本控制、安全边界、失败诊断。
- 新增外网云中转实施计划。

**涉及文件：**
- `docs/superpowers/specs/2026-05-02-external-network-access-design.md`
- `docs/superpowers/plans/2026-05-02-external-network-cloud-relay-plan.md`

**验证：**
- `git diff --check`: pass
- 文档占位符检查：pass

**已知风险：**
- 还没有实现 server token、WSS 部署、账号绑定。

**后续：**
- 实现服务端最小外网安全边界。

## 2026-05-02 服务端最小外网安全边界

**状态：** completed

**提交：**
- `2d48508` `docs: plan minimal external security implementation`
- `7bbc768` `feat: add server runtime config`
- `d41630d` `feat: guard websocket relay with dev token`
- `f84f362` `feat: support agent dev token relay auth`
- `2c06221` `feat: support mobile dev token relay auth`

**实现内容：**
- Server 增加运行配置：`HOST`、`PORT`、`REMOTE_REQUIRE_DEV_TOKEN`、`REMOTE_DEV_TOKEN`、`REMOTE_PUBLIC_BASE_URL`。
- Server 在 `/ws/agent` 和 `/ws/mobile` WebSocket 入口增加 dev token 校验。
- token 支持 query：`?token=<secret>`。
- token 支持 header：`Authorization: Bearer <secret>`。
- Agent 支持 `REMOTE_DEV_TOKEN`，连接时自动追加到 WebSocket URL。
- Mobile 支持 `EXPO_PUBLIC_REMOTE_DEV_TOKEN`，真实连接 URL 带 token，界面展示 URL 脱敏。
- 本地默认不启用 token，不影响模拟器和局域网开发链路。

**涉及文件：**
- `apps/server/src/config.ts`
- `apps/server/src/auth/devToken.ts`
- `apps/server/src/ws.ts`
- `apps/agent/src/config.ts`
- `apps/agent/src/agentClient.ts`
- `apps/mobile/src/config/runtimeConfig.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/auth/devToken.test.ts`
- `apps/server/tests/ws.test.ts`
- `apps/agent/tests/config.test.ts`
- `apps/agent/tests/agentClient.test.ts`
- `apps/mobile/tests/runtimeConfig.test.ts`

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，103 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- 无 token 本地 smoke：`HOST=127.0.0.1 PORT=8791 node apps/server/dist/index.js` + `REMOTE_SERVER_URL=ws://127.0.0.1:8791/ws/agent REMOTE_DEVICE_ID=smoke-mac node apps/agent/dist/index.js`，WebSocket probe 收到 `__LOCAL__/Users/hejianglong`。
- token 模式 smoke：`HOST=127.0.0.1 PORT=8792 REMOTE_REQUIRE_DEV_TOKEN=1 REMOTE_DEV_TOKEN=secret node apps/server/dist/index.js` + `REMOTE_SERVER_URL=ws://127.0.0.1:8792/ws/agent REMOTE_DEV_TOKEN=secret REMOTE_DEVICE_ID=token-mac node apps/agent/dist/index.js`，WebSocket probe 使用 `ws://127.0.0.1:8792/ws/mobile?token=secret` 收到 `__TOKEN__/Users/hejianglong`。

**已知风险：**
- dev token 是临时外网开发边界，不是正式账号体系。
- query token 可能出现在代理访问日志中；正式云中转应优先使用短期 session token 或 header，并配合 WSS。
- Server 设备状态和会话仍在内存中，进程重启会丢失连接状态。
- 还没有设备绑定、用户权限、审计日志、限流和封禁策略。

**后续：**
- 实现默认云中转部署入口和 WSS 反向代理配置。
- 增加正式账号、设备绑定和短期 session token。
- 增加外网 smoke runbook，覆盖云中转、DDNS、端口映射、IPv6、反向隧道高级选项。

## 2026-05-03 配对与鉴权协议消息

**状态：** completed

**提交：**
- `0795edc` `docs: plan pairing auth protocol messages`
- `0f65517` `feat: add pairing and auth protocol messages`

**实现内容：**
- 明确当前状态：Agent 仍是 Node CLI，不是多平台安装包；macOS 是当前主路径，Windows/Linux 只在协议字段上预留。
- 明确当前 iOS 状态：Expo 开发链路可用，模拟器/局域网链路可验证；真机需要按 `docs/runbooks/physical-iphone-to-mac.md` 在同一 Wi-Fi 手动验收；还不是 TestFlight。
- 新增协议消息：`pairing.create`、`pairing.approved`、`pairing.rejected`。
- `session.open` 增加可选 `sessionToken`。
- 新增协议消息：`terminal.snapshot.request`、`terminal.snapshot`。
- 新增协议消息：`pairing.created`、`pairing.requested`、`auth.sessionToken`、`device.status`。
- 继续保持 Zod strict schema，未知类型、多余字段、缺失关键字段都会解析失败。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-pairing-auth-protocol-messages-design.md`
- `docs/superpowers/plans/2026-05-03-pairing-auth-protocol-messages-plan.md`
- `packages/protocol/src/messages.ts`
- `packages/protocol/tests/messages.test.ts`

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，113 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- iOS/移动端链路 WebSocket smoke：`HOST=127.0.0.1 PORT=8793 node apps/server/dist/index.js` + `REMOTE_SERVER_URL=ws://127.0.0.1:8793/ws/agent REMOTE_DEVICE_ID=ios-check-mac node apps/agent/dist/index.js`，WebSocket probe 收到 `__IOS_CHECK__/Users/hejianglong`。

**已知风险：**
- 本功能只定义协议，不实现配对状态机、账号登录、数据库、Agent GUI 或 TestFlight。
- `sessionToken` 只是协议字段，Server 尚未生成或校验正式短期 token。
- Agent 还没有 macOS `.dmg/.pkg` 安装版，也没有 Windows 安装版。
- iOS 真机链路未在本次自动化中实际打开 iPhone，只验证了底层 WebSocket 会话链路。

**后续：**
- 实现 Server 配对状态机。
- 实现 Agent 持久设备身份，避免安装/重启后设备 ID 改变。
- 实现 Mobile 扫码/手动输入配对码。
- 再推进 macOS Agent 安装包和 iOS TestFlight。

## 2026-05-03 Agent 持久设备身份

**状态：** completed

**提交：**
- `83ed8cb` `docs: plan agent persistent identity`
- `2fdb9fb` `feat: persist agent device identity`

**实现内容：**
- 新增 Agent identity 模块，默认路径为 `~/.remote-terminal-agent/identity.json`。
- Agent 首次启动生成 `deviceId`、Ed25519 `publicKey`、`privateKey`、`createdAt`。
- Agent 后续启动复用同一身份文件，不再默认依赖 `${hostname}-dev`。
- `REMOTE_DEVICE_ID` 仍保留开发覆盖能力，现有手动 smoke 和调试命令不受影响。
- 损坏 JSON、缺失字段、多余字段都会拒绝启动并提示 `Agent identity file is invalid`。
- 预留 `DeviceIdentityStore` 接口，后续 macOS 安装版可替换为 Keychain store。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-agent-persistent-identity-design.md`
- `docs/superpowers/plans/2026-05-03-agent-persistent-identity-plan.md`
- `apps/agent/src/identity.ts`
- `apps/agent/src/config.ts`
- `apps/agent/tests/identity.test.ts`
- `apps/agent/tests/config.test.ts`

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test`: pass，28 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，118 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- 持久身份运行 smoke：`HOST=127.0.0.1 PORT=8794 node apps/server/dist/index.js` + 临时 `HOME` 下不设置 `REMOTE_DEVICE_ID` 启动 Agent，`/devices` 返回 UUID 设备，WebSocket probe 收到 `__IDENTITY__/tmp/remote-agent-home...`。

**已知风险：**
- 开发期私钥仍保存在本地 JSON 文件中，macOS 安装版需要切到 Keychain 或系统受保护存储。
- Server 还没有校验 Agent 公钥，当前只保证本地身份稳定。
- 用户删除 identity 文件后会生成新设备；安装版需要提供明确的重置/迁移流程。

**后续：**
- 实现 Server 配对状态机，使用 `deviceId` 和 `publicKey` 建立绑定关系。
- 实现 Agent 配对码请求和本地确认/拒绝。
- 实现 Mobile 扫码或手动输入配对码。

## 2026-05-03 Server 配对状态机

**状态：** completed

**提交：**
- `d4575fb` `docs: plan server pairing state machine`
- `065b951` `feat: add device pairing state machine`

**实现内容：**
- 新增内存配对状态机，支持创建配对码、提交配对请求、Agent approve/reject、绑定记录。
- Agent 注册后可通过 WebSocket 发送 `pairing.create`，Server 返回 `pairing.created`。
- Mobile 可通过 `POST /pairing/requests` 提交 `pairingCode`、`mobileClientId`、`mobileName`。
- Server 将 `pairing.requested` 推送给对应在线 Agent。
- Agent 发送 `pairing.approved` 后，Server 创建内存 binding。
- Agent 发送 `pairing.rejected` 后，Server 标记请求 rejected，不创建 binding。
- 新增 `GET /pairing/bindings`，用于开发期查看绑定结果。
- 配对码使用 SHA-256 hash 存储，具备过期和一次性使用保护。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-server-pairing-state-machine-design.md`
- `docs/superpowers/plans/2026-05-03-server-pairing-state-machine-plan.md`
- `apps/server/src/pairing/pairingStore.ts`
- `apps/server/src/pairing/pairingService.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/pairing/pairingService.test.ts`
- `apps/server/tests/ws.test.ts`

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，55 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，125 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前绑定关系仍是内存态，Server 重启后丢失。
- `POST /pairing/requests` 还没有正式账号登录鉴权，公网产品化前必须补上。
- Agent 还没有 UI 展示配对码和确认弹窗；当前只能通过 WebSocket 消息完成。
- 绑定关系尚未用于 `session.open` 鉴权，未绑定 Mobile 仍可打开终端；下一步需要短期 session token。

**后续：**
- 实现 Mobile 配对入口，先支持手动输入配对码，再接扫码。
- 实现 Agent 本地配对确认/拒绝交互。
- 实现会话短期 token，让未绑定 Mobile 无法打开终端。

## 2026-05-03 Mobile 手动配对入口

**状态：** completed

**提交：**
- `cc797d1` `docs: plan mobile manual pairing flow`
- `bf86e56` `feat: add mobile manual pairing flow`

**实现内容：**
- Mobile runtime config 增加 `apiBaseUrl`、`displayApiBaseUrl`、`mobileClientId`、`mobileName`。
- `apiBaseUrl` 默认从 WebSocket URL 推导：`ws` -> `http`，`wss` -> `https`。
- 新增 `PairingClient`，封装 `POST /pairing/requests`。
- `PairingClient` 支持注入 `fetch`，覆盖成功、server error、无效响应测试。
- `TerminalScreen` 顶部新增紧凑手动配对面板。
- 用户输入配对码并点击 `Pair` 后，Mobile 提交 pairing request，成功显示 pending request id，失败显示错误。
- 现有终端连接、快捷键、命令输入不变。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-mobile-manual-pairing-design.md`
- `docs/superpowers/plans/2026-05-03-mobile-manual-pairing-plan.md`
- `apps/mobile/src/config/runtimeConfig.ts`
- `apps/mobile/src/protocol/pairingClient.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/runtimeConfig.test.ts`
- `apps/mobile/tests/pairingClient.test.ts`

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，29 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，129 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- Pairing smoke：`HOST=127.0.0.1 PORT=8795 node apps/server/dist/index.js`，WebSocket probe 注册 `pairing-smoke-mac` 并创建配对码，HTTP `POST /pairing/requests` 提交 `mobile-smoke`，Agent approve 后 `GET /pairing/bindings` 返回 `mobile-smoke` binding。

**已知风险：**
- 当前是开发态手动输入配对码，不是扫码。
- 绑定结果不持久化到 Mobile 本地，App 重启后不会记住 binding。
- 没有轮询 binding approve/reject 结果；用户需要等待后续设备列表/session token 能力。
- HTTP pairing request 仍未接正式登录鉴权。

**后续：**
- 增加 Agent 本地配对码展示和 approve/reject 操作。
- 增加 Mobile 扫码入口和 secure storage。
- 实现会话短期 token，让终端连接真正依赖绑定关系。

## 2026-05-03 Agent CLI 配对码展示和确认

**状态：** completed

**提交：**
- `d88297a` `docs: plan agent cli pairing approval`
- `70dca9c` `feat: add agent cli pairing approval`

**实现内容：**
- Agent 收到 `device.registered` 后自动发送 `pairing.create`，不再需要手写 WebSocket probe 创建配对码。
- 新增 `apps/agent/src/pairing.ts`，封装配对码控制台展示和本机确认提示。
- Agent 收到 `pairing.created` 后打印 pairing code、device、server、expiresAt。
- Agent 收到 `pairing.requested` 后调用本机确认函数。
- 本机输入 `y` 或 `yes` 时发送 `pairing.approved`。
- 本机拒绝、非交互环境、确认函数抛错时发送 `pairing.rejected`，并带拒绝原因。
- `AgentClient` 支持注入 `displayPairingCode` 和 `approvePairingRequest`，便于测试和后续 macOS GUI 替换。
- 现有终端会话输入、resize、close、output、exit 行为保持不变。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-agent-cli-pairing-approval-design.md`
- `docs/superpowers/plans/2026-05-03-agent-cli-pairing-approval-plan.md`
- `apps/agent/src/pairing.ts`
- `apps/agent/src/agentClient.ts`
- `apps/agent/tests/agentClient.test.ts`

**TDD 记录：**
- 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test` 失败，4 个新增配对行为测试失败，原因是 AgentClient 尚未处理配对消息。
- 绿灯：实现后 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test` 通过，4 files passed，32 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test`: pass，32 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，133 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- CLI prompt 只是开发态能力，macOS 安装版需要改成菜单栏或原生弹窗确认。
- 非 TTY 环境默认拒绝配对，后台服务模式需要明确的本地 UI 或策略配置。
- 当前只打印文本配对码，还没有二维码。
- 绑定关系仍未持久化，也尚未用于 `session.open` 鉴权。

**后续：**
- 增加 Agent 端二维码展示，Mobile 支持扫码。
- 实现 macOS Agent 桌面壳和本地确认 UI。
- 实现绑定持久化与短期 session token，让终端连接真正依赖配对绑定。

## 2026-05-03 Session Token 绑定鉴权

**状态：** completed

**提交：**
- `e907bd7` `docs: design session token binding enforcement`
- `a5202a0` `docs: plan session token binding enforcement`
- `364998e` `feat: enforce session token binding on server`
- `3f919e9` `feat: carry session token from mobile pairing`

**实现内容：**
- Server 新增内存 `MemorySessionTokenStore`，支持发放、校验、过期判断和设备匹配判断。
- Agent 发送 `pairing.approved` 后，Server 创建 binding 并发放短期 `sessionToken`。
- Server 新增 `GET /pairing/requests/:pairingRequestId`，返回 pending、rejected 或 approved 状态。
- approved 状态返回 `auth.sessionToken`，Mobile 可用它打开终端会话。
- `/ws/mobile` 的 `session.open` 开始强制校验 `sessionToken`。
- 未携带 token、错误 token、过期 token、设备不匹配 token 都会返回 `session.error`。
- Mobile `PairingClient` 支持查询配对状态和等待批准。
- Mobile `SessionClient` 支持在 `session.open` 中携带 token。
- `TerminalScreen` 在提交配对后等待批准，拿到 token 后存入内存状态，并在 Connect 时传给 `SessionClient`。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-session-token-binding-enforcement-design.md`
- `docs/superpowers/plans/2026-05-03-session-token-binding-enforcement-plan.md`
- `apps/server/src/auth/sessionTokens.ts`
- `apps/server/src/pairing/pairingService.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/auth/sessionTokens.test.ts`
- `apps/server/tests/ws.test.ts`
- `apps/mobile/src/protocol/pairingClient.ts`
- `apps/mobile/src/protocol/sessionClient.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/pairingClient.test.ts`
- `apps/mobile/tests/sessionClient.test.ts`

**TDD 记录：**
- Server 红灯 1：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，原因是 `sessionTokens.ts` 不存在。
- Server 绿灯 1：实现 token store 后 Server 测试通过，60 tests passed。
- Server 红灯 2：新增状态接口和 `session.open` 鉴权测试后失败，状态接口 404，且无 token 仍能打开 session。
- Server 绿灯 2：实现状态接口和 token 校验后 Server 测试通过，66 tests passed。
- Mobile 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test` 失败，原因是缺少 `getPairingRequest()`、`waitForApproval()`，且 `session.open` 未携带 token。
- Mobile 绿灯：实现后 Mobile 测试通过，35 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，66 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，35 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，150 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- token 和 binding 仍在 Server 内存中，Server 重启会失效。
- Mobile token 只保存在组件内存中，App 重启需要重新配对。
- token 没有 refresh 和 revoke 机制。
- 当前没有账号系统和设备列表，配对仍依赖配对码和 Agent 本地批准。
- `auth.sessionToken.sessionId` 在配对阶段固定为 `pending`，真实终端 session 仍以 `session.opened.sessionId` 为准。

**后续：**
- 将 binding/token 持久化到数据库或云中转存储。
- Mobile 使用 SecureStore 保存短期 token。
- 增加设备列表，只展示已绑定设备。
- 增加撤销绑定和 token revoke。
- 开始 macOS Agent 安装版和菜单栏确认 UI。

## 2026-05-03 Mobile 持久配对与 token 恢复

**状态：** completed

**提交：**
- `460cadc` `docs: design mobile persisted pairing`
- `2c84f7b` `docs: plan mobile persisted pairing`
- `e242970` `feat: persist mobile pairing token`

**实现内容：**
- Mobile 增加 `expo-secure-store@~14.0.1`，并在 `app.json` 注册 `expo-secure-store` plugin。
- 新增 `pairingTokenStore`，提供安全存储抽象和默认 SecureStore 适配器。
- 保存字段包含 `deviceId`、`sessionToken`、`expiresAt`、`pairedAt`。
- `loadPairingToken()` 会严格解析 JSON，遇到损坏、缺字段或过期 token 会清理存储并返回 `null`。
- `TerminalScreen` 启动时恢复有效 token，恢复后显示 paired 状态并可直接 Connect。
- 配对批准后，Mobile 保存 token 到 SecureStore，再把 token 传给 `SessionClient`。
- SecureStore 采用懒加载，Vitest 单元测试使用 fake storage，不加载原生模块。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-mobile-persisted-pairing-design.md`
- `docs/superpowers/plans/2026-05-03-mobile-persisted-pairing-plan.md`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/src/state/pairingTokenStore.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/pairingTokenStore.test.ts`
- `pnpm-lock.yaml`

**TDD 记录：**
- 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test` 失败，原因是 `pairingTokenStore` 模块不存在。
- 中间失败：静态导入 `expo-secure-store` 会让 Vitest 解析原生包失败；改为懒加载 SecureStore，测试只走 fake storage。
- 绿灯：实现后 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test` 通过，40 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，40 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，155 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- Server token 仍是内存态，Server 重启后 Mobile 本地 token 会失效。
- 当前只保存一个本地设备 token，不是多设备列表。
- 没有 refresh、revoke、Forget device UI。
- 真机如果使用 Expo Go，需要确认对应 SDK 环境支持 `expo-secure-store`；开发客户端需要重新安装原生依赖。

**后续：**
- Server 持久化 binding/token，避免重启后失效。
- Mobile 增加多设备列表和 Forget device。
- 增加 token refresh/revoke。
- 推进 macOS Agent 安装版和菜单栏确认 UI。

## 2026-05-03 Server 持久配对与 token 存储

**状态：** completed

**提交：**
- `574c947` `docs: design server persistent pairing storage`
- `8859781` `docs: plan server persistent pairing storage`
- `b842dc2` `feat: persist server pairing storage`

**实现内容：**
- Server 配置新增 `REMOTE_DATA_DIR` / `ServerConfig.dataDir`。
- 未配置 `REMOTE_DATA_DIR` 时继续使用内存 store，保持本地测试和快速开发行为。
- 配置 `REMOTE_DATA_DIR` 时，Server 使用 JSON 文件保存 pairing code、pairing request、binding 和 session token。
- 新增 `JsonFilePairingStore`，支持保存/恢复 code、request、binding。
- 新增 `JsonFileSessionTokenStore`，支持保存/恢复 token，并按 device/mobile 查找最新有效 token。
- `PairingService` 改为依赖 `PairingStore` interface，不再写死内存 store。
- `registerWsRoutes()` 根据 `dataDir` 自动选择内存或 JSON 文件 store。
- `GET /pairing/requests/:id` 在 approved 状态下从 token store 查找 token，Server 重启后也能返回/校验 token。
- 新增重启验收测试：同一 `dataDir` 下重建 Server，重新上线 Agent 后，Mobile 使用旧 token 能打开 terminal session。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-server-persistent-pairing-storage-design.md`
- `docs/superpowers/plans/2026-05-03-server-persistent-pairing-storage-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/pairing/pairingStore.ts`
- `apps/server/src/pairing/pairingService.ts`
- `apps/server/src/auth/sessionTokens.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/pairing/pairingStore.test.ts`
- `apps/server/tests/auth/sessionTokens.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Config 红灯：ServerConfig 缺少 `dataDir`，config tests 失败。
- Pairing store 红灯：`JsonFilePairingStore` 不存在，pairing store tests 失败。
- Token store 红灯：`JsonFileSessionTokenStore` 和 `findTokenForBinding()` 不存在，session token tests 失败。
- Route 红灯：配置同一 `dataDir` 重启 Server 后，旧 token 无法打开 session。
- 绿灯：实现文件 store 和 route 接入后，Server 测试通过，72 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，72 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，161 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- JSON 文件 store 只适合单进程 MVP，不适合多实例云部署。
- token 仍以明文保存在 JSON 文件中，正式生产需要 hash 或加密。
- 没有文件锁，多进程写入可能丢数据。
- 没有 refresh/revoke。

**后续：**
- 增加 Mobile 多设备列表和 Forget device。
- 增加 token revoke/refresh。
- 后续云中转迁移到 SQLite 或 Postgres。
- 推进 macOS Agent 安装版和菜单栏确认 UI。

## 2026-05-03 Mobile Forget Device

**状态：** completed

**提交：**
- `1076007` `docs: plan mobile forget device`
- `075f546` `feat: add mobile forget device action`

**实现内容：**
- Mobile 增加已配对设备状态 `pairedDeviceId`。
- 恢复 SecureStore token 或配对批准后，UI 显示 `Paired <deviceId>`。
- pairing panel 中新增紧凑 `Forget` 按钮。
- 点击 Forget 后清除 SecureStore token、清空内存 `sessionToken`、关闭当前 `SessionClient`，并把 UI 状态改为 `not paired`。
- 保留现有手动输入配对码入口，Forget 后可立即重新配对。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-mobile-forget-device-design.md`
- `docs/superpowers/plans/2026-05-03-mobile-forget-device-plan.md`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/pairingTokenStore.test.ts`

**TDD 记录：**
- 新增 `clearPairingToken()` 幂等测试，Mobile 测试通过，41 tests passed。
- UI 接入后 Mobile test/typecheck 通过。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，41 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，162 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- Forget 只清除 Mobile 本机 token，不会通知 Server revoke。
- Server token 在过期前仍存在；需要 revoke API 才能完整撤销。
- 当前仍是单设备状态，不是多设备列表。

**后续：**
- 增加 Server revoke API。
- Mobile Forget 调用 revoke 后再清除本地 token。
- 增加多设备列表和设备切换。

## 2026-05-03 Session Token Revoke

**状态：** completed

**提交：**
- `ad2d69c` `docs: plan session token revoke`
- `47e84de` `feat: revoke session token on forget`

**实现内容：**
- `SessionTokenStore` 增加 `revokeSessionToken()`。
- Memory token store 支持删除指定 token。
- JSON token store revoke 后会写回 `session-tokens.json`。
- Server 新增 `POST /session-tokens/revoke`。
- token 不存在时返回 `{ revoked: false }`。
- token 存在但 deviceId 不匹配时返回 400。
- token revoke 后再次 `session.open` 会返回 `Invalid session token`。
- Mobile `PairingClient` 增加 `revokeSessionToken()`。
- Mobile Forget device 会先尝试调用 Server revoke，然后清除本地 SecureStore token；revoke 失败不会阻止本地 Forget。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-session-token-revoke-design.md`
- `docs/superpowers/plans/2026-05-03-session-token-revoke-plan.md`
- `apps/server/src/auth/sessionTokens.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/auth/sessionTokens.test.ts`
- `apps/server/tests/ws.test.ts`
- `apps/mobile/src/protocol/pairingClient.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/pairingClient.test.ts`

**TDD 记录：**
- Server store 红灯：`revokeSessionToken()` 不存在，auth tests 失败。
- Server route 红灯：`POST /session-tokens/revoke` 返回 404。
- Mobile 红灯：`PairingClient.revokeSessionToken()` 不存在。
- 绿灯：实现后 Server、Mobile 和全量测试通过。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，76 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，42 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，167 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- Revoke API 当前只凭 token 本身授权，正式账号体系需要登录态和设备归属校验。
- 仍没有批量撤销和多设备列表。
- HTTP pairing/revoke 接口还没有统一 dev token/header 鉴权。

**后续：**
- 增加多设备列表和设备切换。
- 给 HTTP pairing/revoke 接口补齐 dev token 或正式登录鉴权。
- 增加 token refresh。

## 2026-05-03 HTTP Pairing Dev Token Guard

**状态：** completed

**提交：**
- `f65572b` `docs: plan http pairing dev token guard`
- `f6a4843` `feat: guard http pairing with dev token`

**实现内容：**
- Server 为 HTTP pairing/status/bindings/revoke 增加统一 dev token guard。
- 当 `REMOTE_REQUIRE_DEV_TOKEN=1` 时，无 token 或错误 token 的 HTTP pairing/revoke 请求返回 401。
- 受保护路由包括 `GET /pairing/bindings`、`POST /pairing/requests`、`GET /pairing/requests/:pairingRequestId`、`POST /session-tokens/revoke`。
- HTTP guard 复用现有 `getProvidedDevToken()` 和 `validateDevToken()`，与 WebSocket 鉴权规则保持一致。
- Mobile `PairingClient` 增加 `devToken?: string | null` option。
- `requestPairing()`、`getPairingRequest()`、`revokeSessionToken()` 在配置 dev token 后自动携带 `Authorization: Bearer <token>`。
- `TerminalScreen` 从 `runtimeConfig.devToken` 传入 `PairingClient`，保证 iOS 模拟器/真机在开启 dev token 时仍可完成配对和 Forget revoke。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-http-pairing-dev-token-guard-design.md`
- `docs/superpowers/plans/2026-05-03-http-pairing-dev-token-guard-plan.md`
- `apps/server/src/ws.ts`
- `apps/server/tests/ws.test.ts`
- `apps/mobile/src/protocol/pairingClient.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/pairingClient.test.ts`

**TDD 记录：**
- Server 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，HTTP pairing/revoke 无 token 时返回 400/404 而不是 401。
- Server 绿灯：增加 `isAuthorizedHttpRequest()` 并保护 HTTP 路由后，Server 测试通过，78 tests passed。
- Mobile 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test` 失败，`PairingClient` 未发送 `Authorization` header。
- Mobile 中间失败：无 dev token 的 `getPairingRequest()` 多传了 `undefined` fetch options，破坏旧行为断言；拆分有 token/无 token 调用后恢复兼容。
- Mobile 绿灯：实现 `devToken` option、统一 header 构造和 `TerminalScreen` 传参后，Mobile 测试通过，45 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，78 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，45 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，172 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- dev token 只是开发期边界，不是正式账号登录和设备归属鉴权。
- 当前仍支持 query token，高级调试方便但可能进入代理或访问日志；生产环境应优先只用 header。
- pairing/revoke 路由还没有速率限制，公网云中转前需要补齐防爆破和滥用控制。

**后续：**
- 增加正式登录、账号绑定和设备归属校验。
- 给 pairing/status/revoke 接口增加 rate limit。
- 生产配置中逐步移除 query token，保留 `Authorization` header。
- 继续推进多设备列表、设备切换和外网默认云中转链路。

## 2026-05-03 HTTP Rate Limit

**状态：** completed

**提交：**
- `18e833d` `docs: design http rate limit`
- `744f478` `docs: plan http rate limit`
- `a5c4917` `feat: add http rate limit`

**实现内容：**
- Server 配置新增 `REMOTE_HTTP_RATE_LIMIT_WINDOW_MS` 和 `REMOTE_HTTP_RATE_LIMIT_MAX`。
- 默认 HTTP 限流为 60 秒窗口、每客户端 120 次请求。
- 新增 `MemoryRateLimiter`，使用单进程内存固定窗口算法。
- `GET /pairing/bindings`、`POST /pairing/requests`、`GET /pairing/requests/:pairingRequestId`、`POST /session-tokens/revoke` 接入限流。
- 限流顺序为先 dev token guard，再 rate limit，再进入业务逻辑。
- 客户端 key 优先取 `x-forwarded-for` 第一个 IP，其次取 `request.ip`。
- 超限返回 HTTP 429、JSON `{ error: "Rate limit exceeded", retryAfterMs }`，并设置 `Retry-After` header。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-http-rate-limit-design.md`
- `docs/superpowers/plans/2026-05-03-http-rate-limit-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/rateLimit.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/rateLimit.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts` 失败，`ServerConfig` 缺少 rate limit 字段，非法环境变量未抛错。
- Config 绿灯：实现 `rateLimitWindowMs`、`rateLimitMaxRequests` 和整数解析后，Server config 测试通过。
- RateLimiter 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/rateLimit.test.ts` 失败，`apps/server/src/rateLimit.ts` 不存在。
- RateLimiter 绿灯：实现 `MemoryRateLimiter.check()` 后，新增 3 个限流单测通过。
- Route 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts` 失败，第三次同 IP pairing request 仍返回 400 而不是 429。
- Route 绿灯：HTTP route 在 auth 后接入 limiter，Server 测试通过，84 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，84 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，178 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 内存限流只在单个 Server 进程内生效，多实例云中转需要共享 store。
- `x-forwarded-for` 必须来自可信代理；生产环境不能盲信客户端伪造 header。
- IP 级限流可能误伤同一 NAT 出口下的多个用户。
- 当前没有 WebSocket 消息级限流，terminal 输入输出仍需后续保护。

**后续：**
- 云中转多实例时实现 Redis/Postgres rate limit store。
- 增加 WebSocket 消息级限流。
- 增加账号级、设备级、pairing code 级组合限流。

## 2026-05-03 WebSocket Message Rate Limit

**状态：** completed

**提交：**
- `659acba` `docs: design websocket message rate limit`
- `03fc7f3` `docs: plan websocket message rate limit`
- `5e234c7` `feat: rate limit mobile websocket messages`

**实现内容：**
- Server 配置新增 `REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS` 和 `REMOTE_WS_MESSAGE_RATE_LIMIT_MAX`。
- 默认 Mobile WebSocket terminal 消息限流为 10 秒窗口、每客户端 200 条消息。
- `/ws/mobile` 的 `terminal.input` 和 `terminal.resize` 在路由给 Agent 前检查限流。
- `session.open` 不计入 terminal message 限流额度，避免连接建立影响后续输入。
- 限流 key 使用 `ws.mobile.messages:<clientKey>`，`clientKey` 优先取 `x-forwarded-for` 第一个 IP，其次取 `request.ip`。
- 超限时 Server 向 Mobile 返回 `session.error`，message 为 `Rate limit exceeded`，并保留原始 `sessionId`。
- 超限不关闭 WebSocket，用户等待窗口恢复后可继续使用。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-websocket-message-rate-limit-design.md`
- `docs/superpowers/plans/2026-05-03-websocket-message-rate-limit-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts` 失败，`ServerConfig` 缺少 WebSocket message rate limit 字段，非法配置未抛错。
- Config 绿灯：实现 `wsMessageRateLimitWindowMs`、`wsMessageRateLimitMaxRequests` 和环境变量解析后，config 测试通过。
- Route 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts` 失败，第二条 `terminal.input` 后 Mobile 等不到 `Rate limit exceeded`。
- Route 绿灯：在 `/ws/mobile` 路由到 Agent 前接入 `MemoryRateLimiter`，Server 测试通过，86 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，86 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，180 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 内存限流只对单 Server 进程生效，多实例云中转需要共享 store。
- IP 级 WebSocket 限流可能误伤同一 NAT 出口下的多个用户。
- 当前只按消息数限流，没有限制单条 `terminal.input.data` 的字节数。
- Agent 到 Mobile 的 `terminal.output` 仍没有输出背压和限速。

**后续：**
- 增加 terminal input 单条字节数限制。
- 增加 Agent output 背压和输出限速。
- 云中转多实例时把 WebSocket 限流迁移到 Redis/Postgres。

## 2026-05-03 Terminal Input Size Limit

**状态：** completed

**提交：**
- `ee316da` `docs: design terminal input size limit`
- `cbba7eb` `docs: plan terminal input size limit`
- `9477596` `feat: limit terminal input size`

**实现内容：**
- Server 配置新增 `REMOTE_TERMINAL_INPUT_MAX_BYTES`。
- 默认单条 `terminal.input.data` 限制为 16 KiB。
- `/ws/mobile` 在路由 `terminal.input` 给 Agent 前使用 `Buffer.byteLength(data, "utf8")` 校验 UTF-8 字节数。
- 超限时返回 `session.error`，message 为 `Terminal input exceeds <N> bytes`，保留原始 `sessionId`。
- 超限 input 不转发给 Agent，不关闭 WebSocket。
- `terminal.resize` 不受该字节限制影响。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-terminal-input-size-limit-design.md`
- `docs/superpowers/plans/2026-05-03-terminal-input-size-limit-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts` 失败，`ServerConfig` 缺少 `terminalInputMaxBytes`，非法配置未抛错。
- Config 绿灯：实现 `terminalInputMaxBytes` 和 `REMOTE_TERMINAL_INPUT_MAX_BYTES` 解析后，config 测试通过。
- Route 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts` 失败，超限 input 后 Mobile 等不到错误，说明消息仍被转发。
- Route 绿灯：增加 `assertTerminalInputSize()` 后，Server 测试通过，88 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，88 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，182 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- JSON parse 仍发生在大小校验之前，超大原始 WebSocket frame 还可能造成解析压力。
- 当前没有累计字节限流，客户端仍可能发送多条接近上限的输入。
- 长脚本和大内容不适合走 terminal input，后续应通过文件传输或脚本上传能力处理。

**后续：**
- 增加 WebSocket raw message size guard。
- 增加 terminal input 累计字节限流。
- 设计文件传输和脚本上传能力。

## 2026-05-03 WebSocket Raw Message Size Guard

**状态：** completed

**提交：**
- `07ff9fd` `docs: design websocket raw message size guard`
- `f21bba7` `docs: plan websocket raw message size guard`
- `9a688cb` `feat: guard websocket raw message size`

**实现内容：**
- Server 配置新增 `REMOTE_WS_RAW_MESSAGE_MAX_BYTES`。
- 默认单条 WebSocket raw message 限制为 64 KiB。
- `parseJson()` 改为先计算 `RawData` 字节数，超过上限时直接抛出 `WebSocket message exceeds <N> bytes`。
- `/ws/agent` 和 `/ws/mobile` 两个入口都在 JSON parse 前应用 raw message size guard。
- 支持 string、Buffer 和 Buffer array 形式的 `RawData` 字节计算。
- 超限时沿用现有 `session.error` 响应，不进入协议解析和业务路由。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-websocket-raw-message-size-guard-design.md`
- `docs/superpowers/plans/2026-05-03-websocket-raw-message-size-guard-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts` 失败，`ServerConfig` 缺少 `wsRawMessageMaxBytes`，非法配置未抛错。
- Config 绿灯：实现 `wsRawMessageMaxBytes` 和 `REMOTE_WS_RAW_MESSAGE_MAX_BYTES` 解析后，config 测试通过。
- Route 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts` 失败，超大 raw frame 返回 JSON parse error，而不是 size guard error。
- Route 绿灯：`parseJson(data, maxBytes)` 增加 parse 前字节检查后，Server 测试通过，90 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，90 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，184 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- WebSocket 库仍会先接收 frame 到进程内存，本功能保护的是应用层 JSON parse 和后续路由。
- 64 KiB 可能影响极端大 terminal output chunk，后续需要 Agent 输出分块和背压。
- 超限 raw frame 无法安全提取 `sessionId`，因此错误响应不带 session 上下文。

**后续：**
- 在 Agent 端增加 terminal output 分块上限。
- 增加 Agent output 背压和输出限速。
- 评估 WebSocket server 层 `maxPayload` 配置。

## 2026-05-03 Agent Terminal Output Chunking

**状态：** completed

**提交：**
- `a893f3e` `docs: design agent terminal output chunking`
- `77b2526` `docs: plan agent terminal output chunking`
- `6b8a933` `feat: chunk agent terminal output`

**实现内容：**
- Agent 配置新增 `REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES`。
- 默认 terminal output chunk 大小为 16 KiB。
- `AgentClient` 在 PTY `onOutput()` 后按 UTF-8 字节数拆分输出。
- 每个 chunk 作为独立 `terminal.output` 发送，保留原始 `sessionId`、`stream` 和输出顺序。
- ASCII 大输出会拆分，例如 4 字节配置下 `"abcdef"` 拆成 `"abcd"`、`"ef"`。
- UTF-8 多字节字符不会被切坏，例如 4 字节配置下 `"你好"` 拆成 `"你"`、`"好"`。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-agent-terminal-output-chunking-design.md`
- `docs/superpowers/plans/2026-05-03-agent-terminal-output-chunking-plan.md`
- `apps/agent/src/config.ts`
- `apps/agent/src/agentClient.ts`
- `apps/agent/tests/config.test.ts`
- `apps/agent/tests/agentClient.test.ts`

**TDD 记录：**
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test -- apps/agent/tests/config.test.ts` 失败，`AgentConfig` 缺少 `terminalOutputChunkBytes`，非法配置未抛错。
- Config 绿灯：实现 `terminalOutputChunkBytes` 和 `REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES` 解析后，Agent config 测试通过。
- AgentClient 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test -- apps/agent/tests/agentClient.test.ts` 失败，大输出仍被原样发成一条 `terminal.output`。
- AgentClient 绿灯：实现 `splitUtf8ByBytes()` 并在 `session.onOutput()` 中按顺序发送 chunk 后，Agent 测试通过，35 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test`: pass，35 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，187 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前只做分块，不做背压；Agent 仍可能快速发送大量 chunk。
- 如果用户把 chunk 配置得接近 Server raw limit，JSON envelope 后仍可能触发 Server guard。
- 单个字符超过 chunk 限制时仍会作为单独 chunk 发送。

**后续：**
- 增加 Agent output 背压和发送队列上限。
- 增加 Server 对 Agent output 的消息数/字节速率限制。
- 文件和日志输出后续走专用传输通道。

## 2026-05-03 Server Agent Output Rate Limit

**状态：** completed

**提交：**
- `6c6a2d2` `docs: design server agent output rate limit`
- `ee0b97d` `docs: plan server agent output rate limit`
- `86bd284` `feat: rate limit agent terminal output`

**实现内容：**
- Server 配置新增 `REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS` 和 `REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX`。
- 默认 Agent output 限流为 10 秒窗口、每设备 1000 条 `terminal.output`。
- `/ws/agent` 在 `terminal.output` 路由给 Mobile 前按 `deviceId` 检查 `MemoryRateLimiter`。
- 超限 output 不转发给 Mobile，Server 向 Agent 返回 `session.error`，message 为 `Rate limit exceeded`，并带原始 `sessionId`。
- `terminal.exit` 不计入 output 限流，超限后仍可转发给 Mobile。
- Agent routable 错误现在会尽量带上 `sessionId`，便于 Agent 侧定位具体 session。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-server-agent-output-rate-limit-design.md`
- `docs/superpowers/plans/2026-05-03-server-agent-output-rate-limit-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts` 失败，`ServerConfig` 缺少 Agent output 限流字段，非法配置未抛错。
- Config 绿灯：实现 `agentOutputRateLimitWindowMs`、`agentOutputRateLimitMaxMessages` 和环境变量解析后，config 测试通过。
- Route 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts` 失败，第二条 `terminal.output` 没有返回限流错误。
- Route 中间调整：Agent routable 错误增加 `sessionId` 后，旧 stale-agent 测试期望同步更新。
- Route 绿灯：接入设备级 `MemoryRateLimiter` 后，Server 测试通过，92 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，92 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，189 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前是丢弃式限流，不是背压；超限输出会丢失。
- 内存限流只在单 Server 进程内生效，多实例云中转需要共享 store。
- 当前只按消息数限制，没有按字节数统计 Agent output。

**后续：**
- 增加 Agent output 背压队列和发送队列上限。
- 增加 Agent output 字节速率限制。
- 多实例云中转迁移到 Redis/Postgres limiter store。

## 2026-05-03 Server Agent Output Byte Rate Limit

**状态：** completed

**提交：**
- `00860e9` `docs: design server agent output byte rate limit`
- `790466e` `docs: plan server agent output byte rate limit`
- `bfa650d` `feat: rate limit agent terminal output bytes`

**实现内容：**
- Server 配置新增 `REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS` 和 `REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX`。
- 默认 Agent output 字节限流为 10 秒窗口、每设备 1 MiB。
- `rateLimit.ts` 新增 `MemoryWeightedRateLimiter`，支持按 weight 累计窗口用量。
- `/ws/agent` 对 `terminal.output.data` 使用 UTF-8 字节数作为 weight 进行限流。
- 超限 output 不转发给 Mobile，Server 向 Agent 返回 `session.error`，message 为 `Rate limit exceeded`，带原始 `sessionId`。
- `terminal.exit` 不计入字节限流。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-server-agent-output-byte-rate-limit-design.md`
- `docs/superpowers/plans/2026-05-03-server-agent-output-byte-rate-limit-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/rateLimit.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/rateLimit.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Weighted limiter 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/rateLimit.test.ts` 失败，`MemoryWeightedRateLimiter` 不存在。
- Weighted limiter 绿灯：实现按权重累计、拒绝不消耗容量、窗口重置和 key 隔离后，limiter 测试通过。
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts` 失败，`ServerConfig` 缺少 Agent output byte rate 字段，非法配置未抛错。
- Config 绿灯：实现 `agentOutputByteRateLimitWindowMs`、`agentOutputByteRateLimitMaxBytes` 和环境变量解析后，config 测试通过。
- Route 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts` 失败，Agent output 字节超限时没有返回限流错误。
- Route 绿灯：接入 `MemoryWeightedRateLimiter` 后，Server 测试通过，98 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，98 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，193 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前仍是丢弃式限流，不是背压；超限输出会丢失。
- 内存限流只在单 Server 进程内生效，多实例云中转需要共享 store。
- 字节统计发生在 JSON parse 后；raw frame 大小仍由 raw message guard 保护。

**后续：**
- 增加 Agent output 背压队列。
- 将 limiter store 抽象为 Redis/Postgres 可替换实现。
- 增加 Mobile input 累计字节限流。

## 2026-05-03 Server Mobile Input Byte Rate Limit

**状态：** completed

**提交：**
- `dc5143a` `docs: design server mobile input byte rate limit`
- `0ee6fdc` `docs: plan server mobile input byte rate limit`
- `ef9add4` `feat: rate limit mobile terminal input bytes`

**实现内容：**
- Server 配置新增 `REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS` 和 `REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX`。
- 默认 Mobile input 字节限流为 10 秒窗口、每客户端 256 KiB。
- `/ws/mobile` 对 `terminal.input.data` 使用 UTF-8 字节数作为 weight 进行累计限流。
- 限流 key 为 `ws.mobile.input.bytes:<clientKey>`，`clientKey` 复用 `x-forwarded-for`、`request.ip`、`unknown` 顺序。
- 超限 input 不转发给 Agent，Server 向 Mobile 返回 `session.error`，message 为 `Rate limit exceeded`，带原始 `sessionId`。
- `terminal.resize` 不计入 input 字节限流，input 超限后仍可转发。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-server-mobile-input-byte-rate-limit-design.md`
- `docs/superpowers/plans/2026-05-03-server-mobile-input-byte-rate-limit-plan.md`
- `apps/server/src/config.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/ws.test.ts`

**TDD 记录：**
- Config 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts` 失败，`loadServerConfig()` 缺少 Mobile input byte rate 字段，非法 env 未抛错。
- Config 绿灯：实现 `mobileInputByteRateLimitWindowMs`、`mobileInputByteRateLimitMaxBytes` 和环境变量解析后，config 测试通过。
- Route 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts` 失败，累计 ASCII input、UTF-8 input 和超限后 resize 测试等不到预期限流行为。
- Route 绿灯：接入 `MemoryWeightedRateLimiter` 后，Server 测试通过，101 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，101 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，198 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前仍是丢弃式限流，不是背压；超限 input 会被拒绝。
- 内存限流只在单 Server 进程内生效，多实例云中转需要共享 store。
- IP 级限流可能误伤同 NAT 用户，后续应迁移到账号、设备或 session 维度。

**后续：**
- 将 limiter store 抽象为 Redis/Postgres 可替换实现。
- 增加正式账号/设备维度限流。
- 设计脚本上传和文件传输，减少大输入走 terminal input。

## 2026-05-03 Cloud Relay Deploy And Smoke Runbooks

**状态：** completed

**提交：**
- `5a50590` `docs: add cloud relay deploy and smoke runbooks`

**实现内容：**
- 新增 `docs/runbooks/cloud-relay-dev-deploy.md`，说明 VPS、DNS、TLS、Caddy/Nginx、systemd/pm2、`/health`、WebSocket 和数据目录配置。
- 新增 `docs/runbooks/external-network-smoke-test.md`，说明家里 macOS Agent 连接云中转、iPhone 关闭 Wi-Fi 使用蜂窝网络、配对、执行 `printf "__CELL__%s\n" "$PWD"` 的验收流程。
- README 增加两份 runbook 入口。
- `docs/superpowers/plans/2026-05-02-external-network-cloud-relay-plan.md` 已同步状态：Phase 1 安全边界和 Phase 2 runbook 完成，真实 VPS/蜂窝网验收仍保持未勾选。
- 文档继续强调默认产品路径是云中转，DDNS、端口映射、IPv6 和反向隧道只作为高级自托管选项。

**涉及文件：**
- `README.md`
- `docs/runbooks/cloud-relay-dev-deploy.md`
- `docs/runbooks/external-network-smoke-test.md`
- `docs/superpowers/plans/2026-05-02-external-network-cloud-relay-plan.md`

**验证：**
- `git diff --check`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，198 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前没有真实 VPS 域名、TLS 证书和 iPhone 蜂窝网络环境，因此外网开发验收没有实际执行。
- 当前 JSON store 仍只适合单进程开发 relay，不适合多实例云部署。
- dev token 仍是开发态边界，正式产品需要账号、设备归属和审计。

**后续：**
- 准备真实域名和 VPS 后按 runbook 执行外网蜂窝验收。
- 决定云端持久化方案，优先 SQLite/Postgres，避免多实例 JSON 写入风险。
- 推进 iOS TestFlight 和 macOS Agent 可安装版本。

## 2026-05-03 Terminal Signal Message

**状态：** completed

**提交：**
- `861fb49` `docs: design terminal signal message`
- `01e10ee` `docs: plan terminal signal message`
- `9ed68fc` `feat: route terminal signal messages`

**实现内容：**
- 协议新增 Mobile -> Agent `terminal.signal` client message。
- 支持 `SIGINT` 和 `EOF` 两种 signal。
- Server 将 `terminal.signal` 作为 session-owned routable message 转发给 Agent。
- `terminal.signal` 不计入单条 terminal input size guard，也不计入 Mobile input byte rate limiter。
- Agent `TerminalSession.sendSignal()` 将 `SIGINT` 映射为 PTY `\x03`，将 `EOF` 映射为 PTY `\x04`。
- AgentClient 收到 `terminal.signal` 后路由到对应 `TerminalSession`。
- Mobile `SessionClient.sendTerminalSignal()` 发送 `terminal.signal`。
- Mobile `Ctrl+C` shortcut 改发 `terminal.signal SIGINT`，其他快捷键继续发送 input payload。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-terminal-signal-message-design.md`
- `docs/superpowers/plans/2026-05-03-terminal-signal-message-plan.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- `packages/protocol/src/messages.ts`
- `packages/protocol/tests/messages.test.ts`
- `apps/server/src/sessionHub.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/sessionHub.test.ts`
- `apps/server/tests/ws.test.ts`
- `apps/agent/src/terminalSession.ts`
- `apps/agent/src/agentClient.ts`
- `apps/agent/tests/terminalSession.test.ts`
- `apps/agent/tests/agentClient.test.ts`
- `apps/mobile/src/protocol/sessionClient.ts`
- `apps/mobile/src/components/terminalShortcuts.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/sessionClient.test.ts`
- `apps/mobile/tests/terminalShortcuts.test.ts`

**TDD 记录：**
- Protocol 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test` 失败，`terminal.signal` 不在 client discriminator union 中。
- Protocol 绿灯：加入 `terminal.signal` schema 后，protocol 测试通过，19 tests passed。
- Server 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，Mobile signal 没有转发给 Agent。
- Server 绿灯：接入 `MobileRoutableMessage` 和 `SessionHub.routeFromMobile()` 后，Server 测试通过，104 tests passed。
- Agent 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test` 失败，`sendSignal()` 不存在，AgentClient 未处理 signal。
- Agent 绿灯：实现 PTY 映射和 AgentClient signal 分发后，Agent 测试通过，38 tests passed。
- Mobile 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test` 失败，`sendTerminalSignal()` 不存在，Ctrl+C 仍是 input payload。
- Mobile 绿灯：实现 signal API 和 shortcut action 后，Mobile 测试通过，47 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，208 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前实现仍是 PTY 控制字节映射，不是 OS-level process signal。
- `EOF` 对不同 shell/程序的效果取决于 PTY 前台程序行为。
- 旧客户端仍可通过 `terminal.input` 发送 `\x03`，Server 保持兼容。

**后续：**
- 增加 `terminal.signal` 的 UI/审计语义。
- 继续实现 terminal session recovery 和 snapshot 恢复。
- macOS Agent 桌面壳后续可把 signal 暴露为更明确的控制按钮。

## 2026-05-03 EAS TestFlight Build Config

**状态：** completed

**提交：**
- `8dd0c50` `chore: add eas testflight build config`

**实现内容：**
- 新增 `apps/mobile/eas.json`。
- EAS build profiles 包含 `development`、`preview`、`production`。
- `preview` 和 `production` 后续已改为 release guard 占位 host/token；真实构建必须用 EAS env 覆盖。
- `apps/mobile/app.json` 增加 `ios.bundleIdentifier=com.terminalfirst.remote`、`ios.buildNumber=1`、`ios.supportsTablet=false`。
- 新增 `docs/runbooks/testflight-build.md`，记录 EAS 登录、环境变量、preview build、production build、submit/TestFlight、验收和排障步骤。
- README 增加 TestFlight runbook 入口。
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md` 已同步 Task 12 的已完成项；图标/启动页资产仍未勾选。

**涉及文件：**
- `README.md`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `docs/runbooks/testflight-build.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，47 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo config --type public`: pass，输出包含 `ios.bundleIdentifier` 和 `ios.buildNumber`。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，208 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 尚未创建正式 app icon 和 splash 资产。
- 尚未执行真实 `eas build`、Apple signing、App Store Connect submit 或 TestFlight 安装验收。
- `EXPO_PUBLIC_REMOTE_DEV_TOKEN` 会嵌入客户端包，只能作为内部测试开发边界，不是生产 secret。

**后续：**
- 设计并加入 iOS app icon/splash。
- 使用真实 Apple Developer Team 和 App Store Connect app 执行 EAS build/submit。
- 用 TestFlight App 连接云中转并完成 `__TESTFLIGHT__` 冒烟验收。

## 2026-05-03 Terminal Session Recovery

**状态：** completed

**提交：**
- `deac113` `docs: design terminal session recovery`
- `e582a4a` `docs: plan terminal session recovery`
- `0bce497` `feat: support terminal session recovery`

**实现内容：**
- 协议 `session.open` 增加可选 `resumeSessionId`，用于 Mobile 重连恢复同一会话。
- Server `SessionHub` 支持 detached session rebind，并校验恢复请求的 device/session 归属。
- Mobile WebSocket 断开后，Server 不立即向 Agent 发送 `terminal.close`，而是保留 detached session 5 分钟；超时后发送 `terminal.close` 并删除 session。
- Mobile 恢复成功前，Server 丢弃 detached session 的 Agent 输出，避免向已关闭 socket 写入。
- Agent `TerminalSession` 保存有限输出环形缓冲区，snapshot 包含最近输出、窗口尺寸、alive 和 exitCode。
- AgentClient 收到 `terminal.snapshot.request` 后发送 `terminal.snapshot`。
- Server 支持 Agent -> Mobile 转发 `terminal.snapshot`。
- Mobile `SessionClient` 断线后保留 session id，重连时携带 `resumeSessionId`，收到 `session.opened` 后立即请求 `terminal.snapshot`。
- 用户显式 `close()` 会清除本地 session id，下一次连接创建新 session。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-terminal-session-recovery-design.md`
- `docs/superpowers/plans/2026-05-03-terminal-session-recovery-plan.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- `packages/protocol/src/messages.ts`
- `packages/protocol/tests/messages.test.ts`
- `apps/server/src/sessionHub.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/sessionHub.test.ts`
- `apps/server/tests/ws.test.ts`
- `apps/agent/src/terminalSession.ts`
- `apps/agent/src/agentClient.ts`
- `apps/agent/tests/terminalSession.test.ts`
- `apps/agent/tests/agentClient.test.ts`
- `apps/mobile/src/protocol/sessionClient.ts`
- `apps/mobile/tests/sessionClient.test.ts`

**TDD 记录：**
- Protocol 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test` 失败，`resumeSessionId` 被 strict schema 拒绝。
- Protocol 绿灯：加入 `resumeSessionId` schema 后，protocol 测试通过，20 tests passed。
- Server 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，Mobile close 会关闭 session、resume 不存在、snapshot request 不能路由。
- Server 补充红灯：新增 detached retention timeout 和 Agent snapshot route 测试后，Server 测试失败，超时不发送 `terminal.close`，`terminal.snapshot` 不转发。
- Server 绿灯：实现 rebind、5 分钟 detached cleanup、snapshot request 和 snapshot route 后，Server 测试通过，109 tests passed。
- Agent 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test` 失败，`snapshot()` 不存在，AgentClient 不处理 `terminal.snapshot.request`。
- Agent 绿灯：实现输出缓冲、尺寸/退出状态和 snapshot request handler 后，Agent 测试通过，42 tests passed。
- Mobile 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test` 失败，断线清空 session id，重连不带 `resumeSessionId`，opened 后不请求 snapshot。
- Mobile 绿灯：实现 session id 保留、resume open、opened 后 snapshot request 和 explicit close 清理后，Mobile 测试通过，50 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，221 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 会话恢复状态仍在 Server/Agent 进程内存中，Server 或 Agent 重启会丢失正在运行的 PTY。
- Snapshot 是最近输出 chunk，不是完整终端屏幕模型；光标位置、alternate screen、全屏 TUI 状态后续需要更完整的终端解析或录屏方案。
- 5 分钟 detached retention 由 Server 定时器触发，单进程可用；多实例云中转需要把 session ownership 和 cleanup 迁移到共享状态或固定路由。

**后续：**
- Task 13 实现 iOS 前后台自动重连和手动重连按钮。
- macOS Agent 桌面壳接入运行态 session 状态展示和退出控制。
- 云端化后补充多实例 relay 的 session affinity 与 cleanup 验收。

## 2026-05-03 macOS Agent Desktop Shell

**状态：** completed

**提交：**
- `acb5165` `docs: design macos agent desktop shell`
- `6bffba0` `docs: plan macos agent desktop shell`
- `248818c` `feat: add macos agent desktop shell`

**实现内容：**
- 新增 `apps/agent-desktop` Electron workspace。
- 选择 Electron 作为 macOS Agent 桌面壳，原因是现有 Agent core 是 Node/TypeScript + `node-pty`。
- `apps/agent` 增加 `AgentClient.close()`，desktop 壳可以关闭 WebSocket 和所有本地 PTY session。
- `apps/agent` 增加 subpath exports：`@remote/agent/agentClient`、`@remote/agent/config`、`@remote/agent/pairing`。
- `@remote/protocol` 增加 package exports，供新 workspace 通过包边界导入类型和协议。
- Desktop main process 负责 Electron window、tray/menu、Agent lifecycle 和 pairing callback。
- Desktop preload 暴露受控 IPC API，不向 renderer 暴露 Node 全局能力。
- Renderer 展示设备名称、连接状态、Server URL、Device ID、Shell、终端能力开关、配对二维码和配对码。
- 收到 pairing request 后，renderer 可 Approve 或 Reject，runtime resolve AgentClient 的审批 Promise。
- 菜单栏提供 Show Window、Terminal On/Off、Quit。
- 新增 `docs/runbooks/macos-agent-package.md`，记录本地开发运行、`pack:dir` 目录打包、环境变量和已知风险。
- README 增加 macOS desktop Agent runbook 和本地启动命令。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-macos-agent-desktop-shell-design.md`
- `docs/superpowers/plans/2026-05-03-macos-agent-desktop-shell-plan.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- `apps/agent/package.json`
- `apps/agent/src/agentClient.ts`
- `apps/agent/tests/agentClient.test.ts`
- `packages/protocol/package.json`
- `apps/agent-desktop/package.json`
- `apps/agent-desktop/tsconfig.json`
- `apps/agent-desktop/tsconfig.test.json`
- `apps/agent-desktop/src/agentDesktopRuntime.ts`
- `apps/agent-desktop/src/desktopState.ts`
- `apps/agent-desktop/src/main.ts`
- `apps/agent-desktop/src/preload.ts`
- `apps/agent-desktop/src/renderer/index.html`
- `apps/agent-desktop/src/renderer/app.js`
- `apps/agent-desktop/src/renderer/styles.css`
- `apps/agent-desktop/tests/agentDesktopRuntime.test.ts`
- `apps/agent-desktop/tests/desktopState.test.ts`
- `docs/runbooks/macos-agent-package.md`
- `README.md`
- `pnpm-lock.yaml`

**TDD 记录：**
- Agent 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test` 失败，`AgentClient.close()` 不存在。
- Agent 绿灯：实现 `close()`、socket close guard 和 session cleanup 后，Agent 测试通过，45 tests passed。
- Desktop scaffold checkpoint：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop build` 失败，`tsconfig` 没有 TS 输入，符合 scaffold 阶段预期。
- Desktop state 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test` 失败，`desktopState.ts` 不存在。
- Desktop state 绿灯：实现 `DesktopState` 和纯 update helpers 后，desktop 测试通过，6 tests passed。
- Desktop runtime 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test` 失败，`agentDesktopRuntime.ts` 不存在。
- Desktop runtime 绿灯：实现 Agent lifecycle、pairing QR、approve/reject Promise 后，desktop 测试通过，13 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test`: pass，13 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，237 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop pack:dir`: pass，生成 `dist/mac-arm64/Terminal First Agent.app`，notarization 被跳过。

**已知风险：**
- 当前 Electron app 仍是开发目录包；签名、公证、hardened runtime、entitlements 和正式 `.dmg` 属于 Task 11。
- electron-builder 在本机发现可用签名 identity 时会尝试签名；正式发布必须固定证书和 notarization 配置。
- `node-pty` 是原生模块，正式打包和跨架构发布需要 Electron ABI rebuild 验证。
- 当前没有开机启动、自动更新、日志查看器和持久化 UI 状态。

**后续：**
- Task 11 增加 macOS 签名、公证和正式打包 runbook。
- Task 12 补 iOS icon/splash/version/build number。
- Task 13 接入 iOS 前后台自动重连和手动恢复按钮。

## 2026-05-03 macOS Agent Signing and Notarization

**状态：** completed

**提交：**
- `556c1bf` `docs: design macos agent signing notarization`
- `86168fd` `docs: plan macos agent signing notarization`
- `0a61583` `docs: add macos signing and notarization runbook`

**实现内容：**
- `apps/agent-desktop/package.json` 保持应用 bundle id：`com.terminalfirst.agent`。
- 新增 `dist:mac` 发布命令：`pnpm build && electron-builder --mac`。
- Electron Builder mac target 从开发目录扩展为正式 `dmg` 和 `zip`。
- mac 配置启用 `hardenedRuntime`。
- 新增 `apps/agent-desktop/build/entitlements.mac.plist`。
- mac 配置接入 `entitlements` 和 `entitlementsInherit`。
- mac 配置接入 notarization `teamId`，由 `APPLE_TEAM_ID` 环境变量提供。
- `docs/runbooks/macos-agent-package.md` 扩展 Developer ID Application 证书、App Store Connect API Key、环境变量、正式构建、公证验证和排障说明。
- 主计划 Task 11 已同步勾选。

**涉及文件：**
- `docs/superpowers/specs/2026-05-03-macos-agent-signing-notarization-design.md`
- `docs/superpowers/plans/2026-05-03-macos-agent-signing-notarization-plan.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- `apps/agent-desktop/package.json`
- `apps/agent-desktop/build/entitlements.mac.plist`
- `docs/runbooks/macos-agent-package.md`

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop pack:dir`: pass，生成 macOS app 目录；当前环境没有 Apple notarization credentials，electron-builder 输出 `skipped macOS notarization`。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，237 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**未执行项：**
- 未执行真实 `pnpm --filter @remote/agent-desktop dist:mac` 的 Apple notarization 提交，因为当前机器没有提供 `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER` 和可发布用 Developer ID 凭据。
- 未执行 `spctl` 和 `xcrun stapler validate` 的最终发布验收，因为真实 notarized artifact 尚未生成。

**已知风险：**
- 正式发布必须在有 Developer ID Application 证书和 App Store Connect API Key 的机器或 CI 上执行。
- `node-pty` 原生模块可能在 x64/arm64 不同架构下需要额外 rebuild 和签名验证。
- `disable-library-validation` 是 Electron native module 兼容性权衡，正式安全评审时需要复核。
- 当前尚无 CI secret 管理、证书导入和 notarization 自动化。

**后续：**
- Task 12 补 iOS app icon、splash、version 和 build number。
- 准备 Apple Developer 账号后执行真实 `dist:mac`、`spctl` 和 `stapler` 验收。
- 发布工程阶段补 CI keychain、证书导入和 notarization 自动化。

## 2026-05-03 iOS App Assets and Version Config

**状态：** completed

**提交：**
- `939a052` `docs: design ios app assets version`
- `a480c39` `docs: plan ios app assets version`
- `f5198dd` `chore: add ios app assets and version config`

**实现内容：**
- 新增免费本地生成的 1024 x 1024 PNG 资产：
  - `apps/mobile/assets/icon.png`
  - `apps/mobile/assets/splash-icon.png`
  - `apps/mobile/assets/adaptive-icon.png`
- `apps/mobile/app.json` 增加 `icon`。
- `apps/mobile/app.json` 增加 legacy `splash` 配置。
- `apps/mobile/app.json` 增加 Android adaptive icon 预留。
- `apps/mobile/app.json` 接入 `expo-splash-screen` config plugin。
- `apps/mobile/package.json` 增加 `expo-splash-screen` 依赖。
- `expo.version` 保持 `0.1.0`。
- `expo.ios.buildNumber` 从 `"1"` 提升到 `"2"`。
- `docs/runbooks/testflight-build.md` 补充 version/build number 更新规则、资产路径和 launch screen 缓存注意事项。
- 主计划 Task 12 剩余项已同步勾选。

**验证：**
- `file apps/mobile/assets/icon.png apps/mobile/assets/splash-icon.png apps/mobile/assets/adaptive-icon.png`: pass，均为 `PNG image data, 1024 x 1024`。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，50 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo config --type public`: pass，输出包含 `icon`、`splash`、`ios.buildNumber: "2"` 和 `expo-splash-screen`。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，237 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前资产是 MVP 临时品牌，不是最终 App Store 视觉。
- iOS launch screen 可能被系统缓存，换图后需要卸载旧包再验证。
- Expo Go 不能完整代表 TestFlight standalone launch screen 行为。

**后续：**
- Task 13 实现 iOS 前后台和重连。
- 真正 TestFlight 构建前确认 Apple Developer 中 bundle identifier 和 build number 未冲突。

## 2026-05-03 iOS Background Reconnection

**状态：** completed

**提交：**
- `5692444` `docs: design ios background reconnection`
- `b3048b8` `docs: plan ios background reconnection`
- `2a169ac` `feat: handle mobile background reconnection`

**实现内容：**
- `SessionClient` 增加 `isSocketOpen()` 和 `hasRetainedSession()`。
- `SessionClient` 测试覆盖 socket open state、socket close 后保留 session id、explicit close 后清除 session id。
- `TerminalScreen` 监听 React Native `AppState`。
- App 进入 background/inactive 后不关闭 client，不清除 session id。
- App 后台时阻止命令、快捷键和 signal 主动发送。
- App 回到 active 后，如果 client 持有 retained session 且 socket 未打开，则调用同一个 client `connect()`。
- socket 异常断开后不再调用 `client.close()`，保留同一个 `SessionClient`。
- socket 异常断开后自动重连一次。
- 自动重连失败后展示 `Reconnect` 按钮。
- 手动 Reconnect 优先复用 retained session，触发 `resumeSessionId`。
- 重连成功后沿用 `SessionClient` 已有逻辑发送 `terminal.snapshot.request`。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，52 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，239 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- iOS 后台 WebSocket 是否立即断开由系统决定，App 不能保证后台持续在线。
- 自动重连只做一次，弱网下需要用户点击 Reconnect。
- UI 层仍没有 React Native 组件测试；当前以 `SessionClient` 单元测试和 TypeScript build 覆盖核心恢复机制。

**后续：**
- 云端化后验证 iPhone 蜂窝网络下 background/foreground 恢复。
- 引入 RN 组件测试后补充 AppState UI 自动化覆盖。

## 2026-05-03 Postgres Devices and Bindings Persistence

**状态：** completed

**提交：**
- `2fc4946` `docs: design postgres devices bindings`
- `f3dc31c` `docs: plan postgres devices bindings`
- `264db3f` `feat: persist devices and bindings`

**实现内容：**
- Server 新增 `pg` runtime dependency。
- Server 新增 `pg-mem` 和 `@types/pg` dev dependency。
- 新增 `apps/server/src/persistence/schema.sql`，包含：
  - `users`
  - `devices`
  - `mobile_clients`
  - `device_bindings`
  - `sessions`
- 新增 `apps/server/src/persistence/db.ts`，提供 `Queryable` 边界和 `createPostgresPool()`。
- 新增 `DeviceRepository`：
  - `upsertUser()`
  - `upsertDevice()`
  - `getDevice()`
  - `listDevicesForUser()`
- 新增 `BindingRepository`：
  - `upsertMobileClient()`
  - `createBinding()`
  - `revokeBinding()`
  - `listActiveBindingsForUser()`
- Repository 测试使用 `pg-mem` 执行同一份 `schema.sql`。
- 测试覆盖 device upsert、binding create/revoke、query user device list。
- 主计划 Task 14 已同步勾选。

**验证：**
- Repository 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，`bindingRepository.js` 不存在。
- Repository 绿灯：实现 repository 后，`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` pass，112 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，242 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 当前只新增 schema/repository，现有 WebSocket 和 PairingService 仍使用内存/JSON store。
- `pg-mem` 不是完整 PostgreSQL，云端上线前需要真实 PostgreSQL 验收。
- 尚未加入 migration versioning，后续需要选择迁移工具或自研 migration runner。

**后续：**
- Task 15 抽象在线状态 store，并加入 Redis-backed presence。
- 后续云端化时把 PairingStore 和 SessionTokenStore 迁移到 PostgreSQL repository。

## 2026-05-03 Redis Device Presence

**状态：** completed

**提交：**
- `86e8569` `docs: design redis device presence`
- `5d74261` `docs: plan redis device presence`
- `f1bcf4d` `feat: add redis-backed device presence`

**实现内容：**
- `DeviceRegistry` 新增 `DevicePresenceStore` 抽象。
- 新增 `MemoryDevicePresenceStore`，开发期默认使用内存 presence。
- `DeviceRegistry` 注册设备时写入在线状态，断开时写入离线状态。
- `DeviceRegistry` 新增 `heartbeat()`，心跳会刷新 `lastSeenAt` 和 TTL。
- `DeviceRegistry.get()` 和 `DeviceRegistry.list()` 从 presence store 组合 `online` 与 `lastSeenAt`。
- `/devices` 返回设备时新增 `lastSeenAt` 字段，便于 iOS 端展示最后在线时间。
- 新增 `RedisDevicePresenceStore`，通过注入式 `RedisLike` 客户端写入 Redis key，不直接绑定具体 Redis SDK。
- Redis presence key 默认格式为 `presence:device:{deviceId}`。
- 在线状态使用 Redis `SET ... EX` 写入 TTL；离线状态写入无 TTL 的 offline payload。
- Redis store 对缺失记录、非法 JSON 和非法结构返回 `undefined`。
- 主计划 Task 15 已同步勾选。

**验证：**
- DeviceRegistry 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，`registry.heartbeat is not a function`、TTL 不生效、`MemoryDevicePresenceStore is not a constructor`。
- Redis store 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，`redisPresenceStore.js` 不存在。
- Server 绿灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，119 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，249 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `git diff --check`: pass。

**已知风险：**
- 当前 Redis store 已实现但尚未接入 server runtime 配置；现有运行路径仍默认使用内存 presence。
- 多实例云部署仍需要 WebSocket route affinity 或集中式 session routing；本任务只解决 presence 共享状态。
- Redis TTL 依赖服务端与 Redis 时间行为，云端上线前需要真实 Redis 冒烟测试。

**后续：**
- Task 16 编写云端测试环境 runbook，并配置 PostgreSQL、Redis、HTTPS/WSS。
- 云端 smoke test 时验证 iOS、macOS Agent、server、Redis presence 的完整链路。

## 2026-05-03 Cloud Test Environment

**状态：** partially completed

**提交：**
- `41d4102` `docs: design cloud test environment`
- `4ce000e` `docs: plan cloud test environment`
- `4677b53` `docs: add cloud test environment runbook`
- `f808694` `docs: link cloud test environment from readme`

**实现内容：**
- 新增 `docs/runbooks/cloud-test-environment.md`。
- 第一阶段默认平台选择 Render，VPS + Caddy 作为备用路径。
- runbook 写明 Web Service build/start command。
- runbook 写明公网 server 环境变量：`HOST=0.0.0.0`、`REMOTE_REQUIRE_DEV_TOKEN=1`、`REMOTE_DEV_TOKEN`、`REMOTE_PUBLIC_BASE_URL`、`REMOTE_DATA_DIR`。
- runbook 写明 PostgreSQL/Key Value 准备变量：`DATABASE_URL`、`REDIS_URL`。
- runbook 写明公网 `/health`、未授权 WebSocket、Agent 在线、iPhone 蜂窝网络终端命令的检查步骤。
- runbook 增加云端测试结果模板和阻塞条件。
- README 增加 Cloud Test Environment 入口和 Agent/Mobile 云端启动命令。
- 主计划 Task 16 已勾选：平台选择、HTTPS/WSS 域名配置方案、PostgreSQL/Redis 配置方案、环境变量和启动命令文档。

**验证：**
- `rg "TBD|TODO|待定|以后再" docs/runbooks/cloud-test-environment.md`: pass，无匹配。
- `rg "cloud-test-environment|Cloud Test Environment" README.md docs/runbooks/cloud-test-environment.md`: pass，README 和 runbook 均有入口。
- `git diff --check README.md docs/runbooks/cloud-test-environment.md`: pass。
- `rg "TB[D]|TO[D]O|待[定]|以后[再]" docs/runbooks/cloud-test-environment.md docs/superpowers/plans/2026-05-03-cloud-test-environment-plan.md`: pass，无匹配。
- `git diff --check`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，249 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**未完成真实云端验收：**
- 未执行 TestFlight App 连接云端 server。
- 未执行 macOS Agent 连接云端 server。
- 未执行 `printf "__CLOUD__%s\n" "$PWD"` 真实外网冒烟。

**阻塞原因：**
- 当前会话没有可用 Render 账号、公网 relay host、自定义域名和真机 TestFlight/Expo 云端会话。
- Server runtime 尚未接入 `DATABASE_URL` 和 `REDIS_URL`，云端 runbook 明确要求单实例 relay。

**后续：**
- 准备 Render 账号和 relay host 后，按 `docs/runbooks/cloud-test-environment.md` 执行真实云端 smoke test。
- Task 17 编写 MVP 验收清单，并把真实云端验收结果纳入发布前门禁。

## 2026-05-03 MVP Acceptance Checklist

**状态：** checklist completed, execution blocked

**提交：**
- `72495e2` `docs: design mvp acceptance checklist`
- `81ccc95` `docs: plan mvp acceptance checklist`
- `cabceae` `docs: add mvp acceptance checklist`

**实现内容：**
- 新增 `docs/runbooks/mvp-acceptance.md`。
- 固化 `pass | fail | blocked` 记录规则。
- 增加 LAN simulator、LAN physical iPhone、Cloud cellular iPhone 三类环境矩阵。
- 覆盖首次安装、扫码/手动配对、绑定批准。
- 覆盖未绑定手机拒绝连接。
- 覆盖终端命令：`pwd`、`ls`、`git status`、`npm run dev`。
- 覆盖长命令中断：`ping 127.0.0.1` + `Ctrl+C`。
- 覆盖 iOS 前后台切换与重连。
- 覆盖 Agent 重启后设备身份保持。
- 覆盖 server 重启后绑定关系保持。
- 覆盖 Agent 关闭 terminal capability 后的失败提示。
- 覆盖终端会话页不展示广告。
- 增加发布判定表，明确外部 TestFlight 前云端蜂窝 smoke 必须通过。
- 主计划 Task 17 的 runbook 提交项已同步勾选。

**验证：**
- `rg "TB[D]|TO[D]O|待[定]|以后[再]" docs/runbooks/mvp-acceptance.md`: pass，无匹配。
- `git diff --check docs/runbooks/mvp-acceptance.md`: pass。
- `rg "TB[D]|TO[D]O|待[定]|以后[再]" docs/runbooks/mvp-acceptance.md docs/superpowers/plans/2026-05-03-mvp-acceptance-plan.md`: pass，无匹配。
- `git diff --check`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，249 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**未执行真实验收：**
- 未验证新设备首次安装、扫码、绑定。
- 未验证未绑定手机无法连接。
- 未验证真机终端命令、长命令中断、前后台切换。
- 未验证 Agent/server 重启后的真实持久化。
- 未验证 terminal capability 关闭路径。
- 未验证真机终端会话页广告边界。

**阻塞原因：**
- 当前会话没有真实 TestFlight build、iPhone 真机云端会话、可重启的云端 server 和可切换 capability 的 Agent 配置。
- runbook 已明确这些项必须记录为 `blocked`，不能误标为 `pass`。

**后续：**
- 准备真机、TestFlight 或 Expo 物理机环境后，按 `docs/runbooks/mvp-acceptance.md` 执行验收。
- 为 disabled terminal capability 增加明确 Agent 启动开关，避免该项长期只能人工构造。

## 2026-05-03 Agent Terminal Capability Toggle

**状态：** completed

**提交：**
- `e79d673` `docs: design agent terminal capability toggle`
- `b26680c` `docs: plan agent terminal capability toggle`

**实现内容：**
- Agent config 增加 `REMOTE_ENABLE_TERMINAL=0` 开关。
- Agent 注册时根据 config 发送 `capabilities`，默认仍是 `["terminal"]`。
- `REMOTE_ENABLE_TERMINAL=0` 时注册 `capabilities: []`。
- Server 在 `session.open` 前检查设备是否支持 `terminal`。
- 设备不支持 terminal 时返回 `session.error`：`Device <id> does not support terminal sessions.`。
- `docs/runbooks/mvp-acceptance.md` 的 disabled terminal capability 项改为真实启动命令。

**TDD 证据：**
- Agent 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test` 失败，缺少 `AgentConfig.capabilities`、`REMOTE_ENABLE_TERMINAL` 校验和注册 capabilities。
- Server 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，无 terminal capability 设备仍返回 `session.opened`。
- Agent 绿灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test`: pass，47 tests passed。
- Server 绿灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，120 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，252 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**文档修正：**
- README 本地 smoke 不再使用旧的无 token raw WebSocket probe。
- README 改为要求通过 Mobile pairing panel 配对、Agent 终端批准后再运行 `printf "__PWD__%s\n" "$PWD"`。
- README 明确无 `sessionToken` 的 `session.open` 会按设计被拒绝。

## 2026-05-03 Server Cloud Runtime Config

**状态：** completed

**提交：**
- `cca04c3` `docs: design server cloud runtime config`
- `9d06a2b` `docs: plan server cloud runtime config`

**实现内容：**
- `ServerConfig` 增加 `databaseUrl` 和 `redisUrl`。
- `loadServerConfig()` 读取 `DATABASE_URL` 和 `REDIS_URL`。
- 空字符串归一为 `null`。
- 非法 URL 抛出 `DATABASE_URL must be a valid URL` 或 `REDIS_URL must be a valid URL`。
- `docs/runbooks/cloud-test-environment.md` 更新为：server config 已读取 URL，但业务 store wiring 仍待后续任务完成。

**TDD 证据：**
- 红灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test` 失败，默认 config 缺少 `databaseUrl`/`redisUrl`，显式云端值未读取，非法 URL 未拒绝。
- 绿灯：`PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，121 tests passed。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，253 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。

**已知风险：**
- 本任务只完成 config readiness，尚未把 PostgreSQL/Redis 接入业务 store。

## 2026-05-03 Render 真实 Server 部署入口

**状态：** completed

**提交：**
- `6f20dce` `feat: add render server deploy config`

**实现内容：**
- 新增根目录 `Dockerfile`，使用 Node 22 + Corepack + `pnpm@9.15.0` 构建 `@remote/protocol` 和 `@remote/server`，启动 `node apps/server/dist/index.js`。
- 新增根目录 `.dockerignore`，排除依赖、构建产物、移动端原生工程和本地状态，避免 Render Docker context 过大。
- 新增根目录 `render.yaml`，创建 `remote-terminal-server` Web Service、`remote-terminal-postgres`、`remote-terminal-redis`。
- `render.yaml` 默认开启 `REMOTE_REQUIRE_DEV_TOKEN=1`，由 Render 生成 `REMOTE_DEV_TOKEN`，并把 Postgres/Key Value connection string 注入 `DATABASE_URL`、`REDIS_URL`。
- 更新 `docs/runbooks/cloud-test-environment.md`，补充 Blueprint 部署、本地 Docker 验证边界、Render 构建日志记录和云端 smoke 模板。
- 新增并更新 `docs/superpowers/specs/2026-05-03-render-server-deploy-config-design.md` 与 `docs/superpowers/plans/2026-05-03-render-server-deploy-config-plan.md`。

**涉及文件：**
- `Dockerfile`
- `.dockerignore`
- `render.yaml`
- `docs/runbooks/cloud-test-environment.md`
- `docs/superpowers/specs/2026-05-03-render-server-deploy-config-design.md`
- `docs/superpowers/plans/2026-05-03-render-server-deploy-config-plan.md`
- `docs/superpowers/records/feature-log.md`

**验证：**
- `ruby -e "require 'yaml'; p YAML.load_file('render.yaml').keys"`: pass，输出 `["services", "databases"]`。
- `rg -n "TO[D]O|TB[D]|填[入]|占[位]" docs/runbooks/cloud-test-environment.md docs/superpowers/specs/2026-05-03-render-server-deploy-config-design.md docs/superpowers/plans/2026-05-03-render-server-deploy-config-plan.md`: pass，无输出。
- `git diff --check`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test`: pass，121 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，253 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `command -v docker`: not found；本机未执行 `docker build`，不能标记镜像本地构建通过。

**已知风险：**
- 还没有在 Render 账号里实际 Apply Blueprint，也没有真实公网 relay host。
- Docker 镜像构建需要由 Render 构建日志确认，或后续在安装 Docker 的机器上执行本地构建。
- Server 业务 store 还没有全部接入 PostgreSQL/Redis，云端仍必须保持单实例。
- 真实 iPhone 蜂窝网络 `__CLOUD__` smoke 尚未执行。

**后续：**
- 在 Render 创建 Blueprint，记录 `remote-terminal-server` 的服务 URL、生成的 `REMOTE_DEV_TOKEN` 和构建日志。
- 用 macOS Agent 连接 `wss://<relay-host>/ws/agent`，iPhone 连接 `wss://<relay-host>/ws/mobile`，执行 `printf "__CLOUD__%s\n" "$PWD"`。
- 后续继续推进 PostgreSQL/Redis 业务 store wiring、TestFlight、macOS 签名公证和断线恢复。

## 2026-05-03 iOS 移动端 UI 与模拟器/真机验证

**状态：** completed

**提交：**
- `3c33e56` `docs: plan mobile ui simulator validation`
- `6aa450b` `feat: refine mobile terminal ui`

**实现内容：**
- Mobile 从整屏深色界面改为浅色运维工作台，保留深色终端窗口，降低真机“黑屏”感知。
- 新增 `mobileShellTheme.ts`，集中管理移动端颜色、终端字体和短状态文案。
- `app.json` splash 和 adaptive icon 背景从 `#101214` 改为 `#f4f0e7`。
- 已配对后配对面板折叠为 `Mac Ready` 状态和 `Forget` 操作，不再持续展示配对码输入框。
- 增加开发态自动配对和自动连接配置：`EXPO_PUBLIC_REMOTE_AUTO_PAIRING_CODE`、`EXPO_PUBLIC_REMOTE_AUTOCONNECT`、`EXPO_PUBLIC_REMOTE_SMOKE_COMMAND`。
- Agent 增加开发态 `REMOTE_AUTO_APPROVE_PAIRING=1`，仅用于模拟器/真机 smoke，默认关闭。
- 修复自动配对码存在且 SecureStore 已恢复 token 时不会自动连接的问题。
- 修复 `RedisDevicePresenceStore` 测试时间依赖，避免写死时间过期后全仓测试失败。
- 修复 Agent/Desktop 测试夹具缺少 `autoApprovePairing` 字段导致的 typecheck 失败。

**涉及文件：**
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/src/components/mobileShellTheme.ts`
- `apps/mobile/src/config/runtimeConfig.ts`
- `apps/mobile/app.json`
- `apps/mobile/package.json`
- `apps/mobile/tests/mobileShellTheme.test.ts`
- `apps/mobile/tests/runtimeConfig.test.ts`
- `apps/agent/src/config.ts`
- `apps/agent/src/agentClient.ts`
- `apps/agent/tests/config.test.ts`
- `apps/agent/tests/agentClient.test.ts`
- `apps/agent-desktop/tests/agentDesktopRuntime.test.ts`
- `apps/agent-desktop/tests/desktopState.test.ts`
- `apps/server/tests/presence/redisPresenceStore.test.ts`
- `docs/superpowers/specs/2026-05-03-ios-mobile-ui-simulator-validation-design.md`
- `docs/superpowers/plans/2026-05-03-ios-mobile-ui-simulator-validation-plan.md`

**TDD 记录：**
- UI 主题红灯：`pnpm --filter @remote/mobile test -- mobileShellTheme.test.ts` 失败，原因是 `mobileShellTheme.ts` 不存在。
- UI 主题绿灯：新增主题后 Mobile 测试通过。
- 自动配对配置红灯：runtime config 测试失败，原因是 `autoPairingCode` 未读取。
- Agent 自动批准红灯：Agent config 测试失败，原因是 `autoApprovePairing` 未读取且非法值未拒绝。
- 已配对折叠红灯：`getPairingPanelMode` 不存在。
- 恢复 token 自动连接红灯：`shouldAutoConnectTerminal` 不存在。
- 验证阶段红灯：全仓测试发现 Redis presence 测试依赖当前时间；typecheck 发现 Agent/Desktop 测试夹具缺字段。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，256 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `git diff --check`: pass，无输出。
- iOS 模拟器截图：`/tmp/remote-terminal-ui-reconnected.png`，浅色 App 外壳、已配对面板折叠、状态为 `Online`。
- iOS 模拟器端到端 smoke：Server + Agent + Metro + App，终端输出包含 `__SIM_UI__/Users/hejianglong`。
- 真机安装：`devicectl` 确认 `Remote Terminal com.terminalfirst.remote 0.1.0 (2)` 已安装到设备 `long`。
- 真机启动：`devicectl device process launch` 成功，进程列表包含 `/RemoteTerminal.app/RemoteTerminal`。

**已知风险：**
- 当前真机只能通过 `devicectl` 验证安装、启动和进程；现有工具不能对物理 iPhone 自动点击或截图，UI 视觉确认需要用户在真机上观察。
- `apps/mobile/ios/` 是 Expo 生成的原生工程，本次未提交；后续如果要稳定真机构建和 TestFlight，需要单独决定是否纳入仓库。
- 开发态自动批准配对只适用于 smoke，不得作为正式安全策略。
- 真机当前仍是本地/局域网开发构建，不是 TestFlight。

**后续：**
- 用户在真机上确认新 UI 不再是整屏黑色后，继续做真实公网 server。
- 按 `docs/runbooks/cloud-test-environment.md` 在 Render 创建 Blueprint，记录公网 URL 和 `REMOTE_DEV_TOKEN`。
- 用真机蜂窝网络连接云 relay，执行 `printf "__CLOUD__%s\n" "$PWD"`。
- 后续推进 TestFlight、macOS 签名公证、Postgres/Redis 业务 store wiring 和发布前验收。

## 2026-05-03 Release Placeholder Guard And Deployment Status

**状态：** completed

**提交：**
- `7f77f60` `feat: guard release placeholder config`

**实现内容：**
- Mobile 支持 `EXPO_PUBLIC_REMOTE_RELAY_HOST`，自动推导 `wss://<host>/ws/mobile` 和 `https://<host>`。
- Mobile release 模式 `EXPO_PUBLIC_REMOTE_RELEASE=1` 会拒绝 `api.example.com`、`.example.invalid`、`<relay-host>` 等占位 host。
- Mobile release 模式要求 `EXPO_PUBLIC_REMOTE_DEV_TOKEN` 存在，并拒绝 `replace-with-render-dev-token` 这类占位 token。
- Server 支持 `REMOTE_RELAY_HOST`，自动推导 `REMOTE_PUBLIC_BASE_URL=https://<host>`。
- Server release 模式 `REMOTE_RELEASE=1` 要求 `REMOTE_REQUIRE_DEV_TOKEN=1`。
- Server release 模式拒绝占位公网 host。
- Render Blueprint 默认开启 `REMOTE_RELEASE=1`，避免公网服务误以裸奔模式运行。
- 新增 `GET /deployment/status`，用于云端验证公网 base URL、dev token guard 和当前 store 模式；响应不泄露 token。
- EAS `preview`/`production` 改为占位 host/token 配置；真实构建必须用 EAS env 覆盖。

**涉及文件：**
- `apps/mobile/src/config/runtimeConfig.ts`
- `apps/mobile/tests/runtimeConfig.test.ts`
- `apps/mobile/eas.json`
- `apps/server/src/config.ts`
- `apps/server/src/ws.ts`
- `apps/server/tests/config.test.ts`
- `apps/server/tests/ws.test.ts`
- `render.yaml`
- `docs/runbooks/testflight-build.md`
- `docs/runbooks/cloud-test-environment.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`

**TDD 记录：**
- Mobile 红灯：`runtimeConfig.test.ts` 失败，原因是 relay host 未推导、release 占位 host 未拒绝、release token 未强制。
- Server 红灯：`config.test.ts` 失败，原因是 `REMOTE_RELAY_HOST` 未推导、release 占位 host 和未启用 token guard 未拒绝。
- Server 红灯：`ws.test.ts` 失败，原因是 `/deployment/status` 404。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- runtimeConfig.test.ts`: pass，59 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- config.test.ts`: pass，138 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- ws.test.ts`: pass，125 tests passed。

**已知风险：**
- `/deployment/status` 明确报告当前 store 模式；本阶段仍是单实例优先，不宣称多实例云端完成。
- 真实 Render host、`REMOTE_DEV_TOKEN`、Apple/EAS 凭据必须由部署环境注入，仓库只保留占位值。

**后续：**
- Render Web Service 创建后设置 `REMOTE_RELAY_HOST=<render-host>` 并 redeploy。
- EAS production/preview 环境设置 `EXPO_PUBLIC_REMOTE_RELAY_HOST=<render-host>` 和真实 `EXPO_PUBLIC_REMOTE_DEV_TOKEN`。
- 执行云端蜂窝 smoke，并把结果记录到 MVP acceptance。

## 2026-05-03 TestFlight Relay Placeholder Runbook Cleanup

**状态：** completed

**实现内容：**
- 将 TestFlight runbook 中默认移动端 relay 路径改为 `wss://${REMOTE_RELAY_HOST}/ws/mobile`。
- 将 TestFlight 验收中的 macOS Agent relay 路径改为 `wss://${REMOTE_RELAY_HOST}/ws/agent`。
- 保留 `api.example.com`、`remote-terminal.example.invalid` 和 `<relay-host>` 作为 release guard 拒绝示例，避免把示例地址误当成可用公网地址。

**涉及文件：**
- `docs/runbooks/testflight-build.md`
- `docs/superpowers/records/feature-log.md`

**验证：**
- `rg -n "api\\.example\\.com|wss://\\$\\{REMOTE_RELAY_HOST\\}|remote-terminal\\.example\\.invalid|<relay-host>" docs/runbooks/testflight-build.md apps/mobile/eas.json` 确认操作步骤使用 `${REMOTE_RELAY_HOST}`，占位符只保留在说明和默认占位配置中。

## 2026-05-03 Release Readiness Audit Docs

**状态：** completed

**实现内容：**
- 新增 `docs/runbooks/release-readiness-audit.md`，列出已实现功能、占位符策略、剩余发布阻塞项和验证命令。
- README 增加发布就绪审查入口。
- 主 MVP 计划增加 2026-05-03 当前状态，明确剩余 12 项都依赖真实外部环境或人工验收。
- 外网冒烟手册和自托管云中转手册统一使用 `<relay-host>` / `${REMOTE_RELAY_HOST}`，避免把 `api.example.com` 写成默认操作地址。

**涉及文件：**
- `README.md`
- `docs/runbooks/release-readiness-audit.md`
- `docs/runbooks/external-network-smoke-test.md`
- `docs/runbooks/cloud-relay-dev-deploy.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- `docs/superpowers/records/feature-log.md`

**验证：**
- `git diff --check`: pass，无输出。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，265 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `rg -n 'api\\.example\\.com|wss://api\\.example\\.com|https://api\\.example\\.com' docs/runbooks README.md apps/mobile/eas.json render.yaml` 确认操作手册中 `api.example.com` 只保留为 release guard 拒绝示例或可选自定义域名示例。

## 2026-05-03 iOS Client Minimal UI Polish

**状态：** completed

**实现内容：**
- 新增 iOS 客户端极简 UI 设计记录和执行计划。
- Mobile 主题从偏米色工具风格调整为浅色中性背景、白色面板、深石墨终端区和 Apple 蓝主动作。
- 新增布局 token：header、panel radius、terminal radius、input height、shortcut height 和水平边距。
- `TerminalScreen` 标题从 `Remote Terminal` 收敛为 `Terminal`。
- 已配对面板压缩为单行 `Mac / <device> · Ready / Forget`，减少对终端区域的占用。
- 终端输出区保留为唯一大面积深色区域，避免真机整屏黑。
- 快捷键 rail 和底部输入区使用更轻的边框、更稳定的高度和更清晰的 `Run` 主动作。

**涉及文件：**
- `apps/mobile/src/components/mobileShellTheme.ts`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/tests/mobileShellTheme.test.ts`
- `docs/superpowers/specs/2026-05-03-ios-client-minimal-ui-design.md`
- `docs/superpowers/plans/2026-05-03-ios-client-minimal-ui-plan.md`

**TDD 记录：**
- 红灯：`mobileShellTheme.test.ts` 失败，原因是主题仍为旧背景 `#f4f0e7`，且没有 `layout` token。
- 绿灯：加入极简 iOS 主题和布局 token 后，Mobile 主题测试通过。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- mobileShellTheme.test.ts`: pass，61 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，61 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，267 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `git diff --check`: pass，无输出。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: build succeeded，开发构建已安装并打开。
- iOS 模拟器截图：`/tmp/remote-terminal-minimal-ui-final.png`，确认新 UI 为浅色背景、蓝色主按钮、紧凑配对区、终端区域为唯一大面积深色面。

**已知风险：**
- 本次是模拟器视觉验证；真机视觉仍需要用户在物理 iPhone 上确认。

## 2026-05-03 iOS Home Connection List

**状态：** completed

**实现内容：**
- 新增 iOS 首页连接列表设计和执行计划。
- App 启动后先进入 `HomeScreen`，不再直接进入终端页。
- 首页显示保存的连接数量、已保存设备列表和 `New Connection` 空状态。
- 新增 `NewConnectionScreen`，承接配对码输入、等待 Mac Agent 审批和配对成功回调。
- `TerminalScreen` 改为接收选中的 `deviceId + sessionToken`，不再用 `runtimeConfig.deviceId` 作为唯一目标。
- `TerminalScreen` 增加返回首页入口，离开终端页时由组件卸载关闭当前 session client。
- 本地 SecureStore 配对 token 从单设备升级为多设备列表，并兼容旧单 token 数据迁移。
- 忘记设备时移除对应设备 token 并回到首页。

**涉及文件：**
- `apps/mobile/App.tsx`
- `apps/mobile/src/components/HomeScreen.tsx`
- `apps/mobile/src/components/NewConnectionScreen.tsx`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/src/state/pairingTokenStore.ts`
- `apps/mobile/tests/pairingTokenStore.test.ts`
- `docs/superpowers/specs/2026-05-03-ios-home-connection-list-design.md`
- `docs/superpowers/plans/2026-05-03-ios-home-connection-list-plan.md`

**TDD 记录：**
- 红灯：`pairingTokenStore.test.ts` 失败，原因是 `loadPairingTokens`、`upsertPairingToken`、`removePairingToken` 尚不存在。
- 绿灯：实现多设备 token 存储、旧单 token 迁移和按设备删除后，移动端存储测试通过。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- pairingTokenStore.test.ts`: pass，64 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，64 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，270 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: build succeeded，开发构建已安装并打开。
- iOS 模拟器截图：`/tmp/remote-terminal-home-list.png`，确认默认首页为连接列表空状态和 `New Connection`，不再直达终端页。

**已知风险：**
- 本轮截图验证了首页默认入口；由于模拟器当前没有真实配对设备，已保存设备列表和点击进入终端仍需要真机或完整配对 smoke 再验收。

## 2026-05-03 iOS Home Populated List Polish

**状态：** completed

**实现内容：**
- 首页有连接时不再只是普通行，改为连接卡片：设备名、状态、配对/过期摘要、`Terminal` 能力和 `Open` 入口。
- 新增 `homeConnectionList` 纯逻辑模块，将首页列表的 `Ready` / `Expired` 状态、摘要文案和开发预览连接从 UI 中拆出。
- 新增 `EXPO_PUBLIC_REMOTE_DEMO_CONNECTIONS=1` 显式开发预览开关；release 模式 `EXPO_PUBLIC_REMOTE_RELEASE=1` 下不会启用预览连接。
- 模拟器可以看到有数据的连接列表态，避免只验证空状态。

**涉及文件：**
- `apps/mobile/App.tsx`
- `apps/mobile/src/components/HomeScreen.tsx`
- `apps/mobile/src/state/homeConnectionList.ts`
- `apps/mobile/tests/homeConnectionList.test.ts`
- `docs/superpowers/records/feature-log.md`

**TDD 记录：**
- 红灯：`homeConnectionList.test.ts` 失败，原因是 `homeConnectionList` 模块不存在。
- 绿灯：实现列表 item 构建、过期状态判断、开发预览开关和预览连接后，移动端测试通过。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- homeConnectionList.test.ts`: pass，68 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，68 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，274 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `EXPO_PUBLIC_REMOTE_DEMO_CONNECTIONS=1 PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: build succeeded，开发构建已安装并打开。
- iOS 模拟器截图：`/tmp/remote-terminal-home-list-populated.png`，确认首页显示 2 个连接卡片、Ready 状态和 Open 入口。

**已知风险：**
- 预览连接只用于 UI 验证，不能代表真实 Agent 在线状态；真实连接列表仍需要配对后由 SecureStore token 填充。

## 2026-05-03 iOS Home Live Device Status

**状态：** completed

**实现前方案：**
- 复用服务端已有 `GET /devices`，不新增服务端协议。
- 手机端新增只读 `DeviceStatusClient`，负责拉取 Agent 注册设备的 `online`、`deviceName`、`lastSeenAt` 和能力列表。
- 首页列表继续以 SecureStore 中已保存的配对 token 为主；服务端状态只做增强展示，不决定本地连接是否存在。
- 如果服务端在线状态获取失败，保留本地连接列表，并显示 `Online status unavailable. You can still open terminal.`，不阻塞用户进入终端。

**实现内容：**
- 新增 `apps/mobile/src/protocol/deviceStatusClient.ts`，解析 `/devices` 响应并在配置 dev token 时附带 `Authorization`。
- `App.tsx` 在刷新本地连接后拉取服务端设备状态，成功时合并到首页，失败时清空在线状态并设置不可用提示。
- `homeConnectionList` 支持服务端状态 lookup：未过期 token 有服务端状态时显示 `Online` / `Offline`，过期 token 仍优先显示 `Expired`。
- `HomeScreen` 增加不可用提示条，并为 `Offline` 状态使用灰色状态胶囊。

**涉及文件：**
- `apps/mobile/App.tsx`
- `apps/mobile/src/components/HomeScreen.tsx`
- `apps/mobile/src/protocol/deviceStatusClient.ts`
- `apps/mobile/src/state/homeConnectionList.ts`
- `apps/mobile/tests/deviceStatusClient.test.ts`
- `apps/mobile/tests/homeConnectionList.test.ts`
- `docs/superpowers/records/feature-log.md`

**TDD 记录：**
- 红灯：`deviceStatusClient.test.ts` 失败，原因是 `deviceStatusClient` 模块不存在。
- 红灯：`homeConnectionList.test.ts` 失败，原因是 `buildDeviceStatusLookup`、`getOnlineStatusNotice` 不存在。
- 绿灯：实现设备状态客户端、状态 lookup、Online/Offline 合并和不可用提示后，移动端相关测试通过。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- homeConnectionList.test.ts deviceStatusClient.test.ts`: pass，73 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，73 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，279 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `EXPO_PUBLIC_REMOTE_DEMO_CONNECTIONS=1 PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: build succeeded，开发构建已安装并打开。
- iOS 模拟器截图：`/tmp/remote-terminal-home-live-status-notice.png`，确认服务端不可用时显示在线状态提示，连接列表仍可见。

**已知风险：**
- 当前 `/devices` 是全局注册设备列表，手机端只按本地保存的 `deviceId` 合并显示；后续多用户云端化后应切换为用户绑定设备列表或服务端过滤后的绑定视图。
- 在线状态只在首页刷新时获取一次，暂未做后台轮询或 App 回到前台自动刷新。

## 2026-05-03 iOS Startup Config Crash Fix

**状态：** completed

**问题现象：**
- 真机/模拟器在 `EXPO_PUBLIC_REMOTE_RELEASE=1` 且缺少 `EXPO_PUBLIC_REMOTE_DEV_TOKEN` 时无法打开 App。
- 复现日志显示异常发生在根组件 `App`：`EXPO_PUBLIC_REMOTE_DEV_TOKEN is required when EXPO_PUBLIC_REMOTE_RELEASE=1`。

**根因：**
- 上一轮在线状态接入把 `loadMobileRuntimeConfig()` 提前到 `App.tsx` 根组件。
- release 配置校验原本用于连接/配对动作，但被根组件调用后变成启动硬依赖，导致首页也无法渲染。

**实现内容：**
- 新增 `tryLoadMobileRuntimeConfig()`，页面可拿到 `{ ok: false, error }` 并显示文案，而不是抛异常。
- 新增 `homeDeviceStatus` 模块，首页在线状态客户端创建失败时返回 `null`，只降级为状态不可用提示。
- `App.tsx` 不再直接调用 release-sensitive 配置加载。
- `NewConnectionScreen` 配置不完整时显示错误文案并禁用 Pair 按钮。
- `TerminalScreen` 配置不完整时显示连接错误文案，不再因进入页面崩溃。

**涉及文件：**
- `apps/mobile/App.tsx`
- `apps/mobile/src/config/runtimeConfig.ts`
- `apps/mobile/src/components/NewConnectionScreen.tsx`
- `apps/mobile/src/components/TerminalScreen.tsx`
- `apps/mobile/src/state/homeDeviceStatus.ts`
- `apps/mobile/tests/homeDeviceStatus.test.ts`
- `apps/mobile/tests/runtimeConfig.test.ts`
- `docs/superpowers/records/feature-log.md`

**TDD 记录：**
- 红灯：`homeDeviceStatus.test.ts` 失败，原因是 `homeDeviceStatus` 模块不存在。
- 红灯：`runtimeConfig.test.ts` 失败，原因是 `tryLoadMobileRuntimeConfig` 不存在。
- 绿灯：实现可降级首页状态客户端和安全配置加载后，专项测试通过。

**验证：**
- `EXPO_PUBLIC_REMOTE_RELEASE=1 PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: 复现崩溃，日志指向 `App` 根组件。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- homeDeviceStatus.test.ts`: pass，74 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- runtimeConfig.test.ts homeDeviceStatus.test.ts`: pass，75 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，75 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，281 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- `EXPO_PUBLIC_REMOTE_RELEASE=1 EXPO_PUBLIC_REMOTE_DEMO_CONNECTIONS=1 PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: build succeeded，首页已打开，无根组件配置异常。
- `EXPO_PUBLIC_REMOTE_RELEASE=1 PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: build succeeded，首页已打开，无根组件配置异常。
- iOS 模拟器截图：`/tmp/remote-terminal-release-home-fixed.png`，确认 release 配置不完整时首页可打开。

## 2026-05-03 iOS Process Env Startup Crash Fix

**状态：** completed

**问题现象：**
- 用户反馈真机“直接崩溃”，模拟器开发构建不稳定复现。

**根因：**
- 移动端多个函数默认参数直接写了 `env = process.env`。
- React Native 真机/非开发运行时不能假设存在 Node 风格 `process` 全局；一旦 `process` 不存在，函数调用阶段会先执行默认参数表达式并抛 `ReferenceError` / `TypeError`，页面来不及降级。

**实现内容：**
- `runtimeConfig`、`homeConnectionList`、`homeDeviceStatus` 都改为通过 `globalThis.process?.env ?? {}` 安全读取环境变量。
- 移除移动端源码中直接 `process.env` 默认参数入口。
- 增加无 `process` 全局的回归测试，覆盖首页状态、运行时配置和开发预览连接判断。

**涉及文件：**
- `apps/mobile/src/config/runtimeConfig.ts`
- `apps/mobile/src/state/homeConnectionList.ts`
- `apps/mobile/src/state/homeDeviceStatus.ts`
- `apps/mobile/tests/runtimeConfig.test.ts`
- `apps/mobile/tests/homeConnectionList.test.ts`
- `apps/mobile/tests/homeDeviceStatus.test.ts`
- `docs/superpowers/records/feature-log.md`

**TDD 记录：**
- 红灯：将测试里的 `globalThis.process` stub 为 `undefined` 后，`tryLoadMobileRuntimeConfig()`、`createOptionalHomeDeviceStatusClient()`、`shouldUseDevelopmentPreviewConnections()` 均因读取 `process.env` 失败。
- 绿灯：实现安全 env 读取后，专项测试通过。

**验证：**
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- runtimeConfig.test.ts homeDeviceStatus.test.ts homeConnectionList.test.ts`: pass，78 tests passed。
- `rg "process\\.env|= process\\.env" apps/mobile/src apps/mobile/tests -n`: pass，无匹配。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`: pass，78 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck`: pass。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`: pass，284 tests passed。
- `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`: pass。
- 清理 Metro 缓存、卸载模拟器旧 App 后执行 `EXPO_PUBLIC_REMOTE_RELEASE=1 PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo run:ios --device "iPhone 15"`: build succeeded，首页可打开。
- iOS 模拟器截图：`/tmp/remote-terminal-no-process-env-fixed.png`。
