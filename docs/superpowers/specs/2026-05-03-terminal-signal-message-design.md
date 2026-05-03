# Terminal Signal Message Design

## 背景

Mobile 现在通过 `terminal.input` 发送 `Ctrl+C` 的原始字节 `\x03`。这能让 PTY 收到中断，但协议层无法区分“用户输入了一个控制字符”和“用户执行了终端信号动作”。后续做按钮、审计、恢复、桌面壳和不同平台 Agent 时，需要把信号动作明确表达出来。

## 目标

- 新增 `terminal.signal` client message。
- Mobile 点击 `Ctrl+C` 时发送 `terminal.signal`，而不是把 `\x03` 当普通 input 发送。
- Server 只做会话归属校验和转发，不解释信号。
- Agent 把 `SIGINT` 转成 PTY `\x03`。
- 预留 `EOF`，Agent 转成 PTY `\x04`。
- 保持现有 `terminal.input` 可继续接收普通文本和其他快捷键字节。

## 非目标

- 不实现 `terminal.signal` 的审计日志。
- 不实现跨平台原生进程信号发送。
- 不改变 `terminal.close` 语义。
- 不做断线恢复或 snapshot。

## 协议

`ClientMessageSchema` 增加：

```ts
message({
  type: z.literal("terminal.signal"),
  sessionId: z.string().min(1),
  signal: z.enum(["SIGINT", "EOF"])
})
```

语义：

- `SIGINT`：用户请求中断当前前台命令，Agent 写入 `\x03`。
- `EOF`：用户请求发送 EOF，Agent 写入 `\x04`。

## Server 路由

`terminal.signal` 加入 Mobile -> Agent 可路由消息：

- `SessionHub.routeFromMobile()` 接收 `terminal.input`、`terminal.resize`、`terminal.signal`。
- `/ws/mobile` 对 `terminal.signal` 执行 session ownership 校验和 WebSocket message rate limit。
- `terminal.signal` 不计入 `terminalInputMaxBytes`。
- `terminal.signal` 不计入 Mobile input byte rate limiter。

## Agent 处理

`TerminalSession` 增加：

```ts
sendSignal(signal: "SIGINT" | "EOF"): void
```

实现先保持 PTY 字节映射：

```ts
SIGINT -> "\x03"
EOF -> "\x04"
```

`AgentClient` 收到 `terminal.signal` 后调用当前 session 的 `sendSignal()`。未知 session 继续忽略，保持现有 input/resize 行为。

## Mobile 行为

`SessionClient` 增加：

```ts
sendTerminalSignal(signal: "SIGINT" | "EOF"): void
```

`TerminalScreen` 的 `Ctrl+C` 按钮调用 `sendTerminalSignal("SIGINT")`。其他快捷键继续通过 `sendTerminalInput()` 发送字节：

- `Tab -> "\t"`
- `Esc -> "\x1b"`
- 方向键 -> ANSI sequence

## 测试策略

### Protocol

- 解析合法 `terminal.signal`。
- 拒绝缺少 `signal`。
- 拒绝未知 signal。

### Server

- Mobile 发送 `terminal.signal` 后，Agent 收到同一 `sessionId` 和 `signal`。
- 未知 session 返回 `session.error`。
- `terminal.signal` 不被 input byte limiter 拦截。

### Agent

- Agent 收到 `terminal.signal SIGINT` 后，写入 PTY `\x03`。
- Agent 收到 `terminal.signal EOF` 后，写入 PTY `\x04`。

### Mobile

- `SessionClient.sendTerminalSignal("SIGINT")` 发送 `terminal.signal`。
- 未打开 session 时调用 signal 抛出明确错误。
- `Ctrl+C` shortcut 映射为 signal action，其他快捷键仍是 input action。

## 验收标准

- `Ctrl+C` 通过 `terminal.signal` 走完整链路。
- Agent PTY 仍收到 `\x03`，用户体验不退化。
- `terminal.signal` 不触发 input byte rate limiter。
- `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 当前仍是 PTY 字节映射，不是 OS-level signal。
- 不同 Shell/程序对 `\x04` 的响应不同，EOF 只作为协议预留和基础 PTY 行为支持。
- 旧客户端仍可能通过 `terminal.input` 发送 `\x03`，Server 继续兼容。
