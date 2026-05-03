# Server Agent Output Rate Limit Design

## 背景

Agent 已经会把大块 terminal output 拆成较小 chunk，避免单条 WebSocket message 过大。但如果 Agent 异常或被替换，仍可能快速发送大量 `terminal.output`，导致 Server 和 Mobile 被高频输出淹没。

本功能在 Server 侧增加 Agent output 消息数限流，继续采用免费内存固定窗口方案，复用已有 `MemoryRateLimiter`。

## 目标

- 限制 `/ws/agent` 中 `terminal.output` 的消息频率。
- 超限 output 不转发给 Mobile。
- 超限时 Server 向 Agent 返回 `session.error`，带原始 `sessionId`。
- `terminal.exit` 不计入 output 限流，避免退出消息被丢。
- 默认配置足够宽，不影响正常终端输出。

## 非目标

- 不实现真正背压队列。
- 不限制输出字节总量。
- 不关闭 Agent socket。
- 不改变 Agent/Mobile 协议。
- 不做分布式限流。

## 配置

`ServerConfig` 增加：

```ts
agentOutputRateLimitWindowMs: number;
agentOutputRateLimitMaxMessages: number;
```

环境变量：

```bash
REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS=10000
REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX=1000
```

默认值：

- `agentOutputRateLimitWindowMs = 10_000`
- `agentOutputRateLimitMaxMessages = 1000`

配置校验：

- 窗口必须是大于等于 1000 的整数。
- 最大消息数必须是正整数。

## 限流 Key

使用：

```text
ws.agent.output:<deviceId>
```

原因：

- Agent 注册后才能发送 terminal output，`deviceId` 已可用。
- 同一设备重连后共享 Server 进程内额度，避免简单重连绕过。
- 不按 sessionId 限流，避免一个 Agent 多 session 时绕开设备级保护。

## 路由行为

在 `/ws/agent` 中，解析出 `terminal.output` 后：

1. 确认 message 是 Agent routable message。
2. 如果是 `terminal.output`，检查 limiter。
3. 超限时抛出 `Rate limit exceeded`。
4. catch 发送 `session.error` 给 Agent，带 `sessionId`。
5. 未超限时调用 `hub.routeFromAgent()`。

`terminal.exit` 直接路由，不计入 limiter。

## 测试策略

### 配置测试

更新 `apps/server/tests/config.test.ts`：

- 默认配置包含 `agentOutputRateLimitWindowMs: 10000`、`agentOutputRateLimitMaxMessages: 1000`。
- 环境变量能覆盖默认值。
- 非数字、过短窗口、非正最大值会抛错。

### Route 测试

更新 `apps/server/tests/ws.test.ts`：

- 用 `agentOutputRateLimitMaxMessages: 1` 启动 Server。
- 打开真实 Agent/Mobile session。
- 第一条 `terminal.output` 转发给 Mobile。
- 第二条 `terminal.output` 返回 `session.error` 给 Agent，Mobile 不收到。
- 验证 `terminal.exit` 在 output 超限后仍能转发给 Mobile。

## 验收标准

- Server 支持 Agent output rate limit 配置。
- 超限 `terminal.output` 不转发给 Mobile。
- 超限错误返回 Agent，包含 `sessionId`。
- `terminal.exit` 不受 output rate limit 影响。
- `pnpm --filter @remote/server test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 这是丢弃式限流，不是背压；超限输出会丢失。
- 内存限流只对单 Server 进程有效。
- 只按消息数，不按字节数统计。

## 后续

- 增加 Agent output 背压队列。
- 增加输出字节速率限制。
- 多实例云中转迁移到共享 limiter store。
