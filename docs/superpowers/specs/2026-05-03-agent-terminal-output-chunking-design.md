# Agent Terminal Output Chunking Design

## 背景

Server 已经有 `REMOTE_WS_RAW_MESSAGE_MAX_BYTES`，默认拒绝超过 64 KiB 的单条 WebSocket raw message。Agent 当前把 PTY `onData` 回调里的字符串原样封装成一条 `terminal.output` 发送。如果某次 PTY 输出 chunk 很大，就可能触发 Server raw message guard，导致正常输出被拒绝。

本功能在 Agent 侧做免费、轻量的输出分块，不改变协议，不引入新依赖。

## 目标

- Agent 将大块 terminal output 拆成多条 `terminal.output` 消息发送。
- 默认 chunk 大小显著低于 Server raw message limit。
- 按 UTF-8 字节数分块，避免中文等多字节字符被切坏。
- 保持 `sessionId`、`stream` 和消息顺序。
- 不影响小输出和现有 terminal 输入流程。

## 非目标

- 不实现 Agent output 背压。
- 不限制单位时间总输出量。
- 不改变 `terminal.output` 协议结构。
- 不做 stdout/stderr 分离；当前 Agent 仍只发送 `stdout`。
- 不实现文件下载或日志流专用通道。

## 配置

`AgentConfig` 增加：

```ts
terminalOutputChunkBytes: number;
```

环境变量：

```bash
REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES=16384
```

默认值：

- `terminalOutputChunkBytes = 16_384`

选择 16 KiB 的原因：

- 小于 Server raw message 64 KiB 默认值，给 JSON envelope 留出足够空间。
- 对终端 UI 来说 16 KiB 一条已经足够大。
- 不需要额外服务或依赖。

配置校验：

- 必须是正整数。
- `0`、负数、非数字启动配置解析失败。

## 分块算法

新增 helper：

```ts
function splitUtf8ByBytes(input: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const char of input) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (current.length > 0 && currentBytes + charBytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }

    current += char;
    currentBytes += charBytes;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
```

说明：

- `for...of` 按 Unicode code point 迭代，不会切开 surrogate pair。
- 如果单个字符字节数大于 `maxBytes`，仍作为单独 chunk 发送；由于配置最小值为 1，这种情况只会发生在极小测试配置中。

## AgentClient 行为

当前：

```ts
session.onOutput((data) => {
  this.sendMessage({
    type: "terminal.output",
    sessionId: message.sessionId,
    stream: "stdout",
    data
  });
});
```

改为：

```ts
for (const chunk of splitUtf8ByBytes(data, this.config.terminalOutputChunkBytes)) {
  this.sendMessage({
    type: "terminal.output",
    sessionId: message.sessionId,
    stream: "stdout",
    data: chunk
  });
}
```

如果 session 已 stale，仍保持现有保护，不发送任何 chunk。

## 测试策略

### 配置测试

更新 `apps/agent/tests/config.test.ts`：

- 默认配置包含 `terminalOutputChunkBytes: 16384`。
- `REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES` 可覆盖。
- `0` 和非数字抛出 `REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES must be a positive integer`。

### AgentClient 测试

更新 `apps/agent/tests/agentClient.test.ts`：

- 小输出仍发送一条 `terminal.output`。
- 配置 `terminalOutputChunkBytes: 4`，输出 `"abcdef"` 发送两条：`"abcd"`、`"ef"`。
- 配置 `terminalOutputChunkBytes: 4`，输出 `"你好"` 发送两条：`"你"`、`"好"`，证明按 UTF-8 字节不切坏字符。
- stale session 时仍不发送 output。

## 验收标准

- Agent 支持 `REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES`。
- 大 terminal output 会拆成多条有序 `terminal.output`。
- UTF-8 多字节字符不会被切坏。
- 默认配置下现有 Agent 测试不受影响。
- `pnpm --filter @remote/agent test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 只做分块，不做背压；Agent 仍可能快速发送大量 chunk。
- 单个字符超过 chunk 限制时仍会作为单独 chunk 发送。
- JSON envelope 会增加额外字节；默认 16 KiB 已预留空间，但用户如果把 chunk 配到接近 Server raw limit，仍可能触发 Server guard。

## 后续

- 增加 Agent output 背压和发送队列上限。
- 增加 Server 对 Agent output 的消息数/字节速率限制。
- 后续文件/日志输出走专用传输通道。
