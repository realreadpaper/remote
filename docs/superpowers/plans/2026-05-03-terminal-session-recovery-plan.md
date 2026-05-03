# Terminal Session Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile WebSocket 断开后保留 Agent PTY，并允许 Mobile 重新连接同一 `sessionId` 后请求最近输出 snapshot。

**Architecture:** 协议给 `session.open` 增加 `resumeSessionId`；Server `SessionHub` 支持 session rebind 和 snapshot request 转发；Agent `TerminalSession` 保存最近输出环形缓冲并返回 snapshot；Mobile `SessionClient` 在 reconnect 时携带旧 session id 并在 opened 后请求 snapshot。

**Tech Stack:** TypeScript, Zod, Fastify WebSocket, Vitest, node-pty adapter, Expo React Native.

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
apps/mobile/tests/sessionClient.test.ts
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Protocol resumeSessionId 红灯与实现

**Files:**
- Modify: `packages/protocol/tests/messages.test.ts`
- Modify: `packages/protocol/src/messages.ts`

- [x] **Step 1: Write failing protocol test**

新增测试：`session.open` accepts optional `resumeSessionId`.

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test
```

Expected: fail because `resumeSessionId` is rejected as an extra field.

- [x] **Step 3: Implement schema**

`session.open` 增加：

```ts
resumeSessionId: z.string().min(1).optional()
```

- [x] **Step 4: Run green protocol test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test
```

## Task 2: Server recovery 红灯与实现

**Files:**
- Modify: `apps/server/tests/sessionHub.test.ts`
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/sessionHub.ts`
- Modify: `apps/server/src/ws.ts`

- [x] **Step 1: Write failing SessionHub tests**

覆盖：

- `closeMobile()` does not send `terminal.close` and keeps session recoverable.
- `openSession(deviceId, mobileSend, { resumeSessionId })` rebinds old session without notifying Agent.
- wrong device resume throws.
- `terminal.snapshot.request` routes from restored Mobile to Agent.

- [x] **Step 2: Run red server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because close removes sessions and resume option does not exist.

- [x] **Step 3: Implement SessionHub recovery**

- `SessionRecord.mobileSend` becomes `MobileSend | null`.
- `openSession(deviceId, mobileSend, options?)` supports `resumeSessionId`.
- New private `resumeSession()` updates `mobileSend` and returns existing session.
- `closeMobile()` sets `mobileSend = null` for owned sessions and does not send `terminal.close`.
- `routeFromAgent()` drops output when `mobileSend` is null; deletes session on `terminal.exit`.
- `MobileRoutableMessage` includes `terminal.snapshot.request`.

- [x] **Step 4: Implement ws session.open resume**

In `/ws/mobile`, pass:

```ts
const session = hub.openSession(message.deviceId, mobileSend, { resumeSessionId: message.resumeSessionId });
```

- [x] **Step 5: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 3: Agent snapshot 红灯与实现

**Files:**
- Modify: `apps/agent/tests/terminalSession.test.ts`
- Modify: `apps/agent/tests/agentClient.test.ts`
- Modify: `apps/agent/src/terminalSession.ts`
- Modify: `apps/agent/src/agentClient.ts`

- [x] **Step 1: Write failing TerminalSession tests**

覆盖：

- output buffer stores recent output.
- buffer keeps last N chunks.
- resize updates snapshot cols/rows.
- exit updates alive/exitCode.

- [x] **Step 2: Write failing AgentClient test**

收到 `terminal.snapshot.request` 后发送 `terminal.snapshot`。

- [x] **Step 3: Run red Agent tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: fail because snapshot methods and request handling do not exist.

- [x] **Step 4: Implement TerminalSession snapshot**

- constructor supports optional `{ maxSnapshotChunks?: number; cols?: number; rows?: number }`.
- `onOutput()` wraps callback to push output chunks.
- `snapshot(deviceId)` returns `terminal.snapshot`.
- `resize()` updates stored dimensions.
- `onExit()` wraps callback to set alive false and exitCode.

- [x] **Step 5: Implement AgentClient snapshot request**

- Add `terminal.snapshot.request` branch.
- Send `session.snapshot(config.deviceId)` if session exists.

- [x] **Step 6: Run green Agent tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

## Task 4: Mobile reconnect snapshot 红灯与实现

**Files:**
- Modify: `apps/mobile/tests/sessionClient.test.ts`
- Modify: `apps/mobile/src/protocol/sessionClient.ts`

- [x] **Step 1: Write failing Mobile tests**

覆盖：

- socket close keeps previous session id.
- reconnect sends `session.open` with `resumeSessionId`.
- receiving `session.opened` sends `terminal.snapshot.request`.
- `close()` clears session id so next connect creates a fresh session.

- [x] **Step 2: Run red Mobile tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: fail because close clears session id and no snapshot request is sent.

- [x] **Step 3: Implement Mobile recovery**

- `connect()` keeps existing `sessionId` and sends it as `resumeSessionId`.
- `handleDisconnect()` no longer clears `sessionId`.
- `close()` clears session id after closing socket.
- On `session.opened`, set `sessionId` and immediately send `terminal.snapshot.request`.

- [x] **Step 4: Run green Mobile tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

## Task 5: Full verification and delivery record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-03-terminal-session-recovery-plan.md`
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Commit implementation**

```bash
git add packages/protocol/src/messages.ts packages/protocol/tests/messages.test.ts apps/server/src/sessionHub.ts apps/server/src/ws.ts apps/server/tests/sessionHub.test.ts apps/server/tests/ws.test.ts apps/agent/src/terminalSession.ts apps/agent/src/agentClient.ts apps/agent/tests/terminalSession.test.ts apps/agent/tests/agentClient.test.ts apps/mobile/src/protocol/sessionClient.ts apps/mobile/tests/sessionClient.test.ts
git commit -m "feat: support terminal session recovery"
```

- [x] **Step 3: Mark completed plan steps**

Mark this plan and Task 9 in `2026-05-02-ios-mac-installable-mvp-plan.md` as complete.

- [x] **Step 4: Record delivery**

Append feature log with design commit, plan commit, implementation commit, TDD red/green, verification, risks.

- [x] **Step 5: Commit record**

```bash
git add docs/superpowers/plans/2026-05-03-terminal-session-recovery-plan.md docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record terminal session recovery delivery"
```

## Self-Review

- Spec coverage: 覆盖 resumeSessionId、Server rebind、Server 5 分钟 detached retention、Agent snapshot、Agent -> Mobile snapshot route、Mobile reconnect request。
- Placeholder scan: 未使用占位词或未完成说明。
- Type consistency: `resumeSessionId`、`terminal.snapshot.request`、`terminal.snapshot` 命名与协议一致。
