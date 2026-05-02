# Agent CLI Pairing Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Agent CLI 自动创建并展示配对码，收到 Mobile 配对请求后本地确认并发送 approve/reject。

**Architecture:** 新增 `pairing.ts` 封装控制台展示和 readline 确认。`AgentClient` 通过依赖注入调用展示/确认函数，测试中使用 fake 函数；生产 CLI 默认使用 console 和 readline。

**Tech Stack:** TypeScript, Node.js readline/promises, Vitest, pnpm workspace.

---

## File Structure

```text
apps/agent/src/pairing.ts
apps/agent/src/agentClient.ts
apps/agent/tests/agentClient.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: AgentClient pairing 红灯测试

**Files:**
- Modify: `apps/agent/tests/agentClient.test.ts`

- [ ] **Step 1: Write failing tests**

覆盖：

- 收到 `device.registered` 后发送 `pairing.create`。
- 收到 `pairing.created` 后调用 display 函数。
- 收到 `pairing.requested` 且 approval approve 后发送 `pairing.approved`。
- 收到 `pairing.requested` 且 approval reject 后发送 `pairing.rejected`。

- [ ] **Step 2: Run red test**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: fail because AgentClient ignores pairing messages.

## Task 2: Pairing helper 实现

**Files:**
- Create: `apps/agent/src/pairing.ts`

- [ ] **Step 1: Implement types**

导出：

- `PairingApprovalDecision`
- `PairingCodeDisplay`
- `PairingApprovalPrompt`

- [ ] **Step 2: Implement default display**

`displayPairingCode()` 使用 `console.info()` 打印 code、serverUrl、expiresAt。

- [ ] **Step 3: Implement prompt**

`promptPairingApproval()` 使用 readline；非 TTY 返回 rejected。

## Task 3: AgentClient 接入

**Files:**
- Modify: `apps/agent/src/agentClient.ts`

- [ ] **Step 1: Extend dependencies**

新增：

- `displayPairingCode`
- `approvePairingRequest`

- [ ] **Step 2: Handle `device.registered`**

parse server message 后发送 `pairing.create`。

- [ ] **Step 3: Handle `pairing.created`**

调用 display 函数。

- [ ] **Step 4: Handle `pairing.requested`**

调用 approval prompt，approve 发送 `pairing.approved`，reject 发送 `pairing.rejected`。

- [ ] **Step 5: Run green Agent tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

## Task 4: 全量验证和提交

**Files:**
- Create: `apps/agent/src/pairing.ts`
- Modify: `apps/agent/src/agentClient.ts`
- Modify: `apps/agent/tests/agentClient.test.ts`

- [ ] **Step 1: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add apps/agent/src/pairing.ts apps/agent/src/agentClient.ts apps/agent/tests/agentClient.test.ts
git commit -m "feat: add agent cli pairing approval"
```

## Task 5: 完成记录

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Update feature log**

记录提交、验证命令、风险和下一步二维码/安装版 UI。

- [ ] **Step 2: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record agent cli pairing approval delivery"
```
