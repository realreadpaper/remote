# Pairing Auth Protocol Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为后续设备配对、短期会话鉴权、设备状态和终端恢复补齐协议消息 schema。

**Architecture:** 仅扩展 `packages/protocol` 的 Zod discriminated union，不改 server、agent、mobile 业务逻辑。新增消息保持 strict object 校验，现有消息保持兼容，`session.open.sessionToken` 作为可选字段先进入协议。

**Tech Stack:** TypeScript, Zod, Vitest, pnpm workspace.

---

## File Structure

```text
packages/protocol/src/messages.ts
packages/protocol/tests/messages.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: 协议红灯测试

**Files:**
- Modify: `packages/protocol/tests/messages.test.ts`

- [ ] **Step 1: Write failing tests**

新增测试：

- `parses session.open with an optional session token`
- `parses agent pairing create request`
- `parses agent pairing approval and rejection`
- `parses server pairing created response`
- `parses server pairing requested notification`
- `parses auth session token`
- `parses device status`
- `parses terminal snapshot request and response`
- `rejects pairing messages missing required fields`

- [ ] **Step 2: Run red test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test
```

Expected: fail because new message types are not in the discriminated unions.

## Task 2: 协议 schema 实现

**Files:**
- Modify: `packages/protocol/src/messages.ts`

- [ ] **Step 1: Add client message schemas**

新增：

- `pairing.create`
- `pairing.approved`
- `pairing.rejected`
- `terminal.snapshot.request`

并给 `session.open` 增加可选 `sessionToken`。

- [ ] **Step 2: Add server message schemas**

新增：

- `pairing.created`
- `pairing.requested`
- `auth.sessionToken`
- `device.status`
- `terminal.snapshot`

- [ ] **Step 3: Run green test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test
```

Expected: all protocol tests pass.

## Task 3: 验证和提交

**Files:**
- Modify: `packages/protocol/src/messages.ts`
- Modify: `packages/protocol/tests/messages.test.ts`

- [ ] **Step 1: Typecheck protocol**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol typecheck
```

Expected: pass.

- [ ] **Step 2: Run workspace tests**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
```

Expected: all workspace tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/protocol/src/messages.ts packages/protocol/tests/messages.test.ts
git commit -m "feat: add pairing and auth protocol messages"
```

## Task 4: 完成记录

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Update feature log**

记录：

- design doc commit
- plan doc commit
- implementation commit
- verification commands
- known risks
- next step: Server pairing state machine

- [ ] **Step 2: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record pairing auth protocol delivery"
```
