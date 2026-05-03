# Terminal Input Size Limit Design

## 背景

Mobile WebSocket terminal 消息已经有按消息数的 rate limit，但还没有限制单条 `terminal.input.data` 的大小。攻击者或异常客户端可以低频发送超大字符串，绕开消息数限流并造成：

- Server JSON 解析和路由内存压力。
- Agent WebSocket 接收压力。
- PTY 输入异常，影响远程终端可用性。

本功能继续采用免费方案：在 Server 内做同步字节数校验，不引入额外依赖。

## 目标

- 限制单条 `terminal.input.data` 的 UTF-8 字节数。
- 默认允许正常命令输入和中等粘贴。
- 超限时返回 `session.error`，不转发给 Agent，不关闭 WebSocket。
- 不改变协议 schema，不影响 `terminal.resize`。

## 非目标

- 不限制 WebSocket frame 原始大小。
- 不限制 Agent 到 Mobile 的输出大小。
- 不实现按时间窗口累计字节数限流。
- 不做文件上传或剪贴板专用通道。

## 配置

`ServerConfig` 增加：

```ts
terminalInputMaxBytes: number;
```

环境变量：

```bash
REMOTE_TERMINAL_INPUT_MAX_BYTES=16384
```

默认值：

- `terminalInputMaxBytes = 16_384`

选择 16 KiB 的原因：

- 普通命令通常只有几十到几百字节。
- 手机端粘贴多行命令、短脚本仍可通过。
- 超大脚本、文件内容或二进制数据不应该走 terminal input；后续应通过文件功能或专用上传通道。

配置校验：

- 必须是正整数。
- 小于 1 时启动失败。

## 校验位置

在 `/ws/mobile` 中：

1. parse JSON。
2. parse `ClientMessage`。
3. 处理 `session.open`。
4. 校验是否为 `terminal.input` 或 `terminal.resize`。
5. 如果是 `terminal.input`，检查 `Buffer.byteLength(message.data, "utf8")`。
6. 超限则抛出错误，现有 catch 发送 `session.error`。
7. 未超限再做 message rate limit 和 `hub.routeFromMobile()`。

顺序选择：

- 先做单条大小限制，再做消息数限流。
- 超大消息不消耗正常消息额度，便于用户修正后继续输入。

## 错误响应

超限时返回：

```json
{
  "type": "session.error",
  "code": "SESSION_ERROR",
  "message": "Terminal input exceeds 16384 bytes",
  "sessionId": "<original-session-id>"
}
```

## 测试策略

### 配置测试

更新 `apps/server/tests/config.test.ts`：

- 默认配置包含 `terminalInputMaxBytes: 16384`。
- `REMOTE_TERMINAL_INPUT_MAX_BYTES` 可覆盖默认值。
- `0` 和非数字抛出 `REMOTE_TERMINAL_INPUT_MAX_BYTES must be a positive integer`。

### Route 测试

更新 `apps/server/tests/ws.test.ts`：

- 使用 `terminalInputMaxBytes: 4` 的测试 config。
- 打开真实 Agent/Mobile session。
- 发送 `data: "abcd"`，Agent 能收到。
- 发送 `data: "abcde"`，Mobile 收到 `session.error`，Agent 不收到。
- 验证 UTF-8 字节数而不是字符数：`data: "你好"` 在 4 字节限制下超限。

## 验收标准

- Server 支持 `REMOTE_TERMINAL_INPUT_MAX_BYTES`。
- 超限 input 不会转发给 Agent。
- 超限错误保留 `sessionId`。
- 默认配置下现有 iOS/Mobile terminal 操作不受影响。
- `pnpm --filter @remote/server test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- JSON parse 发生在大小校验之前，超大原始 WebSocket frame 仍可能带来解析压力。
- 没有累计字节数限流，客户端仍可能发送多条接近上限的输入。
- 16 KiB 可能不适合极端长脚本粘贴，后续应通过文件传输能力解决。

## 后续

- 增加 WebSocket raw message size guard。
- 增加 terminal input 累计字节限流。
- 设计文件传输和脚本上传能力，避免把大内容塞进终端输入。
