# Server Persistent Pairing Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Server 在配置 `REMOTE_DATA_DIR` 后持久化 pairing records 和 session tokens，重启后仍能识别已绑定 Mobile 的 token。

**Architecture:** 将现有内存 store 抽象成接口，新增 JSON 文件 store。`registerWsRoutes()` 根据 `ServerConfig.dataDir` 选择内存或文件实现；文件 store 仅服务单进程 MVP，后续可替换为数据库。

**Tech Stack:** TypeScript, Node fs/path, Fastify, Vitest, pnpm workspace.

---

## File Structure

```text
apps/server/src/config.ts
apps/server/src/pairing/pairingStore.ts
apps/server/src/auth/sessionTokens.ts
apps/server/src/ws.ts
apps/server/tests/config.test.ts
apps/server/tests/pairing/pairingStore.test.ts
apps/server/tests/auth/sessionTokens.test.ts
apps/server/tests/ws.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Config 红灯测试

**Files:**
- Modify: `apps/server/tests/config.test.ts`

- [ ] **Step 1: Write failing test**

覆盖 `REMOTE_DATA_DIR` 映射到 `ServerConfig.dataDir`。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `dataDir` is not in config.

## Task 2: Config implementation

**Files:**
- Modify: `apps/server/src/config.ts`

- [ ] **Step 1: Add dataDir**

`ServerConfig` 增加 `dataDir: string | null`，`loadServerConfig()` 从 `REMOTE_DATA_DIR` 读取。

- [ ] **Step 2: Run green**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

## Task 3: Pairing JSON store 红灯测试

**Files:**
- Modify: `apps/server/tests/pairing/pairingStore.test.ts`

- [ ] **Step 1: Write failing tests**

覆盖：

- `JsonFilePairingStore` 保存 code/request/binding 后，新实例能读回。
- 损坏 JSON 文件会抛错。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `JsonFilePairingStore` does not exist.

## Task 4: Pairing JSON store implementation

**Files:**
- Modify: `apps/server/src/pairing/pairingStore.ts`

- [ ] **Step 1: Add PairingStore interface**

让 `MemoryPairingStore` 实现 `PairingStore`。

- [ ] **Step 2: Add JsonFilePairingStore**

实现 JSON load/save，写入前创建目录，读到损坏文件时抛错。

- [ ] **Step 3: Run green**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

## Task 5: Session token JSON store 红灯测试

**Files:**
- Modify: `apps/server/tests/auth/sessionTokens.test.ts`

- [ ] **Step 1: Write failing tests**

覆盖：

- `JsonFileSessionTokenStore` issue 后，新实例能 verify 同一 token。
- `findTokenForBinding()` 返回同设备和 mobile 的最新 token。
- 损坏 JSON 文件会抛错。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `JsonFileSessionTokenStore` does not exist.

## Task 6: Session token JSON store implementation

**Files:**
- Modify: `apps/server/src/auth/sessionTokens.ts`

- [ ] **Step 1: Add SessionTokenStore interface**

让 `MemorySessionTokenStore` 实现接口，并增加 `findTokenForBinding()`。

- [ ] **Step 2: Add JsonFileSessionTokenStore**

实现 JSON load/save，issue 后写回文件，verify 从文件状态校验。

- [ ] **Step 3: Run green**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

## Task 7: Server route integration 红灯测试

**Files:**
- Modify: `apps/server/tests/ws.test.ts`

- [ ] **Step 1: Write failing restart test**

使用同一个临时 `dataDir`：

1. 创建 app1，注册 Agent，完成配对并拿到 token。
2. 关闭 app1。
3. 创建 app2，使用同一个 `dataDir`，重新注册 Agent。
4. Mobile 使用旧 token 打开 session。

- [ ] **Step 2: Run red**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `registerWsRoutes()` still uses memory stores.

## Task 8: Server route integration implementation

**Files:**
- Modify: `apps/server/src/ws.ts`

- [ ] **Step 1: Select stores from config**

`dataDir === null` 用内存 store；否则用 JSON file store。

- [ ] **Step 2: Recover approved request auth**

`GET /pairing/requests/:id` approved 时通过 `findTokenForBinding()` 查 token，不再依赖内存 `tokensByPairingRequestId`。

- [ ] **Step 3: Run green server tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: server tests pass.

- [ ] **Step 4: Commit implementation**

```bash
git add apps/server/src/config.ts apps/server/src/pairing/pairingStore.ts apps/server/src/auth/sessionTokens.ts apps/server/src/ws.ts apps/server/tests/config.test.ts apps/server/tests/pairing/pairingStore.test.ts apps/server/tests/auth/sessionTokens.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: persist server pairing storage"
```

## Task 9: Full verification and record

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Update feature log**

记录 design/plan/implementation commits、verification、known risks 和 next steps。

- [ ] **Step 3: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record server persistent pairing storage delivery"
```

## Self-Review

- Spec coverage: 覆盖 `REMOTE_DATA_DIR`、JSON pairing store、JSON token store、Server 重启后 token 可用。
- Placeholder scan: 未发现占位项。
- Type consistency: `dataDir`、`JsonFilePairingStore`、`JsonFileSessionTokenStore`、`findTokenForBinding()` 名称一致。
