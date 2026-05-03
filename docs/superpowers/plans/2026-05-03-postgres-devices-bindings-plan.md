# Postgres Devices and Bindings Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 PostgreSQL schema 和 devices/bindings repository，为云端持久化打基础。

**Architecture:** Repository 只依赖轻量 `Queryable` 接口，生产可接 `pg.Pool`，测试用 `pg-mem` 执行同一份 `schema.sql`。本任务不改现有 WebSocket/PairingService 行为。

**Tech Stack:** TypeScript, PostgreSQL SQL, `pg`, `pg-mem`, Vitest.

---

## File Structure

```text
apps/server/package.json
apps/server/src/persistence/db.ts
apps/server/src/persistence/schema.sql
apps/server/src/persistence/deviceRepository.ts
apps/server/src/persistence/bindingRepository.ts
apps/server/tests/persistence/repositoryTestDb.ts
apps/server/tests/persistence/deviceRepository.test.ts
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/plans/2026-05-03-postgres-devices-bindings-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Dependencies and schema

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/src/persistence/db.ts`
- Create: `apps/server/src/persistence/schema.sql`

- [x] **Step 1: Add dependencies**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server add pg
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server add -D @types/pg pg-mem
```

- [x] **Step 2: Create db adapter**

Create `apps/server/src/persistence/db.ts`:

```ts
import { Pool } from "pg";

export interface QueryResult<T> {
  rows: T[];
}

export interface Queryable {
  query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export function createPostgresPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
```

- [x] **Step 3: Create schema.sql**

Create PostgreSQL DDL for `users`, `devices`, `mobile_clients`, `device_bindings`, `sessions` with indexes for user/device lookup.

- [x] **Step 4: Run server typecheck checkpoint**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server typecheck
```

## Task 2: Repository TDD and implementation

**Files:**
- Create: `apps/server/tests/persistence/repositoryTestDb.ts`
- Create: `apps/server/tests/persistence/deviceRepository.test.ts`
- Create: `apps/server/src/persistence/deviceRepository.ts`
- Create: `apps/server/src/persistence/bindingRepository.ts`

- [x] **Step 1: Write failing repository tests**

Tests must cover:

- device upsert creates and updates same device.
- binding create links user, device, mobile client.
- revoke binding removes it from active list.
- list devices for user returns only active bound devices.

- [x] **Step 2: Run red server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because repository modules do not exist.

- [x] **Step 3: Implement repository test DB**

Use `pg-mem` and execute `schema.sql`.

- [x] **Step 4: Implement DeviceRepository**

Methods:

```ts
upsertDevice(input: UpsertDeviceInput): Promise<DeviceRecord>
getDevice(deviceId: string): Promise<DeviceRecord | undefined>
listDevicesForUser(userId: string): Promise<DeviceRecord[]>
```

- [x] **Step 5: Implement BindingRepository**

Methods:

```ts
upsertMobileClient(input: UpsertMobileClientInput): Promise<MobileClientRecord>
createBinding(input: CreateBindingInput): Promise<DeviceBindingRecord>
revokeBinding(bindingId: string, revokedAt: string): Promise<boolean>
listActiveBindingsForUser(userId: string): Promise<DeviceBindingRecord[]>
```

- [x] **Step 6: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 3: Verification and delivery record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-postgres-devices-bindings-plan.md`
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
git add apps/server/package.json apps/server/src/persistence apps/server/tests/persistence pnpm-lock.yaml
git commit -m "feat: persist devices and bindings"
```

- [x] **Step 3: Mark plan and log delivery**

Mark this plan and Task 14 complete. Append feature log with commits and verification.

- [x] **Step 4: Commit records**

```bash
git add docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-postgres-devices-bindings-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record postgres devices bindings delivery"
```

## Self-Review

- Spec coverage: 覆盖 schema、repository、开发测试 DB、repository tests 和验证。
- Placeholder scan: 没有 TBD/TODO。
- Type consistency: `DeviceRepository`、`BindingRepository`、`Queryable` 命名一致。
