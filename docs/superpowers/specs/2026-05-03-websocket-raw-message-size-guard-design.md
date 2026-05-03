# WebSocket Raw Message Size Guard Design

## 背景

Server 已经限制了 Mobile terminal message 数量和单条 `terminal.input.data` 字节数。但这些校验都发生在 `JSON.parse()` 和协议解析之后。如果客户端发送一个超大的 WebSocket frame，Server 仍会先把它交给 `JSON.parse()`，可能造成解析前内存和 CPU 压力。

本功能继续使用免费方案：在 Server 收到 WebSocket `RawData` 后、调用 `JSON.parse()` 前做字节数检查。

## 目标

- 限制 `/ws/agent` 和 `/ws/mobile` 的单条 WebSocket raw message 大小。
- 在 JSON parse 前拒绝超大 frame。
- 默认值允许正常协议消息、terminal input 和中等 terminal output。
- 超限时返回 `session.error`，不转发、不进入业务逻辑。
- 不改变协议 schema 和客户端正常使用方式。

## 非目标

- 不限制 HTTP body 大小。
- 不限制累计 WebSocket 流量。
- 不实现压缩包或分片重组。
- 不改变 Agent 输出分块策略。
- 不替代后续 Agent output 背压。

## 配置

`ServerConfig` 增加：

```ts
wsRawMessageMaxBytes: number;
```

环境变量：

```bash
REMOTE_WS_RAW_MESSAGE_MAX_BYTES=65536
```

默认值：

- `wsRawMessageMaxBytes = 65_536`

选择 64 KiB 的原因：

- `terminal.input.data` 默认只有 16 KiB 上限，加上 JSON envelope 后远小于 64 KiB。
- 普通 `terminal.output` chunk 通常较小，64 KiB 能覆盖正常输出 chunk。
- 明显异常的大 frame 会在 parse 前被挡住。

配置校验：

- 必须是正整数。
- 小于 1 时启动失败。

## 实现方案

把现有：

```ts
function parseJson(data: RawData): unknown {
  return JSON.parse(data.toString());
}
```

改为：

```ts
function parseJson(data: RawData, maxBytes: number): unknown {
  const byteLength = rawDataByteLength(data);
  if (byteLength > maxBytes) {
    throw new Error(`WebSocket message exceeds ${maxBytes} bytes`);
  }

  return JSON.parse(data.toString());
}
```

新增：

```ts
function rawDataByteLength(data: RawData): number {
  if (typeof data === "string") {
    return Buffer.byteLength(data, "utf8");
  }

  if (Array.isArray(data)) {
    return data.reduce((total, chunk) => total + chunk.byteLength, 0);
  }

  return data.byteLength;
}
```

`/ws/agent` 和 `/ws/mobile` 的 message handler 都传入 `config.wsRawMessageMaxBytes`。

## 错误响应

超限时发送：

```json
{
  "type": "session.error",
  "code": "SESSION_ERROR",
  "message": "WebSocket message exceeds 65536 bytes"
}
```

Mobile 如果消息里本来有 `sessionId`，但 raw frame 超限时不会 parse JSON，因此无法安全提取 `sessionId`。这是设计取舍：保护 parse 前资源优先于提取上下文。

## 测试策略

### 配置测试

更新 `apps/server/tests/config.test.ts`：

- 默认配置包含 `wsRawMessageMaxBytes: 65536`。
- `REMOTE_WS_RAW_MESSAGE_MAX_BYTES` 可覆盖默认值。
- `0` 和非数字抛出 `REMOTE_WS_RAW_MESSAGE_MAX_BYTES must be a positive integer`。

### Route 测试

更新 `apps/server/tests/ws.test.ts`：

- 用 `wsRawMessageMaxBytes: 8` 启动测试 Server。
- Mobile 发送长度超过 8 字节的 raw string，收到 `session.error`。
- Agent 发送长度超过 8 字节的 raw string，收到 `session.error`。
- 再保留现有正常 Agent/Mobile terminal 流程，证明默认值不影响正常使用。

## 验收标准

- Server 支持 `REMOTE_WS_RAW_MESSAGE_MAX_BYTES`。
- 超大 raw WebSocket message 在 JSON parse 前被拒绝。
- Agent 和 Mobile 两个 WebSocket 入口都受保护。
- 默认配置下现有 iOS/Mobile/Agent 流程不受影响。
- `pnpm --filter @remote/server test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- WebSocket 库仍会先接收 frame 到进程内存；本功能保护应用层 parse 和路由，不是网络层最大帧限制。
- 64 KiB 可能截断极端大 terminal output chunk，后续应在 Agent 端做输出分块和背压。
- 超限 raw frame 无法提取 `sessionId`。

## 后续

- 在 Agent 端增加 terminal output 分块上限。
- 增加 Agent output 背压和限速。
- 评估 WebSocket server 层 `maxPayload` 配置。
