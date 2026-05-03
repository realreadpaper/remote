# macOS Agent Desktop 本地运行与打包

本 runbook 覆盖 Task 10 的本地 Electron 桌面壳。签名、公证、Developer ID、正式 `.dmg` 发布属于 Task 11。

## 前置条件

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
```

## 环境变量

- `REMOTE_SERVER_URL`：Agent relay WebSocket 地址，默认 `ws://127.0.0.1:8787/ws/agent`。
- `REMOTE_DEVICE_NAME`：桌面壳展示和上报的设备名称，默认 macOS hostname。
- `REMOTE_DEV_TOKEN`：开发 relay token；只用于内部测试。
- `SHELL`：PTY shell，默认 `/bin/zsh`。

## 本地开发运行

先启动 Server：

```bash
pnpm dev:server
```

启动 Electron 桌面 Agent：

```bash
REMOTE_DEVICE_NAME="MacBook Pro" pnpm --filter @remote/agent-desktop dev
```

预期：

- 主窗口显示设备名、Server、Device ID、Shell。
- 菜单栏出现 Terminal First Agent 状态入口。
- Agent 注册后显示 pairing code 和二维码。
- 终端能力开关关闭时，Agent WebSocket 和本地 PTY 会被关闭。

## 本地目录打包

当前只生成未签名的本地 app 目录，用于开发检查：

```bash
pnpm --filter @remote/agent-desktop pack:dir
```

输出位于 `apps/agent-desktop/dist` 和 electron-builder 的输出目录。正式 `.dmg`、签名、公证和 Apple Developer ID 配置在 Task 11 完成。

## 验证命令

```bash
pnpm --filter @remote/agent-desktop test
pnpm --filter @remote/agent-desktop typecheck
pnpm --filter @remote/agent-desktop build
```

全仓库验证：

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 已知风险

- `node-pty` 是原生模块，Electron 正式打包可能需要针对 Electron ABI rebuild。
- 当前未配置 hardened runtime、entitlements、Developer ID 和 notarization。
- 当前没有开机启动、自动更新和日志查看器。
- 未签名 app 在部分 macOS 环境会被 Gatekeeper 拦截，只能作为开发包使用。
