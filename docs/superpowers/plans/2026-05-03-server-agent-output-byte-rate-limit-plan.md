# Server Agent Output Byte Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server 按 UTF-8 字节数限制 Agent `terminal.output` 输出速率，补足仅按消息数限流的缺口。

**Architecture:** `rateLimit.ts` 新增 `MemoryWeightedRateLimiter`；`ServerConfig` 增加 Agent output byte rate 配置；`ws.ts` 在 `/ws/agent` 路由 `terminal.output` 前先做消息数限流，再按 `Buffer.byteLength(data, "utf8")` 做字节限流。

**Tech Stack:** TypeScript, Fastify WebSocket, Node Buffer, Vitest.

---

## File Structure

```text
apps/server/src/config.ts
apps/server/src/rateLimit.ts
apps/server/src/ws.ts
apps/server/tests/config.test.ts
apps/server/tests/rateLimit.test.ts
apps/server/tests/ws.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Weighted limiter 红灯与实现

**Files:**
- Modify: `apps/server/tests/rateLimit.test.ts`
- Modify: `apps/server/src/rateLimit.ts`

- [x] **Step 1: Write failing weighted limiter tests**

在 `apps/server/tests/rateLimit.test.ts` 导入 `MemoryWeightedRateLimiter`，新增：

```ts
describe("MemoryWeightedRateLimiter", () => {
  it("allows cumulative weight until the window limit is exceeded", () => {
    let now = 1_000;
    const limiter = new MemoryWeightedRateLimiter({ windowMs: 10_000, maxRequests: 5, now: () => now });

    expect(limiter.check("ws.agent.output.bytes:mac-1", 4)).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("ws.agent.output.bytes:mac-1", 1)).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("ws.agent.output.bytes:mac-1", 1)).toEqual({ allowed: false, retryAfterMs: 10_000 });

    now = 5_000;
    expect(limiter.check("ws.agent.output.bytes:mac-1", 1)).toEqual({ allowed: false, retryAfterMs: 6_000 });
  });

  it("does not consume capacity when a weighted request is rejected", () => {
    const limiter = new MemoryWeightedRateLimiter({ windowMs: 10_000, maxRequests: 5, now: () => 1_000 });

    expect(limiter.check("ws.agent.output.bytes:mac-1", 4).allowed).toBe(true);
    expect(limiter.check("ws.agent.output.bytes:mac-1", 2).allowed).toBe(false);
    expect(limiter.check("ws.agent.output.bytes:mac-1", 1).allowed).toBe(true);
  });

  it("resets weighted usage after the window expires", () => {
    let now = 1_000;
    const limiter = new MemoryWeightedRateLimiter({ windowMs: 10_000, maxRequests: 5, now: () => now });

    expect(limiter.check("ws.agent.output.bytes:mac-1", 5).allowed).toBe(true);
    expect(limiter.check("ws.agent.output.bytes:mac-1", 1).allowed).toBe(false);

    now = 11_001;
    expect(limiter.check("ws.agent.output.bytes:mac-1", 5)).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it("tracks weighted keys independently", () => {
    const limiter = new MemoryWeightedRateLimiter({ windowMs: 10_000, maxRequests: 5, now: () => 1_000 });

    expect(limiter.check("ws.agent.output.bytes:mac-1", 5).allowed).toBe(true);
    expect(limiter.check("ws.agent.output.bytes:mac-1", 1).allowed).toBe(false);
    expect(limiter.check("ws.agent.output.bytes:mac-2", 5).allowed).toBe(true);
  });
});
```

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/rateLimit.test.ts
```

Expected: fail because `MemoryWeightedRateLimiter` does not exist.

- [x] **Step 3: Implement weighted limiter**

在 `apps/server/src/rateLimit.ts` 新增：

```ts
export class MemoryWeightedRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.now = options.now ?? Date.now;
  }

  check(key: string, weight: number): RateLimitResult {
    const now = this.now();
    const normalizedWeight = Math.max(1, Math.floor(weight));
    const existing = this.buckets.get(key);
    const bucket =
      existing && now - existing.windowStartedAt <= this.windowMs
        ? existing
        : { windowStartedAt: now, count: 0 };

    if (bucket.count + normalizedWeight > this.maxRequests) {
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        retryAfterMs: Math.max(0, bucket.windowStartedAt + this.windowMs - now)
      };
    }

    bucket.count += normalizedWeight;
    this.buckets.set(key, bucket);
    return { allowed: true, retryAfterMs: 0 };
  }
}
```

