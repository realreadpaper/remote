# Terminal Signal Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用明确的 `terminal.signal` 协议消息承载 `Ctrl+C`/EOF 等终端信号动作，避免继续把 `Ctrl+C` 伪装成普通 input 字节。

**Architecture:** `packages/protocol` 增加 `terminal.signal` client schema；Server 把它作为 Mobile -> Agent routable message 转发；Agent 将 `SIGINT`/`EOF` 映射为 PTY 控制字节；Mobile `SessionClient` 增加 `sendTerminalSignal()`，`Ctrl+C` shortcut 改发 signal action。

**Tech Stack:** TypeScript, Zod, Fastify WebSocket, node-pty adapter, Expo React Native, Vitest.

---

## File Structure

```text
packages/protocol/src/messages.ts
packages/protocol/tests/messages.test.ts
apps/server/src/sessionHub.ts
apps/server/src/ws.ts
apps/server/tests/sessionHub.test.ts
apps/server/tests/ws.test.ts
apps/agent/src/terminalSession.ts
apps/agent/src/agentClient.ts
apps/agent/tests/terminalSession.test.ts
apps/agent/tests/agentClient.test.ts
apps/mobile/src/protocol/sessionClient.ts
apps/mobile/src/components/terminalShortcuts.ts
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/sessionClient.test.ts
apps/mobile/tests/terminalShortcuts.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Protocol 红灯与实现

**Files:**
- Modify: `packages/protocol/tests/messages.test.ts`
- Modify: `packages/protocol/src/messages.ts`

- [ ] **Step 1: Write failing protocol tests**

新增：

```ts
it("parses terminal signal messages", () => {
  expect(parseClientMessage({ type: "terminal.signal", sessionId: "session-1", signal: "SIGINT" })).toEqual({
    type: "terminal.signal",
    sessionId: "session-1",
    signal: "SIGINT"
  });
  expect(parseClientMessage({ type: "terminal.signal", sessionId: "session-1", signal: "EOF" })).toEqual({
    type: "terminal.signal",
    sessionId: "session-1",
    signal: "EOF"
  });
});

it("rejects invalid terminal signal messages", () => {
  expect(() => parseClientMessage({ type: "terminal.signal", sessionId: "session-1" })).toThrow();
  expect(() => parseClientMessage({ type: "terminal.signal", sessionId: "session-1", signal: "SIGKILL" })).toThrow();
});
```

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test
```

Expected: fail because `terminal.signal` is not in `ClientMessageSchema`.

- [ ] **Step 3: Implement protocol schema**

在 `ClientMessageSchema` 的 terminal messages 附近加入：

```ts
message({
  type: z.literal("terminal.signal"),
  sessionId: z.string().min(1),
  signal: z.enum(["SIGINT", "EOF"])
})
```

- [ ] **Step 4: Run green protocol tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test
```

## Task 2: Server route 红灯与实现

**Files:**
- Modify: `apps/server/tests/sessionHub.test.ts`
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/sessionHub.ts`
- Modify: `apps/server/src/ws.ts`

- [ ] **Step 1: Write failing server tests**

在 `sessionHub.test.ts` 增加 signal routes from mobile to agent。

在 `ws.test.ts` 增加：

- Mobile 发送 `terminal.signal SIGINT` 后 Agent 收到同一 message。
- `terminal.signal` 在 input byte limit 已耗尽后仍可路由。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because server does not treat `terminal.signal` as routable.

- [ ] **Step 3: Implement server routing**

- `MobileRoutableMessage` 加入 `terminal.signal`。
- `AgentSendCallback` 加入 `terminal.signal`。
- `SessionHub.AgentSend` union 加入 `terminal.signal`。
- `routeFromMobile()` 接收 `terminal.input | terminal.resize | terminal.signal`。
- `isMobileRoutableMessage()` 返回 true when `message.type === "terminal.signal"`。
- 保持 `assertTerminalInputSize()` 和 input byte limiter 只处理 `terminal.input`。

- [ ] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 3: Agent 红灯与实现

