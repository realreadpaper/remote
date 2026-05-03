# Mobile Persisted Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Mobile 将已批准配对 token 保存到安全存储，App 重启后恢复 paired 状态并可直接连接。

**Architecture:** 新增 `pairingTokenStore.ts` 作为存储抽象，默认实现使用 `expo-secure-store`，测试使用 fake storage。`TerminalScreen` 启动时加载 token，配对成功后保存 token，Connect 时继续把恢复出的 token 传给 `SessionClient`。

**Tech Stack:** TypeScript, Expo, expo-secure-store, React Native, Vitest, pnpm workspace.

---

## File Structure

```text
apps/mobile/package.json
pnpm-lock.yaml
apps/mobile/src/state/pairingTokenStore.ts
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/pairingTokenStore.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Add SecureStore dependency

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Install dependency**

Run:

```bash
pnpm --filter @remote/mobile exec expo install expo-secure-store
```

Expected: `apps/mobile/package.json` contains `expo-secure-store`, and `pnpm-lock.yaml` updates.

- [x] **Step 2: Verify package metadata**

Run:

```bash
pnpm --filter @remote/mobile typecheck
```

Expected: typecheck may still fail because implementation has not imported the module yet; dependency resolution should not fail.

## Task 2: Pairing token store 红灯测试

**Files:**
- Create: `apps/mobile/tests/pairingTokenStore.test.ts`

- [x] **Step 1: Write failing tests**

覆盖：

- `savePairingToken()` writes JSON to storage key.
- `loadPairingToken()` returns valid non-expired record.
- `loadPairingToken()` clears and returns null for expired token.
- `loadPairingToken()` clears and returns null for invalid JSON.
- `clearPairingToken()` deletes storage key.

- [x] **Step 2: Run red test**

```bash
pnpm --filter @remote/mobile test
```

Expected: fail because `apps/mobile/src/state/pairingTokenStore.ts` does not exist.

## Task 3: Pairing token store implementation

**Files:**
- Create: `apps/mobile/src/state/pairingTokenStore.ts`

- [x] **Step 1: Implement types and key**

导出：

- `PAIRING_TOKEN_STORAGE_KEY`
- `PairingTokenRecord`
- `PairingTokenStorage`

- [x] **Step 2: Implement SecureStore adapter**

导出 `createSecureStorePairingTokenStorage()`，内部动态调用 `expo-secure-store` 的：

- `getItemAsync`
- `setItemAsync`
- `deleteItemAsync`

- [x] **Step 3: Implement save/load/clear helpers**

导出：

- `savePairingToken(storage, record)`
- `loadPairingToken(storage, options)`
- `clearPairingToken(storage)`

- [x] **Step 4: Run green mobile tests**

```bash
pnpm --filter @remote/mobile test
```

Expected: mobile tests pass.

## Task 4: TerminalScreen persistence integration

**Files:**
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`

- [x] **Step 1: Create storage instance**

在组件中创建 `pairingTokenStorage`。

- [x] **Step 2: Load token on mount**

`useEffect()` 调用 `loadPairingToken()`；有效时设置：

- `sessionToken`
- `pairingStatus`

- [x] **Step 3: Save token after approval**

`waitForApproval()` 返回 auth 后调用 `savePairingToken()`，保存 `deviceId`、`sessionToken`、`expiresAt`、`pairedAt`。

- [x] **Step 4: Add compact paired status line**

在 pairing panel 中展示恢复或新配对的 `pairingStatus`，不新增复杂交互。

- [x] **Step 5: Run mobile test/typecheck**

```bash
pnpm --filter @remote/mobile test
pnpm --filter @remote/mobile typecheck
```

Expected: pass.

- [x] **Step 6: Commit mobile implementation**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/state/pairingTokenStore.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/pairingTokenStore.test.ts
git commit -m "feat: persist mobile pairing token"
```

## Task 5: Full verification and record

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Full verification**

```bash
pnpm test
pnpm typecheck
pnpm build
```

- [x] **Step 2: Update feature log**

记录：

- design commit。
- plan commit。
- implementation commit。
- verification output。
- known risks：Server 内存 token、单设备本地记录、无 revoke/refresh。
- next：多设备列表、Forget device、Server 持久化 token。

- [x] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record mobile persisted pairing delivery"
```

## Self-Review

- Spec coverage: 覆盖 SecureStore 存储、启动恢复、配对成功保存、过期/损坏清理、Connect 使用恢复 token。
- Placeholder scan: 未发现占位项。
- Type consistency: `PairingTokenRecord.deviceId/sessionToken/expiresAt/pairedAt` 与设计一致。
