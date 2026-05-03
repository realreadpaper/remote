# Server Pairing State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Server 内实现开发态内存配对状态机，打通 Agent 创建配对码、Mobile 提交配对请求、Agent approve/reject 和绑定记录。

**Architecture:** 新增 `pairingStore` 作为内存状态容器，新增 `pairingService` 封装配对码、请求、绑定状态转换。`ws.ts` 只负责协议接入和路由：Agent WebSocket 处理配对消息，HTTP `POST /pairing/requests` 处理 Mobile 提交配对码。

**Tech Stack:** TypeScript, Fastify, WebSocket, Zod protocol schemas, Vitest.

---

## File Structure

```text
apps/server/src/pairing/pairingStore.ts
apps/server/src/pairing/pairingService.ts
apps/server/src/ws.ts
apps/server/tests/pairing/pairingService.test.ts
apps/server/tests/ws.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Pairing service 红灯测试

**Files:**
- Create: `apps/server/tests/pairing/pairingService.test.ts`

- [x] **Step 1: Write failing tests**

覆盖：

- 创建配对码。
- 过期码提交失败。
- 重复使用失败。
- Agent 拒绝请求后状态为 rejected。
- Agent approve 后创建 binding。

- [x] **Step 2: Run red test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `pairingService.ts` does not exist.

## Task 2: Pairing service 实现

**Files:**
- Create: `apps/server/src/pairing/pairingStore.ts`
- Create: `apps/server/src/pairing/pairingService.ts`

- [x] **Step 1: Implement store types**

定义 `PairingCodeRecord`、`PairingRequestRecord`、`DeviceBindingRecord` 和 `MemoryPairingStore`。

- [x] **Step 2: Implement service**

实现：

- `createPairingCode(input)`
- `requestPairing(input)`
- `approvePairingRequest(input)`
- `rejectPairingRequest(input)`
- `listBindings()`

- [x] **Step 3: Run green service tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: service tests pass.

## Task 3: WebSocket 和 HTTP 接入

**Files:**
- Modify: `apps/server/src/ws.ts`
- Modify: `apps/server/tests/ws.test.ts`

- [x] **Step 1: Write failing integration tests**

覆盖：

- Agent 注册后发送 `pairing.create` 收到 `pairing.created`。
- `POST /pairing/requests` 后 Agent 收到 `pairing.requested`。
- Agent approve 后 `GET /pairing/bindings` 返回 binding。

- [x] **Step 2: Run red integration tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because routes are not wired.

- [x] **Step 3: Wire routes**

在 `registerWsRoutes` 中创建 `MemoryPairingStore` 和 `PairingService`。

新增：

- `POST /pairing/requests`
- `GET /pairing/bindings`

Agent socket 注册后支持配对消息。

- [x] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: all server tests pass.

## Task 4: 全量验证和提交

**Files:**
- Create: `apps/server/src/pairing/pairingStore.ts`
- Create: `apps/server/src/pairing/pairingService.ts`
- Modify: `apps/server/src/ws.ts`
- Create: `apps/server/tests/pairing/pairingService.test.ts`
- Modify: `apps/server/tests/ws.test.ts`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Commit**

```bash
git add apps/server/src/pairing/pairingStore.ts apps/server/src/pairing/pairingService.ts apps/server/src/ws.ts apps/server/tests/pairing/pairingService.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: add device pairing state machine"
```

## Task 5: 完成记录

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Update feature log**

记录提交、验证命令、风险和下一步 Mobile 配对 UI / Agent 配对确认。

- [x] **Step 2: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record server pairing state machine delivery"
```
