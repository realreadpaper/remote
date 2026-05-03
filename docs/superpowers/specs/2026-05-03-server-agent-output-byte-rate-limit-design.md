# Server Agent Output Byte Rate Limit Design

## 背景

Server 已经对 Agent `terminal.output` 做了消息数限流，但消息数不能覆盖所有风险。异常 Agent 可以用较少数量的大 output chunk 消耗 Server/Mobile 带宽和内存。Agent 端已有输出分块，但 Server 仍需要按字节速率做最后一道保护。

本功能继续使用免费方案：新增一个按权重计数的内存固定窗口 limiter，专门统计 `terminal.output.data` 的 UTF-8 字节数。

## 目标

- 限制 `/ws/agent` 中 `terminal.output.data` 的字节速率。
- 超限 output 不转发给 Mobile。
- 超限时 Server 向 Agent 返回 `session.error`，带原始 `sessionId`。
- `terminal.exit` 不计入字节限流。
- 默认配置足够宽，不影响正常终端输出。

## 非目标

- 不实现背压队列。
- 不限制 Mobile input 字节累计；这会单独处理。
- 不做分布式共享限流。
- 不改变协议格式。

## 配置

`ServerConfig` 增加：

```ts
agentOutputByteRateLimitWindowMs: number;
agentOutputByteRateLimitMaxBytes: number;
```

环境变量：

```bash
REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS=10000
REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX=1048576
```

默认值：

- `agentOutputByteRateLimitWindowMs = 10_000`
- `agentOutputByteRateLimitMaxBytes = 1_048_576`

即每设备 10 秒 1 MiB。正常交互式终端远低于这个值，大量输出会被保护。

配置校验：

- 窗口必须是大于等于 1000 的整数。
- 最大字节数必须是正整数。

## Limiter 设计

新增 `MemoryWeightedRateLimiter`，与现有 `MemoryRateLimiter` 放在 `apps/server/src/rateLimit.ts`：

```ts
export interface WeightedRateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export class MemoryWeightedRateLimiter {
  constructor(options: RateLimitOptions);
  check(key: string, weight: number): WeightedRateLimitResult;
}
```

行为：

- 同一 key 在窗口内累计 weight。
- `used + weight <= maxRequests` 时允许。
- 超过时拒绝，不增加 used。
- weight 小于 1 时按 1 处理，避免 0 weight 绕过。

这里复用 `RateLimitOptions.maxRequests` 作为最大权重，避免引入重复 option 类型。

## 路由行为

在 `/ws/agent` 中：

1. 解析 `terminal.output`。
2. 先检查消息数限流。
3. 再检查字节限流，weight 为 `Buffer.byteLength(message.data, "utf8")`。
4. 任一超限则返回 `session.error`，不调用 `hub.routeFromAgent()`。
5. `terminal.exit` 直接路由，不计入消息数和字节数。

限流 key：

```text
ws.agent.output.bytes:<deviceId>
```

## 测试策略

### 单元测试

更新 `apps/server/tests/rateLimit.test.ts`：

- 累计 weight 未超过上限时允许。
- 超过上限时拒绝且不增加 used。
- 窗口过期后重新允许。
- 不同 key 独立。

### 配置测试

更新 `apps/server/tests/config.test.ts`：

- 默认配置包含 `agentOutputByteRateLimitWindowMs: 10000`、`agentOutputByteRateLimitMaxBytes: 1048576`。
- 环境变量能覆盖默认值。
- 非数字、过短窗口、非正最大值会抛错。

### Route 测试

更新 `apps/server/tests/ws.test.ts`：

- 用 `agentOutputByteRateLimitMaxBytes: 4` 启动 Server。
- 第一条 output `"abcd"` 转发给 Mobile。
- 第二条 output `"e"` 被拒绝，Agent 收到 `Rate limit exceeded`。
- UTF-8 字节数测试：`"你好"` 在 4 字节上限下被拒绝。
- `terminal.exit` 在字节超限后仍转发。

## 验收标准

- Server 支持 Agent output 字节速率配置。
- 超限 output 不转发给 Mobile。
- 超限错误返回 Agent，并带 `sessionId`。
- UTF-8 字节数统计正确。
- `pnpm --filter @remote/server test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 这是丢弃式限流，不是背压。
- 内存限流只对单 Server 进程有效。
- 单条 output 的 raw message 大小仍由 raw guard 保护，字节速率限制发生在 parse 后。

## 后续

- 增加 Agent output 背压队列。
- 将限流 store 抽象为可替换 Redis/Postgres 实现。
- 增加 Mobile input 累计字节限流。
