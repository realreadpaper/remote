# Server Agent Output Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server 限制 Agent `terminal.output` 消息频率，避免异常 Agent 高频刷输出压垮 Mobile。

**Architecture:** `ServerConfig` 增加 Agent output rate limit 配置；`ws.ts` 复用 `MemoryRateLimiter`，在 `/ws/agent` 路由 `terminal.output` 到 `SessionHub` 前检查设备级 limiter，超限时返回 `session.error` 给 Agent。

**Tech Stack:** TypeScript, Fastify WebSocket, Vitest.

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
agentOutputRateLimitWindowMs: 10_000,
agentOutputRateLimitMaxMessages: 1000
```

在 explicit cloud relay env 测试中加入：

```ts
REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS: "5000",
REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX: "50"
```

期望返回：

```ts
agentOutputRateLimitWindowMs: 5_000,
agentOutputRateLimitMaxMessages: 50
```

在非法配置测试中加入：

```ts
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
  "REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
  "REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX: "0" })).toThrow(
  "REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX must be a positive integer"
);
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX: "abc" })).toThrow(
  "REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX must be a positive integer"
);
```

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: fail because `ServerConfig` does not expose Agent output rate limit fields.

- [x] **Step 3: Implement config**

在 `ServerConfig` 增加：

```ts
agentOutputRateLimitWindowMs: number;
agentOutputRateLimitMaxMessages: number;
```

在 `loadServerConfig()` 返回：

```ts
agentOutputRateLimitWindowMs: parseIntegerEnv(
  env.REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS,
  10_000,
  "REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS",
  1_000
),
agentOutputRateLimitMaxMessages: parseIntegerEnv(
  env.REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX,
  1000,
  "REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX",
  1
)
```

- [x] **Step 4: Run green config tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: config tests pass.

## Task 2: Agent output route 红灯与实现

**Files:**
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/ws.ts`

- [x] **Step 1: Write failing route tests**

更新 `tokenServerConfig` 加入：

```ts
agentOutputRateLimitWindowMs: 10_000,
agentOutputRateLimitMaxMessages: 1000
```

新增测试：

```ts
it("rate limits agent terminal output before routing to mobile", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputRateLimitMaxMessages: 1 }
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
  const firstOutput = nextJson(mobile);
  agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "one\n" }));
  expect(await firstOutput).toEqual({
    type: "terminal.output",
    sessionId: opened.sessionId,
    stream: "stdout",
    data: "one\n"
  });

  const rateLimitError = nextJson(agent);
  agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "two\n" }));
  expect(await rateLimitError).toEqual({
    type: "session.error",
    code: "SESSION_ERROR",
    message: "Rate limit exceeded",
    sessionId: opened.sessionId
  });
  await noJson(mobile);

  agent.terminate();
  mobile.terminate();
});
```

新增 `terminal.exit` 不受 output 限流测试：

```ts
it("routes terminal exit after agent output rate limit is exceeded", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputRateLimitMaxMessages: 1 }
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
  const firstOutput = nextJson(mobile);
  agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "one\n" }));
  await firstOutput;

  const rateLimitError = nextJson(agent);
  agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "two\n" }));
  await rateLimitError;

  const exitMessage = nextJson(mobile);
  agent.send(JSON.stringify({ type: "terminal.exit", sessionId: opened.sessionId, exitCode: 0 }));
  expect(await exitMessage).toEqual({
    type: "terminal.exit",
    sessionId: opened.sessionId,
    exitCode: 0
  });

  agent.terminate();
  mobile.terminate();
});
```

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts
```

Expected: fail because second `terminal.output` is still routed to Mobile.

- [x] **Step 3: Implement route limiter**

在 `registerWsRoutes()` 内创建：

```ts
const agentOutputRateLimiter = new MemoryRateLimiter({
  windowMs: config.agentOutputRateLimitWindowMs,
  maxRequests: config.agentOutputRateLimitMaxMessages
});
```

新增 helper：

```ts
function isAllowedAgentOutputRate(limiter: MemoryRateLimiter, deviceId: string): boolean {
  return limiter.check(`ws.agent.output:${deviceId}`).allowed;
}
```

在 `hub.routeFromAgent(attachedDeviceId, agentSend, message)` 前加入：

```ts
if (message.type === "terminal.output" && !isAllowedAgentOutputRate(agentOutputRateLimiter, attachedDeviceId)) {
  throw new Error("Rate limit exceeded");
}
```

现有 catch 会调用 `sendSessionError(socket, messageText(error))`。为了带 `sessionId`，将 Agent message handler 增加局部变量：

```ts
let sessionId: string | undefined;
```

解析 routable message 后：

```ts
sessionId = message.sessionId;
```

catch 中改为：

```ts
sendSessionError(socket, messageText(error), sessionId);
```

- [x] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [x] **Step 5: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: rate limit agent terminal output"
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

- 设计提交 `6c6a2d2`。
- 计划提交。
- 实现提交。
- 红灯：config 缺少字段；second output still routed。
- 绿灯：Server tests pass。
- 全量验证结果。
- 风险：丢弃式限流、单进程内存、只按消息数。
- 后续：背压队列、字节速率、共享 limiter store。

- [x] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record server agent output rate limit delivery"
```

## Self-Review

- Spec coverage: 覆盖配置、Agent output route 限流、terminal.exit 不受影响、错误响应和验证。
- Placeholder scan: 未使用 TBD/TODO/占位说明。
- Type consistency: `agentOutputRateLimitWindowMs`、`agentOutputRateLimitMaxMessages` 命名一致。
