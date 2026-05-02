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
