# Agent Terminal Capability Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 macOS Agent 可以通过环境变量关闭终端能力，并让 Mobile 打开终端时收到明确失败原因。

**Architecture:** Agent 配置新增 `terminalEnabled` 和派生 `capabilities`；Agent 注册时发送配置中的 capabilities。Server 在 `session.open` 前读取 `DeviceRegistry`，设备无 `terminal` capability 时直接返回 `session.error`，不创建 session，不路由到 Agent。

**Tech Stack:** TypeScript, Vitest, Fastify WebSocket, @remote/protocol.

---

## File Structure

```text
apps/agent/src/config.ts
apps/agent/src/agentClient.ts
apps/agent/tests/config.test.ts
apps/agent/tests/agentClient.test.ts
apps/server/src/ws.ts
apps/server/tests/ws.test.ts
docs/runbooks/mvp-acceptance.md
docs/superpowers/plans/2026-05-03-agent-terminal-capability-toggle-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Agent capability TDD

**Files:**
- Modify: `apps/agent/tests/config.test.ts`
- Modify: `apps/agent/tests/agentClient.test.ts`
- Modify: `apps/agent/src/config.ts`
- Modify: `apps/agent/src/agentClient.ts`

- [ ] **Step 1: Add failing tests**

Add tests for:

- default config includes `capabilities: ["terminal"]`.
- `REMOTE_ENABLE_TERMINAL=0` sets `capabilities: []`.
- `device.register` sends configured capabilities.

- [ ] **Step 2: Run red tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: fail because `AgentConfig.capabilities` does not exist.

- [ ] **Step 3: Implement Agent config and registration**

Add `capabilities` to `AgentConfig`, parse `REMOTE_ENABLE_TERMINAL`, and use `this.config.capabilities` in `device.register`.

- [ ] **Step 4: Run green tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

## Task 2: Server rejection TDD

**Files:**
- Modify: `apps/server/tests/ws.test.ts`
- Modify: `apps/server/src/ws.ts`

- [ ] **Step 1: Add failing server test**

Add a WebSocket test that registers an Agent with `capabilities: []`, uses a valid session token, sends `session.open`, and expects `session.error` with a terminal capability message.

- [ ] **Step 2: Run red tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because server opens the session even when terminal capability is absent.

- [ ] **Step 3: Implement server capability guard**

In `session.open`, check `registry.get(message.deviceId)?.capabilities.includes("terminal")`. If false, throw `Device ${message.deviceId} does not support terminal sessions.`

- [ ] **Step 4: Run green tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

## Task 3: Docs and verification

**Files:**
- Modify: `docs/runbooks/mvp-acceptance.md`
- Modify: `docs/superpowers/plans/2026-05-03-agent-terminal-capability-toggle-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Update acceptance runbook**

Replace the disabled terminal capability workaround with:

```bash
REMOTE_ENABLE_TERMINAL=0 REMOTE_DEVICE_ID=home-mac pnpm dev:agent
```

- [ ] **Step 2: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 3: Commit implementation and docs**

```bash
git add apps/agent/src/config.ts apps/agent/src/agentClient.ts apps/agent/tests/config.test.ts apps/agent/tests/agentClient.test.ts apps/server/src/ws.ts apps/server/tests/ws.test.ts docs/runbooks/mvp-acceptance.md docs/superpowers/plans/2026-05-03-agent-terminal-capability-toggle-plan.md docs/superpowers/records/feature-log.md
git commit -m "feat: allow disabling agent terminal capability"
```

## Self-Review

- Spec coverage: 覆盖 Agent 开关、注册 capabilities、Server 拒绝和验收文档。
- Placeholder scan: 计划没有待办占位符。
- Type consistency: 使用 `REMOTE_ENABLE_TERMINAL=0` 和 `capabilities`。
