# Mobile Manual Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Mobile 端新增手动输入配对码入口，调用 Server `POST /pairing/requests`，为 iOS 真机配对链路提供最小可用入口。

**Architecture:** `runtimeConfig` 负责提供 API base URL 和 mobile client identity；`pairingClient` 封装 HTTP 请求与响应校验；`TerminalScreen` 增加一个紧凑配对面板，提交成功后展示 pending 状态。

**Tech Stack:** Expo React Native, TypeScript, Vitest, Fetch API.

---

## File Structure

```text
apps/mobile/src/config/runtimeConfig.ts
apps/mobile/src/protocol/pairingClient.ts
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/runtimeConfig.test.ts
apps/mobile/tests/pairingClient.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Runtime config 红灯测试

**Files:**
- Modify: `apps/mobile/tests/runtimeConfig.test.ts`

- [x] **Step 1: Write failing tests**

覆盖：

- 默认 `apiBaseUrl` 从 `ws://127.0.0.1:8787/ws/mobile` 推导为 `http://127.0.0.1:8787`。
- `wss://relay.example.test/ws/mobile` 推导为 `https://relay.example.test`。
- `EXPO_PUBLIC_REMOTE_API_URL` 可覆盖推导。
- 默认 `mobileClientId` 为 `mobile-dev`，默认 `mobileName` 为 `iPhone`。

- [x] **Step 2: Run red test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: fail because config does not expose API fields.

## Task 2: Runtime config 实现

**Files:**
- Modify: `apps/mobile/src/config/runtimeConfig.ts`

- [x] **Step 1: Add fields**

新增：

- `apiBaseUrl`
- `displayApiBaseUrl`
- `mobileClientId`
- `mobileName`

- [x] **Step 2: Run green test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

## Task 3: Pairing client TDD

**Files:**
- Create: `apps/mobile/src/protocol/pairingClient.ts`
- Create: `apps/mobile/tests/pairingClient.test.ts`

- [x] **Step 1: Write failing tests**

覆盖：

- 成功 POST `/pairing/requests` 并返回 pending。
- HTTP 400 使用 `{ error }`。
- 响应缺少 `pairingRequestId` 失败。

- [x] **Step 2: Run red test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

- [x] **Step 3: Implement pairing client**

导出：

- `PairingClient`
- `PairingRequestResult`

- [x] **Step 4: Run green test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

## Task 4: TerminalScreen 手动配对入口

**Files:**
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [x] **Step 1: Add UI state**

新增 pairing code、pairing status、pairing error state。

- [x] **Step 2: Add compact panel**

放在 header 和 error banner 之间，包含输入框和 `Pair` 按钮。

- [x] **Step 3: Wire submit**

调用 `PairingClient.requestPairing()`，成功后显示 pending 并 append local output。

- [x] **Step 4: Run mobile tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

## Task 5: 全量验证和提交

**Files:**
- Modify: `apps/mobile/src/config/runtimeConfig.ts`
- Create: `apps/mobile/src/protocol/pairingClient.ts`
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`
- Modify: `apps/mobile/tests/runtimeConfig.test.ts`
- Create: `apps/mobile/tests/pairingClient.test.ts`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/src/config/runtimeConfig.ts apps/mobile/src/protocol/pairingClient.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/runtimeConfig.test.ts apps/mobile/tests/pairingClient.test.ts
git commit -m "feat: add mobile manual pairing flow"
```

## Task 6: 完成记录

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Update feature log**

记录提交、验证命令、风险和下一步扫码/secure storage。

- [x] **Step 2: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record mobile manual pairing delivery"
```
