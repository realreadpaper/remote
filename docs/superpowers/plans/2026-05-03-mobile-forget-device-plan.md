# Mobile Forget Device Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Mobile 用户能主动清除本机已保存配对 token，并回到可重新配对状态。

**Architecture:** 复用现有 `clearPairingToken()` 和 `TerminalScreen` 状态。新增 `pairedDeviceId` UI 状态和 `Forget` 按钮；点击后清除 SecureStore、关闭当前 session、清空 token。

**Tech Stack:** TypeScript, React Native, Expo SecureStore, Vitest.

---

## File Structure

```text
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/pairingTokenStore.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Store clear idempotency 红灯测试

**Files:**
- Modify: `apps/mobile/tests/pairingTokenStore.test.ts`

- [ ] **Step 1: Write test**

新增测试：连续调用 `clearPairingToken()` 两次不会抛错，并调用 storage delete 两次。

- [ ] **Step 2: Run red/green**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

Expected: likely pass because current clear is already idempotent; if pass,说明已有实现覆盖该行为。

## Task 2: TerminalScreen Forget UI

**Files:**
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [ ] **Step 1: Import clear helper**

从 `pairingTokenStore` import `clearPairingToken`。

- [ ] **Step 2: Add pairedDeviceId state**

恢复 token 和配对成功时设置 `pairedDeviceId`。

- [ ] **Step 3: Add handler**

实现 `handleForgetPairing()`：

- `clearPairingToken(pairingTokenStorage)`
- `closeCurrentClient()`
- `setSessionToken(null)`
- `setPairedDeviceId(null)`
- `setPairingStatus("not paired")`
- `terminalState.setConnected(false)`
- `refreshSnapshot()`

- [ ] **Step 4: Add compact UI row**

在 pairing panel 中 `pairedDeviceId` 存在时显示：

- `Paired <deviceId>`
- `Forget` button

- [ ] **Step 5: Verify Mobile**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
```

- [ ] **Step 6: Commit implementation**

```bash
git add apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/pairingTokenStore.test.ts
git commit -m "feat: add mobile forget device action"
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

- [ ] **Step 2: Update feature log**

记录 commits、verification、risks 和 next steps。

- [ ] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record mobile forget device delivery"
```

## Self-Review

- Spec coverage: 覆盖显示 paired device、Forget 清除 SecureStore、关闭 session、清空 token。
- Placeholder scan: 未发现占位项。
- Type consistency: `pairedDeviceId`、`clearPairingToken()`、`sessionToken` 名称一致。
