# Session Token Binding Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让配对批准真正控制终端访问：Server 发放短期 `sessionToken`，Mobile 保存并携带 token，Server 校验后才允许 `session.open`。

**Architecture:** Server 新增内存 `SessionTokenStore`，在 Agent approve 后生成 token，并通过 `GET /pairing/requests/:id` 暴露配对状态和 token。Mobile 的 `PairingClient` 轮询该状态，`SessionClient` 在打开 WebSocket 会话时携带 token。

**Tech Stack:** TypeScript, Fastify, ws, React Native, Vitest, pnpm workspace.

---

## File Structure

```text
apps/server/src/auth/sessionTokens.ts
apps/server/src/ws.ts
apps/server/tests/auth/sessionTokens.test.ts
apps/server/tests/ws.test.ts
apps/mobile/src/protocol/pairingClient.ts
apps/mobile/src/protocol/sessionClient.ts
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/pairingClient.test.ts
apps/mobile/tests/sessionClient.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Server token store 红灯测试

**Files:**
- Create: `apps/server/tests/auth/sessionTokens.test.ts`

- [x] **Step 1: Write failing tests**

覆盖：

- `issueSessionToken()` 返回 token、deviceId、mobileClientId、bindingId、issuedAt、expiresAt。
- `verifySessionToken()` 接受正确 token 和 deviceId。
- `verifySessionToken()` 拒绝错误 token。
- `verifySessionToken()` 拒绝过期 token。
- `verifySessionToken()` 拒绝设备不匹配 token。

- [x] **Step 2: Run red test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `apps/server/src/auth/sessionTokens.ts` does not exist.

## Task 2: Server token store 实现

**Files:**
- Create: `apps/server/src/auth/sessionTokens.ts`

- [x] **Step 1: Implement token store**

导出：

- `SessionTokenRecord`
- `IssueSessionTokenInput`
- `SessionTokenVerificationResult`
- `MemorySessionTokenStore`

默认 TTL 为 `24 * 60 * 60_000`。

- [x] **Step 2: Run green server auth tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

## Task 3: Server 配对状态和 session.open 鉴权红灯测试

**Files:**
- Modify: `apps/server/tests/ws.test.ts`

- [x] **Step 1: Write failing websocket/API tests**

覆盖：

- approved pairing request status returns `auth.sessionToken`。
- pending pairing request status returns pending。
- rejected pairing request status returns rejected reason。
- `session.open` without token returns `session.error`。
- `session.open` with invalid token returns `session.error`。
- `session.open` with valid token opens a session。
- token for another device is rejected。

- [x] **Step 2: Run red server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because routes and validation are not implemented.

## Task 4: Server route and session.open 实现

**Files:**
- Modify: `apps/server/src/ws.ts`

- [x] **Step 1: Instantiate token store**

在 `registerWsRoutes()` 中创建 `MemorySessionTokenStore`。

- [x] **Step 2: Generate token on approve**

`pairing.approved` 后：

- 调用 `pairing.approvePairingRequest()` 得到 binding。
- 调用 `sessionTokens.issueSessionToken()` 生成 token。
- 建立 `pairingRequestId -> token` 映射，供状态查询使用。

- [x] **Step 3: Add request status route**

新增：

```text
GET /pairing/requests/:pairingRequestId
```

返回 pending/rejected/approved。

- [x] **Step 4: Enforce token on session.open**

`session.open` 前调用 `sessionTokens.verifySessionToken()`，失败时抛出明确错误。

- [x] **Step 5: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [x] **Step 6: Commit server implementation**

```bash
git add apps/server/src/auth/sessionTokens.ts apps/server/src/ws.ts apps/server/tests/auth/sessionTokens.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: enforce session token binding on server"
```

## Task 5: Mobile PairingClient 和 SessionClient 红灯测试

**Files:**
- Modify: `apps/mobile/tests/pairingClient.test.ts`
- Modify: `apps/mobile/tests/sessionClient.test.ts`

- [x] **Step 1: Write failing PairingClient tests**

覆盖：

- `getPairingRequest()` 解析 pending。
- `getPairingRequest()` 解析 approved 和 `auth.sessionToken`。
- `getPairingRequest()` 解析 rejected reason。
- `waitForApproval()` 在 approved 时返回 auth。
- `waitForApproval()` 在 rejected 时抛错。

- [x] **Step 2: Write failing SessionClient test**

覆盖：

- options 有 `sessionToken` 时，socket open 发送带 token 的 `session.open`。
- options 无 `sessionToken` 时，保持现有不带 token 的 `session.open`。

- [x] **Step 3: Run red mobile tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: fail because client methods/options are not implemented.

## Task 6: Mobile protocol client 实现

**Files:**
- Modify: `apps/mobile/src/protocol/pairingClient.ts`
- Modify: `apps/mobile/src/protocol/sessionClient.ts`

- [x] **Step 1: Implement PairingClient status types**

新增：

- `PairingRequestStatusResult`
- `ApprovedPairingRequestResult`
- `PendingPairingRequestResult`
- `RejectedPairingRequestResult`
- `WaitForApprovalOptions`

- [x] **Step 2: Implement getPairingRequest**

调用 `GET /pairing/requests/:id` 并严格解析 pending/approved/rejected。

- [x] **Step 3: Implement waitForApproval**

轮询直到 approved/rejected/timeout。

- [x] **Step 4: Implement SessionClient sessionToken option**

`SessionClientOptions` 增加 `sessionToken?: string | null`，发送 `session.open` 时有 token 则带上。

- [x] **Step 5: Run green mobile protocol tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: mobile tests pass.

## Task 7: Mobile UI 接入

**Files:**
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [x] **Step 1: Store token in component state**

新增 `sessionToken` state，初始为 `null`。

- [x] **Step 2: Pairing submit waits for approval**

提交 pairing request 后调用 `waitForApproval()`；approved 时保存 token 并显示 paired，rejected/timeout 显示错误。

- [x] **Step 3: Pass token to SessionClient**

创建 `SessionClient` 时传入 `sessionToken`。

- [x] **Step 4: Run mobile test/typecheck**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
```

Expected: pass.

- [x] **Step 5: Commit mobile implementation**

```bash
git add apps/mobile/src/protocol/pairingClient.ts apps/mobile/src/protocol/sessionClient.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/pairingClient.test.ts apps/mobile/tests/sessionClient.test.ts
git commit -m "feat: carry session token from mobile pairing"
```

## Task 8: Full verification and record

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Update feature log**

记录：

- design commit。
- server implementation commit。
- mobile implementation commit。
- verification output。
- known risks：内存 token、Mobile 内存保存、无 refresh/revoke、无账号。
- next：SecureStore、持久化 binding/token、设备列表。

- [x] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record session token binding delivery"
```

## Self-Review

- Spec coverage: 覆盖 Server token 发放、配对状态查询、`session.open` 校验、Mobile 轮询、Mobile 携带 token。
- Placeholder scan: 未发现占位项。
- Type consistency: plan 中 `sessionToken`、`auth.sessionToken`、`pairingRequestId`、`deviceId` 与现有协议字段一致。
