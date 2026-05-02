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
