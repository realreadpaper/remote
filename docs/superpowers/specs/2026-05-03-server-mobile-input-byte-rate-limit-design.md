# Server Mobile Input Byte Rate Limit Design

## 背景

Mobile terminal input 现在已有两层保护：

- 单条 `terminal.input.data` 默认 16 KiB 上限。
- `/ws/mobile` terminal 消息数限流。

但客户端仍可能发送多条接近 16 KiB 的 input，在窗口内累计大量字节进入 Agent/PTY。需要在 Server 侧补充累计字节速率限制。

## 目标

- 限制 `/ws/mobile` 中 `terminal.input.data` 的累计 UTF-8 字节速率。
- 超限 input 不转发给 Agent。
- 超限时 Server 向 Mobile 返回 `session.error`，带原始 `sessionId`。
- `terminal.resize` 不计入字节限流。
- 默认配置足够宽，不影响正常命令和中等粘贴。

## 非目标

- 不做背压队列。
- 不限制 Agent output；已由 Agent output byte rate limit 处理。
- 不改变协议格式。
- 不做分布式限流。

## 配置

`ServerConfig` 增加：

```ts
mobileInputByteRateLimitWindowMs: number;
mobileInputByteRateLimitMaxBytes: number;
```

环境变量：

```bash
REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS=10000
REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX=262144
```

默认值：

- `mobileInputByteRateLimitWindowMs = 10_000`
- `mobileInputByteRateLimitMaxBytes = 262_144`

即每客户端 10 秒 256 KiB。普通命令输入和中等粘贴远低于这个值。

配置校验：

- 窗口必须是大于等于 1000 的整数。
- 最大字节数必须是正整数。

## 限流 Key

使用：

```text
ws.mobile.input.bytes:<clientKey>
```

`clientKey` 复用现有 `clientKey(request)`：

1. `x-forwarded-for` 第一个 IP。
2. `request.ip`。
3. `unknown`。

## 路由行为

在 `/ws/mobile` 中：

1. parse message。
2. `session.open` 不计入。
3. 只对 `terminal.input` 计算 `Buffer.byteLength(message.data, "utf8")`。
4. 先执行单条 input size guard。
5. 再执行 message count limiter。
6. 再执行 input byte rate limiter。
7. 任一超限则返回 `session.error`，不调用 `hub.routeFromMobile()`。

## 测试策略

### 配置测试

更新 `apps/server/tests/config.test.ts`：

- 默认配置包含 `mobileInputByteRateLimitWindowMs: 10000`、`mobileInputByteRateLimitMaxBytes: 262144`。
- 环境变量能覆盖默认值。
- 非数字、过短窗口、非正最大值会抛错。

### Route 测试

更新 `apps/server/tests/ws.test.ts`：

- 用 `mobileInputByteRateLimitMaxBytes: 4` 启动 Server。
- 第一条 input `"abcd"` 转发给 Agent。
- 第二条 input `"e"` 被拒绝，Mobile 收到 `Rate limit exceeded`，Agent 不收到。
- UTF-8 字节数测试：`"你好"` 在 4 字节上限下被拒绝。
- `terminal.resize` 在 input 字节超限后仍可转发给 Agent。

## 验收标准

- Server 支持 Mobile input 字节速率配置。
- 超限 input 不转发给 Agent。
- 超限错误返回 Mobile，并带 `sessionId`。
- UTF-8 字节数统计正确。
- `terminal.resize` 不受 input byte limiter 影响。
- `pnpm --filter @remote/server test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 当前仍是丢弃式限流，不是背压。
- 内存限流只对单 Server 进程有效。
- IP 级限流可能误伤同 NAT 用户。

## 后续

- 抽象 limiter store，支持 Redis/Postgres。
- 增加正式账号/设备维度限流。
- 设计脚本上传和文件传输，减少大输入走 terminal input。
