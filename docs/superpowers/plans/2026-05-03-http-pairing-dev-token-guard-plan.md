# HTTP Pairing Dev Token Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 HTTP pairing/status/revoke 接口在 `REMOTE_REQUIRE_DEV_TOKEN=1` 时与 WebSocket 一样受 dev token 保护，并让 Mobile 自动携带 token。

**Architecture:** Server 复用现有 dev token parser/validator，为 HTTP route 增加 guard。Mobile `PairingClient` 增加 `devToken` option，所有 HTTP 请求统一加 Authorization header。

**Tech Stack:** TypeScript, Fastify, React Native, Vitest.

---

## File Structure

```text
apps/server/src/ws.ts
apps/server/tests/ws.test.ts
apps/mobile/src/protocol/pairingClient.ts
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/pairingClient.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Server HTTP guard 红灯测试

**Files:**
- Modify: `apps/server/tests/ws.test.ts`

- [ ] **Step 1: Write failing tests**

覆盖：

- `POST /pairing/requests` require token 时无 token 返回 401。
- `GET /pairing/requests/:id` require token 时无 token 返回 401。
- `POST /session-tokens/revoke` require token 时无 token 返回 401。
- 正确 token 可访问 HTTP pairing/revoke。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because HTTP routes are still anonymous.

## Task 2: Server HTTP guard implementation

**Files:**
- Modify: `apps/server/src/ws.ts`

- [ ] **Step 1: Add HTTP auth helper**

新增 `isAuthorizedHttpRequest()`。

- [ ] **Step 2: Guard routes**

保护：

- `GET /pairing/bindings`
- `GET /pairing/requests/:pairingRequestId`
- `POST /pairing/requests`
- `POST /session-tokens/revoke`

- [ ] **Step 3: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 3: Mobile PairingClient header 红灯测试

**Files:**
- Modify: `apps/mobile/tests/pairingClient.test.ts`

- [ ] **Step 1: Write failing tests**

覆盖：

- `requestPairing()` with `devToken` sends Authorization.
- `getPairingRequest()` with `devToken` sends Authorization.
- `revokeSessionToken()` with `devToken` sends Authorization.

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: fail because PairingClient does not support devToken.

## Task 4: Mobile PairingClient implementation

**Files:**
- Modify: `apps/mobile/src/protocol/pairingClient.ts`
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [ ] **Step 1: Add option and headers**

`PairingClientOptions` 增加 `devToken?: string | null`，并统一构造 headers。

- [ ] **Step 2: TerminalScreen passes devToken**

所有 `new PairingClient()` 都传入 `runtimeConfig.devToken`。

- [ ] **Step 3: Verify mobile**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
```

- [ ] **Step 4: Commit implementation**

```bash
git add apps/server/src/ws.ts apps/server/tests/ws.test.ts apps/mobile/src/protocol/pairingClient.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/pairingClient.test.ts
git commit -m "feat: guard http pairing with dev token"
```

## Task 5: Full verification and record

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record http pairing dev token guard delivery"
```

## Self-Review

- Spec coverage: 覆盖 Server HTTP guard、Mobile Authorization header、TerminalScreen devToken 传入。
- Placeholder scan: 未发现占位项。
- Type consistency: `devToken`、`Authorization`、`isAuthorizedHttpRequest()` 命名一致。
