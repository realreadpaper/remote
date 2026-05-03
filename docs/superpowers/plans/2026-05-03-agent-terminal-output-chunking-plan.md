# Agent Terminal Output Chunking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent 将大块 PTY 输出拆成多条 `terminal.output`，避免单条 WebSocket message 超过 Server raw size guard。

**Architecture:** `AgentConfig` 增加 `terminalOutputChunkBytes`。`AgentClient` 增加 UTF-8 安全分块 helper，在 `session.onOutput()` 中按配置拆分并按顺序发送多条 `terminal.output`。

**Tech Stack:** TypeScript, Node Buffer, Vitest.

---

## File Structure

```text
apps/agent/src/config.ts
apps/agent/src/agentClient.ts
apps/agent/tests/config.test.ts
apps/agent/tests/agentClient.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Agent config 红灯与实现

**Files:**
- Modify: `apps/agent/tests/config.test.ts`
- Modify: `apps/agent/src/config.ts`

- [ ] **Step 1: Write failing config tests**

在 explicit env 测试中设置：

```ts
process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES = "4096";
```

期望 `loadAgentConfig()` 返回：

```ts
terminalOutputChunkBytes: 4_096
```

在 defaults 测试中期望：

```ts
terminalOutputChunkBytes: 16_384
```

新增非法值测试：

```ts
it("rejects invalid terminal output chunk bytes", () => {
  process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES = "0";
  expect(() => loadAgentConfig()).toThrow("REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES must be a positive integer");

  process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES = "abc";
  expect(() => loadAgentConfig()).toThrow("REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES must be a positive integer");
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test -- apps/agent/tests/config.test.ts
```

Expected: fail because `AgentConfig` does not expose `terminalOutputChunkBytes`.

- [ ] **Step 3: Implement config**

在 `AgentConfig` 增加：

```ts
terminalOutputChunkBytes: number;
```

在 `loadAgentConfig()` 返回：

```ts
terminalOutputChunkBytes: parsePositiveIntegerEnv(
  process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES,
  16_384,
  "REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES"
)
```

新增 helper：

```ts
function parsePositiveIntegerEnv(rawValue: string | undefined, defaultValue: number, envName: string): number {
  const normalized = normalizeOptional(rawValue);
  if (!normalized) {
    return defaultValue;
  }

  const value = Number(normalized);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${envName} must be a positive integer`);
  }

  return value;
}
```

- [ ] **Step 4: Run green config tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test -- apps/agent/tests/config.test.ts
```

Expected: config tests pass.

## Task 2: AgentClient output chunking 红灯与实现

**Files:**
- Modify: `apps/agent/tests/agentClient.test.ts`
- Modify: `apps/agent/src/agentClient.ts`

- [ ] **Step 1: Write failing AgentClient tests**

确认 `createHarness()` 的默认 config 增加：

```ts
terminalOutputChunkBytes: 16_384
```

新增 ASCII 分块测试：

```ts
it("splits large terminal output into configured byte chunks", () => {
  const { socket, terminals } = createHarness({ config: { terminalOutputChunkBytes: 4 } });

  socket.emit(
    "message",
    encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
  );
  terminals.get("session-1")?.emitOutput("abcdef");

  expect(socket.sent.map((message) => parseServerMessage(JSON.parse(message)))).toEqual([
    {
      type: "terminal.output",
      sessionId: "session-1",
      stream: "stdout",
      data: "abcd"
    },
    {
      type: "terminal.output",
      sessionId: "session-1",
      stream: "stdout",
      data: "ef"
    }
  ]);
});
```

新增 UTF-8 分块测试：

```ts
it("splits terminal output by UTF-8 bytes without breaking characters", () => {
  const { socket, terminals } = createHarness({ config: { terminalOutputChunkBytes: 4 } });

  socket.emit(
    "message",
    encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
  );
  terminals.get("session-1")?.emitOutput("你好");

  expect(socket.sent.map((message) => parseServerMessage(JSON.parse(message)))).toEqual([
    {
      type: "terminal.output",
      sessionId: "session-1",
      stream: "stdout",
      data: "你"
    },
    {
      type: "terminal.output",
      sessionId: "session-1",
      stream: "stdout",
      data: "好"
    }
  ]);
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test -- apps/agent/tests/agentClient.test.ts
```

Expected: fail because AgentClient sends one terminal.output per PTY output.

- [ ] **Step 3: Implement chunking**

在 `apps/agent/src/agentClient.ts` 新增 helper：

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

更新 `session.onOutput()`：

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

- [ ] **Step 4: Run green agent tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: agent tests pass.

- [ ] **Step 5: Commit implementation**

```bash
git add apps/agent/src/config.ts apps/agent/src/agentClient.ts apps/agent/tests/config.test.ts apps/agent/tests/agentClient.test.ts
git commit -m "feat: chunk agent terminal output"
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

- 设计提交 `a893f3e`。
- 计划提交。
- 实现提交。
- 红灯：config 缺少字段；AgentClient output 未拆分。
- 绿灯：Agent tests pass。
- 全量验证结果。
- 风险：没有背压、用户可配置过大、单字符超过 chunk 时仍单独发送。
- 后续：Agent output 背压、Server Agent output 速率限制、文件/日志专用通道。

- [ ] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record agent terminal output chunking delivery"
```

## Self-Review

- Spec coverage: 覆盖 Agent 配置、UTF-8 分块、顺序发送、小输出兼容和验证。
- Placeholder scan: 未使用 TBD/TODO/占位说明。
- Type consistency: `terminalOutputChunkBytes`、`REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES` 命名一致。
