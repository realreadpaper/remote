# Server Mobile Input Byte Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server 按 UTF-8 字节数限制 Mobile `terminal.input` 输入速率，避免多条接近单条上限的输入在窗口内累计压垮 Agent/PTY。

**Architecture:** 复用 `MemoryWeightedRateLimiter`；`ServerConfig` 增加 Mobile input byte rate 配置；`ws.ts` 在 `/ws/mobile` 路由 `terminal.input` 前先通过单条 input size guard，再通过消息数限流，最后按 `Buffer.byteLength(data, "utf8")` 做累计字节限流。

**Tech Stack:** TypeScript, Fastify WebSocket, Node Buffer, Vitest.

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
mobileInputByteRateLimitWindowMs: 10_000,
mobileInputByteRateLimitMaxBytes: 262_144
```

在 explicit cloud relay env 测试中加入：

```ts
REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS: "5000",
REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX: "4096"
```

期望返回：

```ts
mobileInputByteRateLimitWindowMs: 5_000,
mobileInputByteRateLimitMaxBytes: 4_096
```

新增非法值断言：

```ts
expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
  "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
  "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX: "0" })).toThrow(
  "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
);
expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX: "abc" })).toThrow(
  "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
);
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: fail because `ServerConfig` does not expose Mobile input byte rate fields.

- [ ] **Step 3: Implement config**

在 `ServerConfig` 增加：

```ts
mobileInputByteRateLimitWindowMs: number;
mobileInputByteRateLimitMaxBytes: number;
```

在 `loadServerConfig()` 返回：

```ts
mobileInputByteRateLimitWindowMs: parseIntegerEnv(
  env.REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS,
  10_000,
  "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS",
  1_000
),
mobileInputByteRateLimitMaxBytes: parseIntegerEnv(
  env.REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX,
  262_144,
  "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX",
  1
)
```

- [ ] **Step 4: Run green config tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: config tests pass.

## Task 2: Mobile input byte route 红灯与实现

**Files:**
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/ws.ts`

- [ ] **Step 1: Write failing route tests**

更新 `tokenServerConfig` 加入：

```ts
mobileInputByteRateLimitWindowMs: 10_000,
mobileInputByteRateLimitMaxBytes: 262_144
```

新增累计 ASCII 字节测试：

```ts
it("rate limits mobile terminal input by UTF-8 bytes before routing to the agent", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, mobileInputByteRateLimitMaxBytes: 4 }
  );
  await app.ready();

  const agent = await registerAgent(app);
  const { sessionToken } = await approvePairingRequest(app, agent);
  const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.30" } });
  const agentOpened = nextJson(agent);
  const mobileOpened = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

  await agentOpened;
  const opened = (await mobileOpened) as { sessionId: string };
  const firstInput = nextJson(agent);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcd" }));
  expect(await firstInput).toEqual({
    type: "terminal.input",
    sessionId: opened.sessionId,
    data: "abcd"
  });

  const rateLimitError = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "e" }));
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

新增 UTF-8 字节测试：

```ts
it("counts mobile terminal input byte rate by UTF-8 bytes", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, mobileInputByteRateLimitMaxBytes: 4 }
  );
  await app.ready();

  const agent = await registerAgent(app);
  const { sessionToken } = await approvePairingRequest(app, agent);
  const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.31" } });
  const agentOpened = nextJson(agent);
  const mobileOpened = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

  await agentOpened;
  const opened = (await mobileOpened) as { sessionId: string };
  const rateLimitError = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "你好" }));
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

新增 resize 不受 input byte limiter 影响的测试：

```ts
it("routes terminal resize after mobile input byte rate limit is exceeded", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, mobileInputByteRateLimitMaxBytes: 4 }
  );
  await app.ready();

  const agent = await registerAgent(app);
  const { sessionToken } = await approvePairingRequest(app, agent);
  const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.32" } });
  const agentOpened = nextJson(agent);
  const mobileOpened = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

  await agentOpened;
  const opened = (await mobileOpened) as { sessionId: string };
  const firstInput = nextJson(agent);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcd" }));
  await firstInput;

  const rateLimitError = nextJson(mobile);
  mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "e" }));
  await rateLimitError;

  const resizeMessage = nextJson(agent);
  mobile.send(JSON.stringify({ type: "terminal.resize", sessionId: opened.sessionId, cols: 120, rows: 40 }));
  expect(await resizeMessage).toEqual({
    type: "terminal.resize",
    sessionId: opened.sessionId,
    cols: 120,
    rows: 40
  });

  agent.terminate();
  mobile.terminate();
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts
```

Expected: fail because mobile input byte rate is not enforced.

- [ ] **Step 3: Implement route byte limiter**

在 `apps/server/src/ws.ts` 新增 helper：

```ts
function isAllowedMobileInputByteRate(
  limiter: MemoryWeightedRateLimiter,
  key: string,
  message: Extract<ClientMessage, { type: "terminal.input" }>
): boolean {
  return limiter.check(key, Buffer.byteLength(message.data, "utf8")).allowed;
}
```

在 `registerWsRoutes()` 内创建：

```ts
const mobileInputByteRateLimiter = new MemoryWeightedRateLimiter({
  windowMs: config.mobileInputByteRateLimitWindowMs,
  maxRequests: config.mobileInputByteRateLimitMaxBytes
});
```

在 `/ws/mobile` route 中创建独立 key：

```ts
const mobileInputByteRateLimitKey = `ws.mobile.input.bytes:${clientKey(request)}`;
```

在 `assertTerminalInputSize()` 和 message count limiter 之后加入：

```ts
if (
  message.type === "terminal.input" &&
  !isAllowedMobileInputByteRate(mobileInputByteRateLimiter, mobileInputByteRateLimitKey, message)
) {
  throw new Error("Rate limit exceeded");
}
```

- [ ] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [ ] **Step 5: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: rate limit mobile terminal input bytes"
```

## Task 3: Full verification and record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-03-server-mobile-input-byte-rate-limit-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Mark completed plan steps**

把本计划中已经执行且验证过的步骤从 `- [ ]` 更新为 `- [x]`，确保状态可追踪。

- [ ] **Step 3: Record delivery**

在 `docs/superpowers/records/feature-log.md` 追加：

- 设计提交 `dc5143a`。
- 计划提交。
- 实现提交。
- 红灯：config 缺少字段；route 未限制累计 input 字节。
- 绿灯：Server tests pass。
- 全量验证结果。
- 风险：丢弃式限流、单进程内存、IP/NAT 误伤。
- 后续：共享 limiter store、账号/设备维度限流、脚本上传和文件传输。

- [ ] **Step 4: Commit record**

```bash
git add docs/superpowers/plans/2026-05-03-server-mobile-input-byte-rate-limit-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record server mobile input byte rate limit delivery"
```

## Self-Review

- Spec coverage: 覆盖配置、UTF-8 字节 route 限流、错误响应、resize 不计入和验证。
- Placeholder scan: 未使用占位词或未完成说明。
- Type consistency: `mobileInputByteRateLimitWindowMs`、`mobileInputByteRateLimitMaxBytes`、`MemoryWeightedRateLimiter` 命名一致。
