# HTTP Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 HTTP pairing/status/bindings/revoke 路由增加免费内存 rate limit，降低公网云中转前的基础滥用风险。

**Architecture:** 新增独立 `MemoryRateLimiter`，不依赖 Fastify；`ServerConfig` 提供窗口和额度配置；`ws.ts` 在 dev token guard 后、业务逻辑前调用限流 helper，超限返回 429 和 `Retry-After`。

**Tech Stack:** TypeScript, Fastify, Vitest.

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

## Task 1: Config 红灯与实现

**Files:**
- Modify: `apps/server/tests/config.test.ts`
- Modify: `apps/server/src/config.ts`

- [ ] **Step 1: Write failing config tests**

更新默认配置断言，增加显式环境变量和非法值测试：

```ts
expect(loadServerConfig({})).toEqual({
  host: "127.0.0.1",
  port: 8787,
  requireDevToken: false,
  devToken: null,
  publicBaseUrl: null,
  dataDir: null,
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 120
});
```

在 explicit cloud relay env 测试中加入：

```ts
REMOTE_HTTP_RATE_LIMIT_WINDOW_MS: "30000",
REMOTE_HTTP_RATE_LIMIT_MAX: "30"
```

期望 `loadServerConfig()` 返回：

```ts
rateLimitWindowMs: 30_000,
rateLimitMaxRequests: 30
```

新增测试：

```ts
it("rejects invalid HTTP rate limit config", () => {
  expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
    "REMOTE_HTTP_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
  );
  expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
    "REMOTE_HTTP_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
  );
  expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_MAX: "0" })).toThrow(
    "REMOTE_HTTP_RATE_LIMIT_MAX must be a positive integer"
  );
  expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_MAX: "abc" })).toThrow(
    "REMOTE_HTTP_RATE_LIMIT_MAX must be a positive integer"
  );
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: fail because `ServerConfig` does not expose rate limit fields.

- [ ] **Step 3: Implement config**

在 `ServerConfig` 增加：

```ts
rateLimitWindowMs: number;
rateLimitMaxRequests: number;
```

在 `loadServerConfig()` 返回：

```ts
rateLimitWindowMs: parseIntegerEnv(
  env.REMOTE_HTTP_RATE_LIMIT_WINDOW_MS,
  60_000,
  "REMOTE_HTTP_RATE_LIMIT_WINDOW_MS",
  1_000
),
rateLimitMaxRequests: parseIntegerEnv(env.REMOTE_HTTP_RATE_LIMIT_MAX, 120, "REMOTE_HTTP_RATE_LIMIT_MAX", 1)
```

新增 helper：

```ts
function parseIntegerEnv(
  rawValue: string | undefined,
  defaultValue: number,
  envName: string,
  minimum: number
): number {
  const normalized = normalizeOptional(rawValue);
  if (!normalized) {
    return defaultValue;
  }

  const value = Number(normalized);
  if (!Number.isInteger(value) || value < minimum) {
    if (minimum === 1) {
      throw new Error(`${envName} must be a positive integer`);
    }
    throw new Error(`${envName} must be an integer greater than or equal to ${minimum}`);
  }

  return value;
}
```

- [ ] **Step 4: Run green config tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: config tests pass.

## Task 2: RateLimiter 红灯与实现

**Files:**
- Create: `apps/server/src/rateLimit.ts`
- Create: `apps/server/tests/rateLimit.test.ts`

- [ ] **Step 1: Write failing rate limiter tests**

创建 `apps/server/tests/rateLimit.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "../src/rateLimit.js";

