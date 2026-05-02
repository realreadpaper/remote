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
