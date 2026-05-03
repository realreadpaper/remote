# MVP Acceptance Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付发布前 MVP 验收清单，覆盖安装、绑定、授权、终端、重连、持久化、能力关闭和广告边界。

**Architecture:** 使用 Markdown runbook 固化人工验收流程，每个检查项包含前置条件、步骤、预期结果、状态记录和阻塞规则。真实真机、TestFlight、云端 relay 缺失时只能标记 `blocked`。

**Tech Stack:** Markdown, iOS Expo/TestFlight, macOS Agent, Fastify relay, WebSocket terminal.

---

## File Structure

```text
docs/superpowers/specs/2026-05-03-mvp-acceptance-design.md
docs/superpowers/plans/2026-05-03-mvp-acceptance-plan.md
docs/runbooks/mvp-acceptance.md
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Write MVP acceptance runbook

**Files:**
- Create: `docs/runbooks/mvp-acceptance.md`

- [ ] **Step 1: Create acceptance checklist**

Write `docs/runbooks/mvp-acceptance.md` with these sections:

- Goal and pass/fail/blocked rules.
- Test environment matrix: LAN simulator, LAN physical iPhone, Cloud cellular iPhone.
- Common result template.
- Checklist item for new install, scan/manual pairing, binding approval.
- Checklist item for unbound phone rejection.
- Checklist item for terminal commands:
  - `pwd`
  - `ls`
  - `git status`
  - `npm run dev`
- Checklist item for long command interruption:
  - `ping 127.0.0.1`
  - `Ctrl+C`
- Checklist item for iOS background and foreground reconnection.
- Checklist item for Agent restart identity persistence.
- Checklist item for server restart binding persistence.
- Checklist item for disabled terminal capability failure reason.
- Checklist item proving ads are not shown on terminal session page.
- Release decision table.

- [ ] **Step 2: Placeholder scan**

Run:

```bash
rg "TB[D]|TO[D]O|待[定]|以后[再]" docs/runbooks/mvp-acceptance.md
```

Expected: no matches.

- [ ] **Step 3: Commit runbook**

```bash
git add docs/runbooks/mvp-acceptance.md
git commit -m "docs: add mvp acceptance checklist"
```

## Task 2: Status and verification

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-mvp-acceptance-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Update main plan**

Mark Task 17 checklist-writing work complete only after `docs/runbooks/mvp-acceptance.md` exists. Keep real acceptance execution unchecked unless the corresponding real device/cloud test was executed in this session.

- [ ] **Step 2: Append feature log**

Add a `2026-05-03 MVP Acceptance Checklist` entry with commits, verification, and blocked real-device items.

- [ ] **Step 3: Verification**

Run:

```bash
rg "TB[D]|TO[D]O|待[定]|以后[再]" docs/runbooks/mvp-acceptance.md docs/superpowers/plans/2026-05-03-mvp-acceptance-plan.md
git diff --check
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

Expected:

- placeholder search has no matches.
- `git diff --check` exits 0.
- workspace test/typecheck/build exit 0.

- [ ] **Step 4: Commit records**

```bash
git add docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-mvp-acceptance-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record mvp acceptance checklist delivery"
```

## Self-Review

- Spec coverage: 覆盖设计文档全部验收项。
- Placeholder scan: 计划没有待办占位符。
- Type consistency: 状态统一使用 `pass`、`fail`、`blocked`。
