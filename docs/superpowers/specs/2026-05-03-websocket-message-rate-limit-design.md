# WebSocket Message Rate Limit Design

## 背景

HTTP pairing/revoke 已经有 dev token guard 和基础 rate limit。外网默认云中转还需要保护 WebSocket 数据面，尤其是 Mobile 到 Agent 的 terminal 操作：

- `terminal.input` 会直接进入远程终端，相当于用户在服务器输入命令。
- `terminal.resize` 会影响终端 PTY 状态。
- 如果 Mobile 客户端异常、token 泄漏或脚本化刷 WebSocket，Server 当前会持续转发消息到 Agent。

本设计继续采用免费方案：复用单进程内存固定窗口限流，不引入 Redis、云服务或付费组件。

## 目标

- 限制 `/ws/mobile` 中 `terminal.input` 和 `terminal.resize` 消息频率。
- 正常手机输入、粘贴和窗口调整不应触发默认限流。
- 超限时 Server 向 Mobile 返回 `session.error`，不关闭 WebSocket。
- 不改变 Agent 与 Mobile 的现有消息协议。
- 继续保持 iOS 模拟器本地链路可用。

## 非目标

- 不限制 Agent 到 Mobile 的 `terminal.output`。
- 不做流量字节数限制。
- 不实现分布式 WebSocket 限流。
- 不实现账号级、设备级、session token 级复杂策略。
- 不改变 `SessionHub` 路由语义。

## 推荐方案

复用 `MemoryRateLimiter`，在 `registerWsRoutes()` 内创建一个 WebSocket message limiter：

```ts
const wsMessageRateLimiter = new MemoryRateLimiter({
  windowMs: config.wsMessageRateLimitWindowMs,
  maxRequests: config.wsMessageRateLimitMaxRequests
});
```

在 `/ws/mobile` handler 中：

1. 解析 WebSocket 消息。
2. 如果消息是 `session.open`，保持现有逻辑，不计入 terminal 消息限流。
3. 如果消息不是 `terminal.input` 或 `terminal.resize`，保持现有错误逻辑。
4. 如果消息是 terminal routable message，先检查 rate limit。
5. 超限时返回 `session.error`，包含原始 `sessionId`。
6. 未超限时调用 `hub.routeFromMobile()`。

## 配置

`ServerConfig` 增加：

```ts
wsMessageRateLimitWindowMs: number;
wsMessageRateLimitMaxRequests: number;
```

环境变量：

```bash
REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS=10000
REMOTE_WS_MESSAGE_RATE_LIMIT_MAX=200
```

默认值：

- `wsMessageRateLimitWindowMs = 10_000`
- `wsMessageRateLimitMaxRequests = 200`

默认值说明：

- 手机键盘逐字符输入和偶发 resize 远低于 200 条/10 秒。
- 粘贴通常应作为较少数量的大字符串消息发送，而不是每字符单独刷 1000 条。
- 200 条/10 秒能挡住明显异常刷消息，同时不影响日常命令输入。

配置校验：

- 窗口必须是大于等于 1000 的整数。
- 最大请求数必须是正整数。
- 错误信息沿用 HTTP rate limit 配置风格。

## 限流 Key

使用：

```text
ws.mobile.messages:<clientKey>
```

`clientKey` 复用 HTTP rate limit 的来源解析：

1. `x-forwarded-for` 第一个 IP。
2. `request.ip`。
3. `unknown`。

这样同一客户端开多个 WebSocket 也共享额度，避免通过重连绕开每 socket 限流。代价是同一 NAT 出口下多个用户会共享额度，MVP 阶段可接受。

## 超限响应

返回给 Mobile：

```json
{
  "type": "session.error",
  "code": "SESSION_ERROR",
  "message": "Rate limit exceeded",
  "sessionId": "<original-session-id>"
}
```

不关闭 WebSocket，原因：

- 用户可以等待窗口恢复后继续使用。
- Mobile 现有错误处理已经能显示 `session.error`。
- 关闭连接会导致用户误以为设备离线，交互成本更高。

## 测试策略

### 配置测试

更新 `apps/server/tests/config.test.ts`：

- 默认配置包含 `wsMessageRateLimitWindowMs: 10000`、`wsMessageRateLimitMaxRequests: 200`。
- 环境变量能覆盖默认值。
- 非数字、过短窗口、非正最大值会抛错。

### WebSocket route 测试

更新 `apps/server/tests/ws.test.ts`：

- 用低额度配置打开真实 Agent/Mobile session。
- 发送第 1 条 `terminal.input`，Agent 收到。
- 发送第 2 条 `terminal.input`，Mobile 收到 `session.error: Rate limit exceeded`，Agent 不收到第二条。
- 验证不同 `x-forwarded-for` 的 Mobile 不共享额度。
- 验证 `session.open` 不消耗 terminal message 限流额度。

### 复用测试

`MemoryRateLimiter` 已有单元测试，不为 WebSocket 单独重复算法测试。

## 验收标准

- Server 支持 `REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS` 和 `REMOTE_WS_MESSAGE_RATE_LIMIT_MAX`。
- 默认配置下，现有 Mobile/Agent terminal 流程不受影响。
- 超限 terminal 消息不会转发给 Agent。
- 超限时 Mobile 收到带 `sessionId` 的 `session.error`。
- `pnpm --filter @remote/server test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 内存限流只对单进程生效，多实例云中转需要共享 store。
- IP 级 WebSocket 限流可能误伤同一 NAT 出口下的多个用户。
- 当前没有按字节数限制大粘贴，超大 `data` payload 仍需后续保护。
- Agent 到 Mobile 的输出洪泛还未限制。

## 后续

- 增加 terminal input 字节数限制。
- 增加 Agent output 背压和输出限速。
- 多实例云中转时把 WebSocket 限流迁移到 Redis/Postgres。
