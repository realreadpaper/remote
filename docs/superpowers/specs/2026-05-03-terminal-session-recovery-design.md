# Terminal Session Recovery Design

## 背景

当前 Mobile WebSocket 断开时，Server 会调用 `SessionHub.closeMobile()`，向 Agent 发送 `terminal.close` 并删除 session。这样一旦 iOS App 后台、网络抖动或 WebSocket 重连，远端 PTY 会立即丢失，用户无法回到原来的终端上下文。

协议里已经有 `terminal.snapshot.request` 和 `terminal.snapshot`，但缺少三件事：

- Mobile 重新连接时如何声明“我要恢复旧 session”。
- Server 如何把新 Mobile socket 重新绑定到旧 session。
- Agent 如何保留 PTY 和最近输出，并按需返回 snapshot。

## 目标

- Mobile 断线后，Agent 保留 PTY 5 分钟。
- Agent 为每个 session 保留有限输出环形缓冲。
- Mobile reconnect 时可恢复旧 `sessionId`。
- Mobile reconnect 后请求 `terminal.snapshot`，恢复最近输出。
- Server 验证恢复请求仍属于同一 device/session 后再转发。

## 非目标

- 不实现跨 Server 进程 session recovery。
- 不持久化 PTY 或 snapshot 到磁盘。
- 不实现后台自动重连策略；这属于后续 iOS 前后台任务。
- 不保证所有全屏 TUI 应用完美恢复，只恢复最近文本输出和 session 存活状态。

## 协议变更

`session.open` 增加可选字段：

```ts
resumeSessionId?: string
```

语义：

- 没有 `resumeSessionId`：创建新 session，保持现有行为。
- 有 `resumeSessionId`：Server 查找旧 session，并把当前 Mobile socket 重新绑定到旧 session；不创建新 PTY。
- 恢复成功仍返回 `session.opened`，`sessionId` 等于 `resumeSessionId`。

已有消息继续使用：

```ts
terminal.snapshot.request
terminal.snapshot
```

## Server 设计

`SessionHub` 调整：

- `SessionRecord.mobileSend` 改成可更新。
- `openSession()` 接收可选 `resumeSessionId`。
- `resumeSession()` 验证：
  - session 存在。
  - session device 与请求 device 一致。
  - Agent 当前在线。
- 恢复成功时：
  - 更新 `mobileSend` 为当前 socket。
  - 不向 Agent 发送 `session.opened`。
  - 返回原 session id。
- `closeMobile()` 不再向 Agent 发送 `terminal.close`，只把对应 session 的 `mobileSend` 清空。
- `routeFromAgent()` 在没有 mobile owner 时忽略 output，但保留 session；`terminal.exit` 删除 session。
- `routeFromMobile()` 对需要 Mobile ownership 的消息仍做校验。
- `terminal.snapshot.request` 加入 Mobile routable message，由 Server 转发给 Agent。

## Agent 设计

`TerminalSession` 增加 snapshot 能力：

- 保存最近输出片段，默认最多 200 条。
- 保存当前 `cols`、`rows`，默认 100 x 30。
- 保存 `alive` 和 `exitCode`。
- output 只在 `onOutput()` 内进入 buffer。
- `resize()` 更新 cols/rows。
- `snapshot(deviceId)` 返回 `terminal.snapshot`。

`AgentClient` 调整：

- Mobile close 不再立即收到 `terminal.close`，但如果收到仍关闭 PTY。
- 收到 `terminal.snapshot.request` 后，查找 session 并发送 `terminal.snapshot`。
- Agent socket 自身断开时仍关闭所有 PTY，避免 Agent 进程离线后本地资源泄漏。

## Mobile 设计

`SessionClient` 调整：

- `connect()` 如果已有 `sessionId`，发送带 `resumeSessionId` 的 `session.open`。
- WebSocket close/error 不清空 `sessionId`，只清空 socket。
- 收到 `session.opened` 后，保存 `sessionId` 并发送 `terminal.snapshot.request`。
- `close()` 表示用户主动关闭 client，本地清空 `sessionId`。

`TerminalScreen` 当前仍只在用户点击 Connect 时连接；自动后台重连在后续 Task 13 实现。

## 测试策略

### Protocol

- `session.open` 可解析 `resumeSessionId`。

### Server

- `closeMobile()` 后不发送 `terminal.close`。
- Mobile 使用 `resumeSessionId` 可以恢复旧 session，并且不通知 Agent 创建新 PTY。
- 恢复后的 `terminal.snapshot.request` 转发给 Agent。
- 错误 device 的恢复请求失败。

### Agent

- `TerminalSession` 记录输出环形缓冲。
- `TerminalSession.snapshot()` 返回 output、alive、exitCode、cols、rows。
- `AgentClient` 收到 snapshot request 后发送 `terminal.snapshot`。

### Mobile

- reconnect 时发送 `session.open` 带 `resumeSessionId`。
- 收到恢复后的 `session.opened` 后发送 `terminal.snapshot.request`。
- socket close 后仍保留 session id，用户可再次 `connect()` 恢复。

## 验收标准

- 断线后 Server 不再立即关闭 Agent PTY。
- Mobile reconnect 能恢复同一 `sessionId`。
- Mobile reconnect 后会请求 snapshot。
- Snapshot 包含最近输出。
- `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 5 分钟保留依赖 Agent 进程内存；Agent 断开或进程退出仍会丢失 PTY。
- Server 进程重启会丢失 session ownership，无法恢复旧 PTY。
- 当前 snapshot 是文本片段，不是完整终端屏幕状态。
