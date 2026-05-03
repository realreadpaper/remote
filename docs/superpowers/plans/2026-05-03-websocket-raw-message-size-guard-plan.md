# WebSocket Raw Message Size Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 JSON parse 前限制单条 WebSocket raw message 大小，保护 Agent/Mobile WebSocket 入口免受超大 frame 解析压力。

**Architecture:** `ServerConfig` 增加 `wsRawMessageMaxBytes`。`ws.ts` 将 `parseJson(data)` 改为 `parseJson(data, maxBytes)`，先计算 `RawData` 字节数，超过配置上限则抛错；现有 catch 发送 `session.error`。

**Tech Stack:** TypeScript, Fastify WebSocket, ws RawData, Vitest.

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
wsRawMessageMaxBytes: 65_536
```

在 explicit cloud relay env 测试中加入：

```ts
REMOTE_WS_RAW_MESSAGE_MAX_BYTES: "8192"
```

期望返回：

```ts
wsRawMessageMaxBytes: 8_192
```

在非法配置测试中加入：

```ts
expect(() => loadServerConfig({ REMOTE_WS_RAW_MESSAGE_MAX_BYTES: "0" })).toThrow(
  "REMOTE_WS_RAW_MESSAGE_MAX_BYTES must be a positive integer"
);
expect(() => loadServerConfig({ REMOTE_WS_RAW_MESSAGE_MAX_BYTES: "abc" })).toThrow(
  "REMOTE_WS_RAW_MESSAGE_MAX_BYTES must be a positive integer"
);
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/config.test.ts
```

Expected: fail because `ServerConfig` does not expose `wsRawMessageMaxBytes`.

- [ ] **Step 3: Implement config**

在 `ServerConfig` 增加：

```ts
wsRawMessageMaxBytes: number;
```

在 `loadServerConfig()` 返回：

```ts
wsRawMessageMaxBytes: parseIntegerEnv(
  env.REMOTE_WS_RAW_MESSAGE_MAX_BYTES,
  65_536,
  "REMOTE_WS_RAW_MESSAGE_MAX_BYTES",
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

- [ ] **Step 1: Write failing route tests**

更新 `tokenServerConfig` 加入：

```ts
wsRawMessageMaxBytes: 65_536
```

新增 Mobile raw message 测试：

```ts
it("rejects oversized raw mobile websocket messages before parsing JSON", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, wsRawMessageMaxBytes: 8 }
  );
  await app.ready();

  const mobile = await app.injectWS("/ws/mobile");
  const errorMessage = nextJson(mobile);
  mobile.send("not-json-but-too-large");

  expect(await errorMessage).toEqual({
    type: "session.error",
    code: "SESSION_ERROR",
    message: "WebSocket message exceeds 8 bytes"
  });

  mobile.terminate();
});
```

新增 Agent raw message 测试：

```ts
it("rejects oversized raw agent websocket messages before parsing JSON", async () => {
  await app.close();
  app = await createServer(
    { logger: false },
    { ...tokenServerConfig, requireDevToken: false, devToken: null, wsRawMessageMaxBytes: 8 }
  );
  await app.ready();

  const agent = await app.injectWS("/ws/agent");
  const errorMessage = nextJson(agent);
  agent.send("not-json-but-too-large");

  expect(await errorMessage).toEqual({
    type: "session.error",
    code: "SESSION_ERROR",
    message: "WebSocket message exceeds 8 bytes"
  });

  agent.terminate();
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test -- apps/server/tests/ws.test.ts
```

Expected: tests fail because current code sends JSON parse errors instead of raw size errors.

- [ ] **Step 3: Implement raw size guard**

在 `apps/server/src/ws.ts` 修改 `parseJson()`：

```ts
function parseJson(data: RawData, maxBytes: number): unknown {
  const byteLength = rawDataByteLength(data);
  if (byteLength > maxBytes) {
    throw new Error(`WebSocket message exceeds ${maxBytes} bytes`);
  }

  return JSON.parse(data.toString());
}
```

新增 helper：

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

更新两个调用点：

```ts
const payload = parseJson(data, config.wsRawMessageMaxBytes);
```

```ts
const message = parseClientMessage(parseJson(data, config.wsRawMessageMaxBytes));
```

- [ ] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [ ] **Step 5: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: guard websocket raw message size"
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

- 设计提交 `07ff9fd`。
- 计划提交。
- 实现提交。
- 红灯：config 缺少字段；oversized raw frame 返回 parse error。
- 绿灯：Server tests pass。
- 全量验证结果。
- 风险：WebSocket 库仍会接收 frame 到内存，64 KiB 可能影响极端大 output chunk，超限 frame 无法提取 sessionId。
- 后续：Agent output 分块、背压、评估 `maxPayload`。

- [ ] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record websocket raw message size guard delivery"
```

## Self-Review

- Spec coverage: 覆盖配置、parse 前 raw size guard、Agent/Mobile 两个入口、错误响应、验证和风险。
- Placeholder scan: 未使用 TBD/TODO/占位说明。
- Type consistency: `wsRawMessageMaxBytes`、`REMOTE_WS_RAW_MESSAGE_MAX_BYTES` 命名一致。