describe("MemoryRateLimiter", () => {
  it("allows requests until the window limit is exceeded", () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, maxRequests: 2, now: () => now });

    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: false, retryAfterMs: 10_000 });

    now = 5_000;
    expect(limiter.check("pairing.request:127.0.0.1")).toEqual({ allowed: false, retryAfterMs: 6_000 });
  });

  it("resets a key after the window expires", () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, maxRequests: 1, now: () => now });

    expect(limiter.check("pairing.status:127.0.0.1").allowed).toBe(true);
    expect(limiter.check("pairing.status:127.0.0.1").allowed).toBe(false);

    now = 11_001;
    expect(limiter.check("pairing.status:127.0.0.1")).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it("tracks different keys independently", () => {
    const limiter = new MemoryRateLimiter({ windowMs: 10_000, maxRequests: 1, now: () => 1_000 });

    expect(limiter.check("pairing.request:127.0.0.1").allowed).toBe(true);
    expect(limiter.check("pairing.request:127.0.0.1").allowed).toBe(false);
    expect(limiter.check("pairing.request:127.0.0.2").allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/rateLimit.test.ts
```

Expected: fail because `apps/server/src/rateLimit.ts` does not exist.

- [ ] **Step 3: Implement rate limiter**

创建 `apps/server/src/rateLimit.ts`：

```ts
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface RateLimitBucket {
  windowStartedAt: number;
  count: number;
}

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.now = options.now ?? Date.now;
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    const existing = this.buckets.get(key);
    const bucket =
      existing && now - existing.windowStartedAt <= this.windowMs
        ? existing
        : { windowStartedAt: now, count: 0 };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (bucket.count <= this.maxRequests) {
      return { allowed: true, retryAfterMs: 0 };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(0, bucket.windowStartedAt + this.windowMs - now)
    };
  }
}
```

- [ ] **Step 4: Run green rate limiter tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/rateLimit.test.ts
```

Expected: rate limiter tests pass.

## Task 3: HTTP route rate limit 红灯与实现

**Files:**
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/ws.ts`

- [ ] **Step 1: Write failing route tests**

更新 `tokenServerConfig` 增加：

```ts
rateLimitWindowMs: 60_000,
rateLimitMaxRequests: 120
```

新增测试：

```ts
it("rate limits authorized HTTP pairing requests by client IP", async () => {
  await app.close();
  app = await createServer({ logger: false }, { ...tokenServerConfig, rateLimitMaxRequests: 2 });
  await app.ready();

  const payload = {
    pairingCode: "000000",
    mobileClientId: "mobile-1",
    mobileName: "iPhone"
  };

  const first = await app.inject({
    method: "POST",
    url: "/pairing/requests",
    headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
    payload
  });
  const second = await app.inject({
    method: "POST",
    url: "/pairing/requests",
    headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
    payload
  });
  const third = await app.inject({
    method: "POST",
    url: "/pairing/requests",
    headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
    payload
  });

  expect(first.statusCode).toBe(400);
  expect(second.statusCode).toBe(400);
  expect(third.statusCode).toBe(429);
  expect(third.headers["retry-after"]).toBe("60");
  expect(third.json()).toEqual({ error: "Rate limit exceeded", retryAfterMs: 60_000 });
});
```

新增不同 IP 不共享额度测试：

```ts
it("keeps HTTP rate limit buckets separate by forwarded client IP", async () => {
  await app.close();
  app = await createServer({ logger: false }, { ...tokenServerConfig, rateLimitMaxRequests: 1 });
  await app.ready();

  const payload = {
    pairingCode: "000000",
    mobileClientId: "mobile-1",
    mobileName: "iPhone"
  };

  const first = await app.inject({
    method: "POST",
    url: "/pairing/requests",
    headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
    payload
  });
  const secondSameIp = await app.inject({
    method: "POST",
    url: "/pairing/requests",
    headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
    payload
  });
  const firstOtherIp = await app.inject({
    method: "POST",
    url: "/pairing/requests",
    headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.11" },
    payload
  });

  expect(first.statusCode).toBe(400);
  expect(secondSameIp.statusCode).toBe(429);
  expect(firstOtherIp.statusCode).toBe(400);
});
```

说明：前两次 400 是因为测试没有在线 Agent，证明请求已通过 auth/rate limit 并进入业务逻辑；第 3 次 429 证明超限请求被挡在业务逻辑前。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts
```

Expected: route rate limit tests fail because HTTP routes do not call limiter.

- [ ] **Step 3: Implement route limiter**

在 `apps/server/src/ws.ts` 导入：

```ts
import { MemoryRateLimiter } from "./rateLimit.js";
```

在 `registerWsRoutes()` 内创建：

```ts
const httpRateLimiter = new MemoryRateLimiter({
  windowMs: config.rateLimitWindowMs,
  maxRequests: config.rateLimitMaxRequests
});
```

新增 helper：

```ts
function isAllowedHttpRate(
  request: FastifyRequest,
  reply: FastifyReply,
  limiter: MemoryRateLimiter,
  scope: string
): boolean {
  const result = limiter.check(`${scope}:${clientKey(request)}`);
  if (result.allowed) {
    return true;
  }

  reply.header("Retry-After", String(Math.ceil(result.retryAfterMs / 1_000)));
  reply.code(429).send({ error: "Rate limit exceeded", retryAfterMs: result.retryAfterMs });
  return false;
}

function clientKey(request: FastifyRequest): string {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]?.split(",")[0]?.trim() || "unknown";
  }

  return request.ip || "unknown";
}
```

每个受保护 route 在 auth 后加入：

```ts
if (!isAllowedHttpRate(request, reply, httpRateLimiter, "pairing.requests")) {
  return reply;
}
```

scope 建议：

- `pairing.bindings`
- `pairing.requests.create`
- `pairing.requests.status`
- `session-tokens.revoke`

- [ ] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [ ] **Step 5: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/rateLimit.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/rateLimit.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: add http rate limit"
```

## Task 4: Full verification and record

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

- 设计提交 `18e833d`。
- 计划提交。
- 实现提交。
- 红灯：config 缺少字段；rateLimit 模块不存在；route 未返回 429。
- 绿灯：Server test pass。
- 全量验证：`pnpm test`、`pnpm typecheck`、`pnpm build`。
- 风险：单进程内存限流、`x-forwarded-for` 信任边界、NAT 共享额度。
- 后续：Redis/Postgres store、WebSocket 消息限流、账号/设备维度限流。

- [ ] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record http rate limit delivery"
```

## Self-Review

- Spec coverage: 覆盖配置、内存限流模块、HTTP route 接入、429 响应、测试和风险。
- Placeholder scan: 未使用 TBD/TODO/占位说明。
- Type consistency: `rateLimitWindowMs`、`rateLimitMaxRequests`、`MemoryRateLimiter`、`RateLimitResult` 命名一致。