**Files:**
- Modify: `apps/agent/tests/terminalSession.test.ts`
- Modify: `apps/agent/tests/agentClient.test.ts`
- Modify: `apps/agent/src/terminalSession.ts`
- Modify: `apps/agent/src/agentClient.ts`

- [ ] **Step 1: Write failing Agent tests**

覆盖：

- `TerminalSession.sendSignal("SIGINT")` 写入 `\x03`。
- `TerminalSession.sendSignal("EOF")` 写入 `\x04`。
- `AgentClient` 收到 `terminal.signal` 后调用 session signal。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: fail because `sendSignal()` and AgentClient handling do not exist.

- [ ] **Step 3: Implement Agent signal handling**

- `TerminalSession` 新增 `sendSignal(signal: "SIGINT" | "EOF")`。
- `SIGINT` 写入 `\x03`。
- `EOF` 写入 `\x04`。
- `AgentClient.handleMessage()` 增加 `terminal.signal` branch。
- 新增 `handleTerminalSignal()` 调用当前 session `sendSignal()`。

- [ ] **Step 4: Run green Agent tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

## Task 4: Mobile 红灯与实现

**Files:**
- Modify: `apps/mobile/tests/sessionClient.test.ts`
- Modify: `apps/mobile/tests/terminalShortcuts.test.ts`
- Modify: `apps/mobile/src/protocol/sessionClient.ts`
- Modify: `apps/mobile/src/components/terminalShortcuts.ts`
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [ ] **Step 1: Write failing Mobile tests**

覆盖：

- `SessionClient.sendTerminalSignal("SIGINT")` 发送 `terminal.signal`。
- 未打开 session 时 signal 抛出明确错误。
- `Ctrl+C` shortcut 是 signal action，其他快捷键是 input action。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: fail because Mobile has no signal API/action.

- [ ] **Step 3: Implement Mobile signal sending**

- `SessionClient` 新增 `sendTerminalSignal(signal: "SIGINT" | "EOF")`。
- `terminalShortcuts.ts` 把 shortcut 从 `{ label, payload }` 改为 discriminated action：

```ts
type TerminalShortcut =
  | { label: string; type: "input"; payload: string }
  | { label: string; type: "signal"; signal: "SIGINT" | "EOF" };
```

- `Ctrl+C` 使用 `{ label: "Ctrl+C", type: "signal", signal: "SIGINT" }`。
- `TerminalScreen` 点击 signal shortcut 时调用 `client.sendTerminalSignal()`.

- [ ] **Step 4: Run green Mobile tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

## Task 5: Full verification and record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-03-terminal-signal-message-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Commit implementation**

```bash
git add packages/protocol/src/messages.ts packages/protocol/tests/messages.test.ts apps/server/src/sessionHub.ts apps/server/src/ws.ts apps/server/tests/sessionHub.test.ts apps/server/tests/ws.test.ts apps/agent/src/terminalSession.ts apps/agent/src/agentClient.ts apps/agent/tests/terminalSession.test.ts apps/agent/tests/agentClient.test.ts apps/mobile/src/protocol/sessionClient.ts apps/mobile/src/components/terminalShortcuts.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/sessionClient.test.ts apps/mobile/tests/terminalShortcuts.test.ts
git commit -m "feat: route terminal signal messages"
```

- [ ] **Step 3: Mark completed plan steps**

把本计划执行过且验证通过的步骤改为 `- [x]`。

- [ ] **Step 4: Record delivery**

在 `docs/superpowers/records/feature-log.md` 追加设计提交、计划提交、实现提交、TDD 红绿记录、验证结果和风险。

- [ ] **Step 5: Commit record**

```bash
git add docs/superpowers/plans/2026-05-03-terminal-signal-message-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record terminal signal message delivery"
```

## Self-Review

- Spec coverage: 覆盖协议、Server 转发、Agent PTY 映射、Mobile Ctrl+C 行为和验证。
- Placeholder scan: 未使用占位词或未完成说明。
- Type consistency: `terminal.signal`、`SIGINT`、`EOF` 在协议、Server、Agent、Mobile 中一致。
