# Server Cloud Runtime Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 server runtime config 读取 `DATABASE_URL` 和 `REDIS_URL`，为 PostgreSQL/Redis 运行时 wiring 做基础。

**Architecture:** 只扩展 `loadServerConfig()` 和 `ServerConfig`，不改变现有 runtime store。URL 使用标准 `URL` 解析做基础校验，空值归一为 `null`。

**Tech Stack:** TypeScript, Vitest.

---

## File Structure

```text
apps/server/src/config.ts
apps/server/tests/config.test.ts
docs/runbooks/cloud-test-environment.md
docs/superpowers/plans/2026-05-03-server-cloud-runtime-config-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Config TDD

**Files:**
- Modify: `apps/server/tests/config.test.ts`
- Modify: `apps/server/src/config.ts`

- [x] **Step 1: Add failing tests**

Add expectations:

- defaults include `databaseUrl: null`, `redisUrl: null`.
- cloud env returns `databaseUrl` and `redisUrl`.
- invalid values throw `DATABASE_URL must be a valid URL` and `REDIS_URL must be a valid URL`.

- [x] **Step 2: Run red tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

- [x] **Step 3: Implement config fields**

Add fields and URL parser in `apps/server/src/config.ts`.

- [x] **Step 4: Run green tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 2: Docs and verification

**Files:**
- Modify: `docs/runbooks/cloud-test-environment.md`
- Modify: `docs/superpowers/plans/2026-05-03-server-cloud-runtime-config-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [x] **Step 1: Update runbook**

Change the cloud runbook current status from “server runtime wiring pending” to “server reads URLs, store wiring pending”.

- [x] **Step 2: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [x] **Step 3: Commit**

```bash
git add apps/server/src/config.ts apps/server/tests/config.test.ts docs/runbooks/cloud-test-environment.md docs/superpowers/plans/2026-05-03-server-cloud-runtime-config-plan.md docs/superpowers/records/feature-log.md
git commit -m "feat: read cloud datastore urls from server config"
```

## Self-Review

- Spec coverage: 覆盖 `DATABASE_URL`、`REDIS_URL`、默认值、非法 URL 和文档状态。
- Placeholder scan: 计划没有待办占位符。
- Type consistency: 字段名为 `databaseUrl`、`redisUrl`。
