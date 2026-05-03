# Redis Device Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把设备在线状态抽象为 presence store，并新增 Redis-backed presence store。

**Architecture:** `DeviceRegistry` 使用同步 `DevicePresenceStore` 和默认内存实现；`RedisDevicePresenceStore` 独立提供 async Redis 实现，供后续云部署 wiring 使用。本任务不改变 WebSocket route ownership。

**Tech Stack:** TypeScript, Vitest, Redis client interface.

---

## File Structure

```text
apps/server/src/deviceRegistry.ts
apps/server/src/presence/redisPresenceStore.ts
apps/server/tests/deviceRegistry.test.ts
apps/server/tests/presence/redisPresenceStore.test.ts
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/plans/2026-05-03-redis-device-presence-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: DeviceRegistry memory presence TDD

**Files:**
- Modify: `apps/server/tests/deviceRegistry.test.ts`
- Modify: `apps/server/src/deviceRegistry.ts`

- [x] **Step 1: Write failing tests**

Add tests:

- heartbeat keeps device online and updates `lastSeenAt`.
- device becomes offline after presence TTL.
- injected memory presence store preserves existing online/offline behavior.

- [x] **Step 2: Run red server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `heartbeat()` and presence TTL do not exist.

- [x] **Step 3: Implement memory presence store**

In `deviceRegistry.ts`, export:

```ts
export interface DevicePresence
export interface DevicePresenceStore
export class MemoryDevicePresenceStore
```

Add `DeviceRegistryOptions` with `presenceStore`, `now`, `presenceTtlMs`.

- [x] **Step 4: Update DeviceRegistry**

`register()` calls `markOnline`; `markOffline()` calls store; `heartbeat()` calls store; `get()`/`list()` compose `online` from store.

- [x] **Step 5: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 2: Redis presence store TDD

**Files:**
- Create: `apps/server/src/presence/redisPresenceStore.ts`
- Create: `apps/server/tests/presence/redisPresenceStore.test.ts`

- [x] **Step 1: Write failing Redis store tests**

Use fake Redis client with `set`, `get`, and captured TTL. Cover:

- `markOnline()` writes online payload and TTL.
- `heartbeat()` refreshes lastSeen/expiresAt and TTL.
- `markOffline()` writes offline payload.
- `getPresence()` parses stored JSON.
- invalid JSON returns undefined.

- [x] **Step 2: Run red server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because Redis store module does not exist.

- [x] **Step 3: Implement RedisDevicePresenceStore**

Implement with injected client:

```ts
export interface RedisLike {
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  get(key: string): Promise<string | null>;
}
```

No direct dependency on a Redis package in this task.

- [x] **Step 4: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 3: Verification and delivery record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-redis-device-presence-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server build
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 2: Commit implementation**

```bash
git add apps/server/src/deviceRegistry.ts apps/server/src/presence apps/server/tests/deviceRegistry.test.ts apps/server/tests/presence
git commit -m "feat: add redis-backed device presence"
```

- [x] **Step 3: Mark plan and log delivery**

Mark this plan and Task 15 complete. Append feature log with commits and verification.

- [x] **Step 4: Commit records**

```bash
git add docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-redis-device-presence-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record redis device presence delivery"
```

## Self-Review

- Spec coverage: 覆盖 store 抽象、内存 store、Redis store、上线、心跳、断开、过期和验证。
- Placeholder scan: 没有 TBD/TODO。
- Type consistency: `DevicePresenceStore`、`MemoryDevicePresenceStore`、`RedisDevicePresenceStore` 命名一致。
