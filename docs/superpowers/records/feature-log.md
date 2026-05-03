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