- [x] **Step 4: Run green limiter tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/rateLimit.test.ts
```

Expected: rate limiter tests pass.

## Task 2: Config 红灯与实现

**Files:**
- Modify: `apps/server/tests/config.test.ts`
- Modify: `apps/server/src/config.ts`

- [x] **Step 1: Write failing config tests**

更新默认配置断言，加入：

```ts
agentOutputByteRateLimitWindowMs: 10_000,
agentOutputByteRateLimitMaxBytes: 1_048_576
```

在 explicit cloud relay env 测试中加入：

```ts
REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS: "5000",
REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX: "4096"
```

期望返回：

```ts
agentOutputByteRateLimitWindowMs: 5_000,
agentOutputByteRateLimitMaxBytes: 4_096
```

新增非法值断言：

```ts
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
  "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
  "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
);
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX: "0" })).toThrow(
  "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
);
expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX: "abc" })).toThrow(
  "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
);
```

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: fail because `ServerConfig` does not expose byte rate fields.

- [x] **Step 3: Implement config**

在 `ServerConfig` 增加：

```ts
agentOutputByteRateLimitWindowMs: number;
agentOutputByteRateLimitMaxBytes: number;
```

在 `loadServerConfig()` 返回：

```ts
agentOutputByteRateLimitWindowMs: parseIntegerEnv(
  env.REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS,
  10_000,
  "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS",
  1_000
),
agentOutputByteRateLimitMaxBytes: parseIntegerEnv(
  env.REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX,
  1_048_576,
  "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX",
  1
)
```

- [x] **Step 4: Run green config tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: config tests pass.

## Task 3: Agent output byte route 红灯与实现

**Files:**
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/ws.ts`

- [x] **Step 1: Write failing route tests**

更新 `tokenServerConfig` 加入：

```ts
agentOutputByteRateLimitWindowMs: 10_000,
agentOutputByteRateLimitMaxBytes: 1_048_576
```

新增测试：

```ts
it("rate limits agent terminal output by UTF-8 bytes before routing to mobile", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputByteRateLimitMaxBytes: 4 }
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
  agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "abcd" }));
  await firstOutput;

  const rateLimitError = nextJson(agent);
  agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "e" }));
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

新增 UTF-8 字节测试：

```ts
it("counts agent terminal output byte rate by UTF-8 bytes", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputByteRateLimitMaxBytes: 4 }
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
  const rateLimitError = nextJson(agent);
  agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "你好" }));
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

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts
```

Expected: fail because output byte rate is not enforced.

- [x] **Step 3: Implement route byte limiter**

在 `apps/server/src/ws.ts` 导入：

```ts
import { MemoryRateLimiter, MemoryWeightedRateLimiter } from "./rateLimit.js";
```

在 `registerWsRoutes()` 内创建：

```ts
const agentOutputByteRateLimiter = new MemoryWeightedRateLimiter({
  windowMs: config.agentOutputByteRateLimitWindowMs,
  maxRequests: config.agentOutputByteRateLimitMaxBytes
});
```

新增 helper：

```ts
function isAllowedAgentOutputByteRate(
  limiter: MemoryWeightedRateLimiter,
  deviceId: string,
  message: Extract<ServerMessage, { type: "terminal.output" }>
): boolean {
  return limiter.check(`ws.agent.output.bytes:${deviceId}`, Buffer.byteLength(message.data, "utf8")).allowed;
}
```

在 `terminal.output` 消息数限流后加入：

```ts
if (message.type === "terminal.output" && !isAllowedAgentOutputByteRate(agentOutputByteRateLimiter, attachedDeviceId, message)) {
  throw new Error("Rate limit exceeded");
}
```

- [x] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [x] **Step 5: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/rateLimit.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/rateLimit.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: rate limit agent terminal output bytes"
```

## Task 4: Full verification and record

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

- 设计提交 `00860e9`。
- 计划提交。
- 实现提交。
- 红灯：weighted limiter 不存在；config 缺少字段；byte route 未限制。
- 绿灯：Server tests pass。
- 全量验证结果。
- 风险：丢弃式限流、单进程内存、parse 后统计。
- 后续：背压队列、共享 limiter store、Mobile input 累计字节限流。

- [x] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record server agent output byte rate limit delivery"
```

## Self-Review

- Spec coverage: 覆盖 weighted limiter、配置、UTF-8 字节 route 限流、错误响应和验证。
- Placeholder scan: 未使用 TBD/TODO/占位说明。
- Type consistency: `agentOutputByteRateLimitWindowMs`、`agentOutputByteRateLimitMaxBytes`、`MemoryWeightedRateLimiter` 命名一致。
