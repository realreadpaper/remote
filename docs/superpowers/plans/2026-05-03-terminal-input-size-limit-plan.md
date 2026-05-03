# Terminal Input Size Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 限制单条 `terminal.input.data` 的 UTF-8 字节数，避免异常 Mobile 客户端通过超大输入压垮 Server/Agent。

**Architecture:** `ServerConfig` 增加 `terminalInputMaxBytes`。`ws.ts` 在 `/ws/mobile` 中解析并确认消息为 `terminal.input` 后，使用 `Buffer.byteLength(data, "utf8")` 校验大小；超限抛出错误，由现有 catch 返回带 `sessionId` 的 `session.error`。

**Tech Stack:** TypeScript, Fastify WebSocket, Vitest, Node Buffer.

---

## File Structure

```text
apps/server/src/config.ts
apps/server/src/ws.ts
apps/server/tests/config.test.ts
apps/server/tests/ws.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Config 红灯与实现

**Files:**
- Modify: `apps/server/tests/config.test.ts`
- Modify: `apps/server/src/config.ts`

- [x] **Step 1: Write failing config tests**

更新默认配置断言，加入：

```ts
terminalInputMaxBytes: 16_384
```

在 explicit cloud relay env 测试中加入：

```ts
REMOTE_TERMINAL_INPUT_MAX_BYTES: "4096"
```

期望返回：

```ts
terminalInputMaxBytes: 4_096
```

在非法配置测试中加入：

```ts
expect(() => loadServerConfig({ REMOTE_TERMINAL_INPUT_MAX_BYTES: "0" })).toThrow(
  "REMOTE_TERMINAL_INPUT_MAX_BYTES must be a positive integer"
);
expect(() => loadServerConfig({ REMOTE_TERMINAL_INPUT_MAX_BYTES: "abc" })).toThrow(
  "REMOTE_TERMINAL_INPUT_MAX_BYTES must be a positive integer"
);
```

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: fail because `ServerConfig` does not expose `terminalInputMaxBytes`.

- [x] **Step 3: Implement config**

在 `ServerConfig` 增加：

```ts
terminalInputMaxBytes: number;
```

在 `loadServerConfig()` 返回：

```ts
terminalInputMaxBytes: parseIntegerEnv(
  env.REMOTE_TERMINAL_INPUT_MAX_BYTES,
  16_384,
  "REMOTE_TERMINAL_INPUT_MAX_BYTES",
  1
)
```

- [x] **Step 4: Run green config tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: config tests pass.

## Task 2: WebSocket route 红灯与实现

**Files:**
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/ws.ts`

- [x] **Step 1: Write failing route tests**

更新 `tokenServerConfig` 加入：

```ts
terminalInputMaxBytes: 16_384
```

新增测试：

```ts
it("rejects terminal input larger than the configured byte limit", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, terminalInputMaxBytes: 4 }
  );
  await app.ready();

  const agent = await registerAgent(app);
  const { sessionToken } = await approvePairingRequest(app, agent);
  const mobile = await app.injectWS("/ws/mobile");
  const agentOpened = nextJson(agent);
  const mobileOpened = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

  await agentOpened;
  const opened = (await mobileOpened) as { sessionId: string };
  const routedInput = nextJson(agent);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcd" }));
  expect(await routedInput).toEqual({
    type: "terminal.input",
    sessionId: opened.sessionId,
    data: "abcd"
  });

  const sizeError = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcde" }));
  expect(await sizeError).toEqual({
    type: "session.error",
    code: "SESSION_ERROR",
    message: "Terminal input exceeds 4 bytes",
    sessionId: opened.sessionId
  });
  await noJson(agent);

  agent.terminate();
  mobile.terminate();
});
```

新增 UTF-8 字节数测试：

```ts
it("checks terminal input size by UTF-8 bytes", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, terminalInputMaxBytes: 4 }
  );
  await app.ready();

  const agent = await registerAgent(app);
  const { sessionToken } = await approvePairingRequest(app, agent);
  const mobile = await app.injectWS("/ws/mobile");
  const agentOpened = nextJson(agent);
  const mobileOpened = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

  await agentOpened;
  const opened = (await mobileOpened) as { sessionId: string };
  const sizeError = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "你好" }));
  expect(await sizeError).toEqual({
    type: "session.error",
    code: "SESSION_ERROR",
    message: "Terminal input exceeds 4 bytes",
    sessionId: opened.sessionId
  });
  await noJson(agent);

  agent.terminate();
  mobile.terminate();
});
```

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts
```

Expected: route tests fail because oversized input is still routed to Agent.

- [x] **Step 3: Implement route guard**

在 `apps/server/src/ws.ts` 新增 helper：

```ts
function assertTerminalInputSize(message: MobileRoutableMessage, maxBytes: number): void {
  if (message.type !== "terminal.input") {
    return;
  }

  if (Buffer.byteLength(message.data, "utf8") > maxBytes) {
    throw new Error(`Terminal input exceeds ${maxBytes} bytes`);
  }
}
```

在 `hub.routeFromMobile(mobileSend, message)` 前、message rate limit 前加入：

```ts
assertTerminalInputSize(message, config.terminalInputMaxBytes);
```

- [x] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [x] **Step 5: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: limit terminal input size"
```

## Task 3: Full verification and record

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Record delivery**

在 `docs/superpowers/records/feature-log.md` 追加：

- 设计提交 `ee316da`。
- 计划提交。
- 实现提交。
- 红灯：config 缺少字段；oversized input 仍被转发。
- 绿灯：Server tests pass。
- 全量验证结果。
- 风险：JSON parse 前仍可能收到超大 frame、没有累计字节限流、长脚本应走文件功能。
- 后续：raw message size guard、累计字节限流、文件传输。

- [x] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record terminal input size limit delivery"
```

## Self-Review

- Spec coverage: 覆盖配置、UTF-8 字节数、超限 `session.error`、不转发给 Agent 和验证。
- Placeholder scan: 未使用 TBD/TODO/占位说明。
- Type consistency: `terminalInputMaxBytes` 命名一致。
