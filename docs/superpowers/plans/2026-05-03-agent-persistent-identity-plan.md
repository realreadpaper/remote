# Agent Persistent Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Agent 默认使用本地持久设备身份，为后续 iOS 绑定、Agent 安装版和短期会话鉴权提供稳定 `deviceId`。

**Architecture:** 新增 `identity.ts`，封装文件身份 store、身份 schema 校验和 `loadOrCreateDeviceIdentity()`。`loadAgentConfig()` 保留 `REMOTE_DEVICE_ID` 覆盖能力；未配置时读取或创建持久身份。AgentClient 继续消费 `AgentConfig.deviceId`，无需理解身份存储。

**Tech Stack:** TypeScript, Node.js `fs`, `os`, `path`, `crypto`, Vitest, pnpm workspace.

---

## File Structure

```text
apps/agent/src/identity.ts
apps/agent/src/config.ts
apps/agent/tests/identity.test.ts
apps/agent/tests/config.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: 身份模块红灯测试

**Files:**
- Create: `apps/agent/tests/identity.test.ts`

- [ ] **Step 1: Write failing tests**

测试：

- 首次调用会生成身份文件。
- 第二次调用返回同一身份。
- 损坏 JSON 抛出 `Agent identity file is invalid`。
- 缺失关键字段抛出 `Agent identity file is invalid`。
- 默认路径是 `~/.remote-terminal-agent/identity.json`。

- [ ] **Step 2: Run red test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: fail because `../src/identity.js` does not exist.

## Task 2: 实现 identity 模块

**Files:**
- Create: `apps/agent/src/identity.ts`

- [ ] **Step 1: Implement types and default path**

导出：

- `DeviceIdentity`
- `DeviceIdentityStore`
- `getDefaultIdentityPath(homeDir = os.homedir())`

- [ ] **Step 2: Implement file store**

文件 store 负责读取 JSON、strict 校验、创建目录、保存 JSON。

- [ ] **Step 3: Implement load-or-create**

`loadOrCreateDeviceIdentity(options?)` 读取已有身份；不存在时用 `crypto.randomUUID()` 和 `crypto.generateKeyPairSync("ed25519")` 创建身份。

- [ ] **Step 4: Run green test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: identity tests pass.

## Task 3: 接入 Agent config

**Files:**
- Modify: `apps/agent/src/config.ts`
- Modify: `apps/agent/tests/config.test.ts`

- [ ] **Step 1: Write failing config test**

测试未设置 `REMOTE_DEVICE_ID` 时，`loadAgentConfig()` 使用注入的 identity `deviceId`。

- [ ] **Step 2: Run red test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: fail because `loadAgentConfig` still derives `${hostname}-dev`.

- [ ] **Step 3: Update config implementation**

让 `loadAgentConfig(options?)` 接收可选 `loadIdentity` 注入；默认调用 `loadOrCreateDeviceIdentity()`。

- [ ] **Step 4: Run green test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: all Agent tests pass.

## Task 4: 验证和提交

**Files:**
- Create: `apps/agent/src/identity.ts`
- Modify: `apps/agent/src/config.ts`
- Create: `apps/agent/tests/identity.test.ts`
- Modify: `apps/agent/tests/config.test.ts`

- [ ] **Step 1: Typecheck Agent**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent typecheck
```

- [ ] **Step 2: Run workspace tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add apps/agent/src/identity.ts apps/agent/src/config.ts apps/agent/tests/identity.test.ts apps/agent/tests/config.test.ts
git commit -m "feat: persist agent device identity"
```

## Task 5: 完成记录

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Update feature log**

记录提交、验证命令、已知风险和下一步 Server 配对状态机。

- [ ] **Step 2: Commit record**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record agent persistent identity delivery"
```
