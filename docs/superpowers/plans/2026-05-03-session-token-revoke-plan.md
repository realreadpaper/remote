# Session Token Revoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Mobile Forget device 同时撤销 Server 端 session token，旧 token 不能再打开终端。

**Architecture:** Server token store 增加 revoke 方法，HTTP 提供 `POST /session-tokens/revoke`。Mobile `PairingClient` 增加 revoke 调用，`TerminalScreen` Forget 先尝试 revoke，再执行本地清理。

**Tech Stack:** TypeScript, Fastify, React Native, Vitest.

---

## File Structure

```text
apps/server/src/auth/sessionTokens.ts
apps/server/src/ws.ts
apps/server/tests/auth/sessionTokens.test.ts
apps/server/tests/ws.test.ts
apps/mobile/src/protocol/pairingClient.ts
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/pairingClient.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Server token store revoke 红灯测试

**Files:**
- Modify: `apps/server/tests/auth/sessionTokens.test.ts`

- [x] **Step 1: Write failing tests**

覆盖：

- `revokeSessionToken()` 删除 token 后 verify invalid。
- JSON store revoke 后新实例也 verify invalid。
- deviceId 不匹配时抛错或返回错误。

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because revoke method does not exist.

## Task 2: Server token store revoke implementation

**Files:**
- Modify: `apps/server/src/auth/sessionTokens.ts`

- [x] **Step 1: Extend interface**

`SessionTokenStore` 增加 `revokeSessionToken()`。

- [x] **Step 2: Implement memory/json revoke**

Memory 删除 Map；JSON revoke 后写回文件。

- [x] **Step 3: Run green server auth tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 3: Server revoke API 红灯测试

**Files:**
- Modify: `apps/server/tests/ws.test.ts`

- [x] **Step 1: Write failing API test**

完成配对拿 token，调用 `POST /session-tokens/revoke`，再用旧 token 打开 session，期望 `Invalid session token`。

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because route does not exist.

## Task 4: Server revoke API implementation

**Files:**
- Modify: `apps/server/src/ws.ts`

- [x] **Step 1: Add body parser helper**

读取 `deviceId` 和 `sessionToken`。

- [x] **Step 2: Add route**

新增 `POST /session-tokens/revoke`。

- [x] **Step 3: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 5: Mobile revoke client 红灯测试

**Files:**
- Modify: `apps/mobile/tests/pairingClient.test.ts`

- [x] **Step 1: Write failing test**

`PairingClient.revokeSessionToken()` POST 到 `/session-tokens/revoke` 并返回 `{ revoked }`。

- [x] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: fail because method does not exist.

## Task 6: Mobile revoke implementation

**Files:**
- Modify: `apps/mobile/src/protocol/pairingClient.ts`
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [x] **Step 1: Implement client method**

新增 `revokeSessionToken()`。

- [x] **Step 2: Integrate Forget**

`handleForgetPairing()` 有 token 时先调用 revoke；失败时 append local line，但继续本地清理。

- [x] **Step 3: Verify mobile**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
```

- [x] **Step 4: Commit implementation**

```bash
git add apps/server/src/auth/sessionTokens.ts apps/server/src/ws.ts apps/server/tests/auth/sessionTokens.test.ts apps/server/tests/ws.test.ts apps/mobile/src/protocol/pairingClient.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/pairingClient.test.ts
git commit -m "feat: revoke session token on forget"
```

## Task 7: Full verification and record

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Update and commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record session token revoke delivery"
```

## Self-Review

- Spec coverage: 覆盖 store revoke、HTTP revoke、Mobile Forget 调用 revoke。
- Placeholder scan: 未发现占位项。
- Type consistency: `revokeSessionToken()`、`deviceId`、`sessionToken` 命名一致。
