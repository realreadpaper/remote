# WebSocket Message Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 限制 `/ws/mobile` 的 terminal 输入/resize 消息频率，避免异常客户端或泄漏 token 高频刷远程终端。

**Architecture:** 复用 `MemoryRateLimiter`。`ServerConfig` 增加 WebSocket message rate limit 配置；`ws.ts` 在 mobile WebSocket 解析消息后、`hub.routeFromMobile()` 前检查 limiter，超限时发送 `session.error`，不关闭 socket。

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

- [ ] **Step 1: Write failing config tests**

更新默认配置断言，加入：

```ts
wsMessageRateLimitWindowMs: 10_000,
wsMessageRateLimitMaxRequests: 200
```

在 explicit cloud relay env 测试中加入：

```ts
REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS: "5000",
REMOTE_WS_MESSAGE_RATE_LIMIT_MAX: "50"
```

期望返回：

```ts
wsMessageRateLimitWindowMs: 5_000,
wsMessageRateLimitMaxRequests: 50
```

新增非法值断言到 `rejects invalid HTTP rate limit config` 或单独测试：

```ts
expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
  "REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
  "REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_MAX: "0" })).toThrow(
  "REMOTE_WS_MESSAGE_RATE_LIMIT_MAX must be a positive integer"
);
expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_MAX: "abc" })).toThrow(
  "REMOTE_WS_MESSAGE_RATE_LIMIT_MAX must be a positive integer"
);
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: fail because `ServerConfig` does not expose WebSocket rate limit fields.

- [ ] **Step 3: Implement config**

在 `ServerConfig` 增加：

```ts
wsMessageRateLimitWindowMs: number;
wsMessageRateLimitMaxRequests: number;
```

在 `loadServerConfig()` 返回：

```ts
wsMessageRateLimitWindowMs: parseIntegerEnv(
  env.REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS,
  10_000,
  "REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS",
  1_000
),
wsMessageRateLimitMaxRequests: parseIntegerEnv(
  env.REMOTE_WS_MESSAGE_RATE_LIMIT_MAX,
  200,
  "REMOTE_WS_MESSAGE_RATE_LIMIT_MAX",
  1
)
```

- [ ] **Step 4: Run green config tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: config tests pass.

## Task 2: WebSocket route 红灯与实现

**Files:**
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/ws.ts`

- [ ] **Step 1: Write failing route test**

更新 `tokenServerConfig` 加入：

```ts
wsMessageRateLimitWindowMs: 10_000,
wsMessageRateLimitMaxRequests: 200
```

新增测试：

```ts
it("rate limits mobile terminal messages before routing to the agent", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, wsMessageRateLimitMaxRequests: 1 }
  );
  await app.ready();

  const agent = await registerAgent(app);
  const { sessionToken } = await approvePairingRequest(app, agent);
  const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.20" } });
  const agentOpened = nextJson(agent);
  const mobileOpened = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

  await agentOpened;
  const opened = (await mobileOpened) as { sessionId: string };
  const firstRoutedInput = nextJson(agent);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "pwd\n" }));
  expect(await firstRoutedInput).toEqual({
    type: "terminal.input",
    sessionId: opened.sessionId,
    data: "pwd\n"
  });

  const rateLimitError = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "whoami\n" }));
  expect(await rateLimitError).toEqual({
    type: "session.error",
    code: "SESSION_ERROR",
    message: "Rate limit exceeded",
    sessionId: opened.sessionId
  });
  await noJson(agent);

  agent.terminate();
  mobile.terminate();
});
```

新增不同 IP 不共享额度测试：

```ts
it("keeps mobile websocket message rate limit buckets separate by forwarded IP", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, wsMessageRateLimitMaxRequests: 1 }
  );
  await app.ready();

  const agent = await registerAgent(app);
  const { sessionToken } = await approvePairingRequest(app, agent);
  const firstMobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.21" } });
  const secondMobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.22" } });

  const firstAgentOpened = nextJson(agent);
  const firstMobileOpened = nextJson(firstMobile);
  firstMobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));
  await firstAgentOpened;
  const firstOpened = (await firstMobileOpened) as { sessionId: string };

  const firstRoutedInput = nextJson(agent);
  firstMobile.send(JSON.stringify({ type: "terminal.input", sessionId: firstOpened.sessionId, data: "pwd\n" }));
  await firstRoutedInput;

  const secondAgentOpened = nextJson(agent);
  const secondMobileOpened = nextJson(secondMobile);
  secondMobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));
  await secondAgentOpened;
  const secondOpened = (await secondMobileOpened) as { sessionId: string };

  const secondRoutedInput = nextJson(agent);
  secondMobile.send(JSON.stringify({ type: "terminal.input", sessionId: secondOpened.sessionId, data: "date\n" }));
  expect(await secondRoutedInput).toEqual({
    type: "terminal.input",
    sessionId: secondOpened.sessionId,
    data: "date\n"
  });

  agent.terminate();
  firstMobile.terminate();
  secondMobile.terminate();
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts
```

Expected: first route test fails because second `terminal.input` is routed to Agent instead of returning `session.error`.

- [ ] **Step 3: Implement route limiter**

在 `registerWsRoutes()` 内创建：

```ts
const wsMessageRateLimiter = new MemoryRateLimiter({
  windowMs: config.wsMessageRateLimitWindowMs,
  maxRequests: config.wsMessageRateLimitMaxRequests
});
```

在 `/ws/mobile` handler 创建 key：

```ts
const mobileRateLimitKey = `ws.mobile.messages:${clientKey(request)}`;
```

新增 helper：

```ts
function isAllowedWebSocketMessageRate(limiter: MemoryRateLimiter, key: string): boolean {
  return limiter.check(key).allowed;
}
```

在 `hub.routeFromMobile(mobileSend, message)` 前加入：

```ts
if (!isAllowedWebSocketMessageRate(wsMessageRateLimiter, mobileRateLimitKey)) {
  throw new Error("Rate limit exceeded");
}
```

现有 catch 会调用 `sendSessionError(socket, messageText(error), sessionId)`，因此会带上原始 `sessionId`。

- [ ] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [ ] **Step 5: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: rate limit mobile websocket messages"
```

## Task 3: Full verification and record

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Record delivery**

在 `docs/superpowers/records/feature-log.md` 追加：

- 设计提交 `659acba`。
- 计划提交。
- 实现提交。
- 红灯：config 缺少字段；route 未阻止第二条 terminal input。
- 绿灯：Server tests pass。
- 全量验证结果。
- 风险：单进程内存、IP/NAT 共享、未限制字节数、未限制 Agent output。
- 后续：input 字节数限制、Agent output 背压、共享 store。

- [ ] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record websocket message rate limit delivery"
```

## Self-Review

- Spec coverage: 覆盖配置、Mobile terminal message 限流、不同 IP bucket、超限 session.error 和验证。
- Placeholder scan: 未使用 TBD/TODO/占位说明。
- Type consistency: `wsMessageRateLimitWindowMs`、`wsMessageRateLimitMaxRequests`、`MemoryRateLimiter` 命名一致。
