# Agent Terminal Capability Toggle Design

## 1. 目标

为发布前验收补一个可复现能力：macOS Agent 可以在本地关闭 `terminal` capability。关闭后，Mobile 尝试打开终端时必须失败，并显示明确原因。

## 2. 范围

本任务交付：

- Agent 环境变量开关：`REMOTE_ENABLE_TERMINAL=0`。
- Agent 注册设备时根据配置发送 `capabilities`。
- Server 在 `session.open` 前检查设备是否包含 `terminal` capability。
- 无 terminal capability 时返回 `session.error`，不向 Agent 发送 `session.opened`。
- 测试覆盖 Agent 配置、Agent 注册消息、Server session rejection。

本任务不交付：

- Mobile 新 UI。
- 文件/桌面 capability 开关。
- 运行时热切换 capability。

## 3. 行为设计

默认行为保持不变：

```bash
pnpm dev:agent
```

Agent 注册：

```json
{
  "type": "device.register",
  "capabilities": ["terminal"]
}
```

关闭终端能力：

```bash
REMOTE_ENABLE_TERMINAL=0 pnpm dev:agent
```

Agent 注册：

```json
{
  "type": "device.register",
  "capabilities": []
}
```

Mobile 打开会话时，Server 返回：

```json
{
  "type": "session.error",
  "code": "SESSION_ERROR",
  "message": "Device home-mac does not support terminal sessions."
}
```

## 4. 验收

- `REMOTE_ENABLE_TERMINAL` 未设置时，现有终端链路不变。
- `REMOTE_ENABLE_TERMINAL=0` 时，Agent 不创建 PTY。
- Server 拒绝无 terminal capability 的设备会话。
- Mobile 通过已有 `session.error` 处理显示失败原因。
