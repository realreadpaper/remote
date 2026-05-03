# iOS Background Reconnection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile App 在前后台切换和 socket 异常断开后保留 session，并自动/手动恢复终端会话。

**Architecture:** `SessionClient` 提供连接状态和 retained session 查询；`TerminalScreen` 监听 React Native `AppState`，异常断线后保留同一个 client 自动重连一次，失败后展示手动 Reconnect。

**Tech Stack:** Expo React Native, TypeScript, Vitest, existing `SessionClient`.

---

## File Structure

```text
apps/mobile/src/protocol/sessionClient.ts
apps/mobile/tests/sessionClient.test.ts
apps/mobile/src/components/TerminalScreen.tsx
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/plans/2026-05-03-ios-background-reconnection-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: SessionClient state API TDD

**Files:**
- Modify: `apps/mobile/tests/sessionClient.test.ts`
- Modify: `apps/mobile/src/protocol/sessionClient.ts`

- [x] **Step 1: Write failing tests**

Add tests:

```ts
it("reports socket open state", () => {
  const { client, socket } = createClient();
  client.connect();
  expect(client.isSocketOpen()).toBe(true);
  socket.close();
  expect(client.isSocketOpen()).toBe(false);
});

it("reports retained session after socket close and clears it after explicit close", () => {
  const { client, socket } = createClient();
  client.connect();
  socket.receive(JSON.stringify({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" }));
  expect(client.hasRetainedSession()).toBe(true);
  socket.close();
  expect(client.hasRetainedSession()).toBe(true);
  client.close();
  expect(client.hasRetainedSession()).toBe(false);
});
```

- [x] **Step 2: Run red mobile tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: fail because methods do not exist.

- [x] **Step 3: Implement state API**

In `SessionClient`:

```ts
isSocketOpen(): boolean {
  const socket = this.socket;
  return Boolean(socket && socket.readyState === this.openReadyState(socket));
}

hasRetainedSession(): boolean {
  return Boolean(this.sessionId);
}
```

- [x] **Step 4: Run green mobile tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

## Task 2: TerminalScreen AppState and reconnect behavior

**Files:**
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [x] **Step 1: Import AppState**

Add `AppState` to React Native imports.

- [x] **Step 2: Add reconnect state**

Add:

```ts
const [appActive, setAppActive] = useState(true);
const [manualReconnectVisible, setManualReconnectVisible] = useState(false);
const autoReconnectAttemptedRef = useRef(false);
```

- [x] **Step 3: Preserve client on unexpected disconnect**

Change `onDisconnect` so it does not call `closeCurrentClient()`. Instead:

- set connected false.
- set connecting false.
- append local reason.
- if app active and auto reconnect not attempted, call `client.connect()`.
- else show manual reconnect.

- [x] **Step 4: Add AppState listener**

On foreground active:

- set appActive true.
- if existing client has retained session and is not open, call reconnect.

On background/inactive:

- set appActive false.
- do not close client.

- [x] **Step 5: Block input while backgrounded**

In `handleSend`, `sendRawInput`, and `sendSignal`, if `!appActive`, append local paused message and return.

- [x] **Step 6: Add Reconnect button**

Render a compact `Reconnect` button when `manualReconnectVisible` is true. Button calls retained client `connect()` or falls back to `handleConnect()`.

- [x] **Step 7: Run mobile typecheck/build**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build
```

## Task 3: Verification and delivery record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-ios-background-reconnection-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Commit implementation**

```bash
git add apps/mobile/src/protocol/sessionClient.ts apps/mobile/tests/sessionClient.test.ts apps/mobile/src/components/TerminalScreen.tsx
git commit -m "feat: handle mobile background reconnection"
```

- [x] **Step 3: Mark plan and log delivery**

Mark this plan and Task 13 complete. Append feature log with design, plan, implementation commits and verification.

- [x] **Step 4: Commit records**

```bash
git add docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-ios-background-reconnection-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record ios background reconnection delivery"
```

## Self-Review

- Spec coverage: 覆盖后台暂停输入、前台检查 socket、自动重连一次、手动重连、snapshot request 复用现有机制。
- Placeholder scan: 没有 TBD/TODO。
- Type consistency: `isSocketOpen()`、`hasRetainedSession()` 和 `manualReconnectVisible` 命名一致。
