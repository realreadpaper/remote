# Server Minimal External Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给公网开发 Relay 增加最小安全边界：server 可强制 WebSocket dev token，Agent/Mobile 可携带 token，本地开发默认不受影响。

**Architecture:** 在 `apps/server` 增加运行配置和 dev token 校验模块，`registerWsRoutes` 在 `/ws/agent`、`/ws/mobile` 入口拒绝无效 token。`apps/agent` 和 `apps/mobile` 只负责把 token 安全追加到 WebSocket URL，Mobile 展示 URL 时脱敏。该计划不实现正式账号、设备绑定、session token 或数据库。

**Tech Stack:** TypeScript, Fastify, `@fastify/websocket`, `ws`, Zod protocol schemas, Expo runtime env, Vitest.

---

## File Structure

```text
apps/server/src/config.ts
apps/server/src/auth/devToken.ts
apps/server/src/index.ts
apps/server/src/ws.ts
apps/server/tests/config.test.ts
apps/server/tests/auth/devToken.test.ts
apps/server/tests/ws.test.ts
apps/agent/src/config.ts
apps/agent/src/agentClient.ts
apps/agent/tests/config.test.ts
apps/agent/tests/agentClient.test.ts
apps/mobile/src/config/runtimeConfig.ts
apps/mobile/src/components/TerminalScreen.tsx
apps/mobile/tests/runtimeConfig.test.ts
docs/superpowers/records/feature-log.md
```

## Task 1: Server Runtime Config

**Files:**
- Create: `apps/server/src/config.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/tests/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Add tests for defaults, explicit env values, invalid port, and `REMOTE_REQUIRE_DEV_TOKEN=1` without `REMOTE_DEV_TOKEN`.

- [ ] **Step 2: Run red test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `../src/config.js` does not exist.

- [ ] **Step 3: Implement config**

Create `loadServerConfig(env = process.env)` returning:

```ts
{
  host: "127.0.0.1",
  port: 8787,
  requireDevToken: false,
  devToken: null,
  publicBaseUrl: null
}
```

Throw clear errors for invalid port and required token missing.

- [ ] **Step 4: Wire `index.ts`**

`createServer(options, config = loadServerConfig())` should pass config to `registerWsRoutes`. The CLI path should use `config.host` and `config.port`.

- [ ] **Step 5: Verify and commit**

Run server tests, then commit:

```bash
git add apps/server/src/config.ts apps/server/src/index.ts apps/server/tests/config.test.ts
git commit -m "feat: add server runtime config"
```

## Task 2: Server Dev Token Guard

**Files:**
- Create: `apps/server/src/auth/devToken.ts`
- Modify: `apps/server/src/ws.ts`
- Test: `apps/server/tests/auth/devToken.test.ts`
- Test: `apps/server/tests/ws.test.ts`

- [ ] **Step 1: Write failing token tests**

Add unit tests for:

- disabled guard allows missing token
- query token passes
- `Authorization: Bearer <token>` passes
- missing token fails
- wrong token fails

Add WebSocket tests for token mode:

- `/ws/agent` without token cannot register
- `/ws/mobile` without token cannot open session
- correct token keeps existing route flow working

- [ ] **Step 2: Run red test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/server test
```

Expected: fail because `auth/devToken.ts` and token checks do not exist.

- [ ] **Step 3: Implement token helper**

Create:

```ts
export interface DevTokenGuardConfig {
  requireDevToken: boolean;
  devToken: string | null;
}

export function getProvidedDevToken(request: { url: string; headers: Record<string, unknown> }): string | null
export function validateDevToken(config: DevTokenGuardConfig, providedToken: string | null): boolean
```

- [ ] **Step 4: Guard WebSocket routes**

At the start of `/ws/agent` and `/ws/mobile`, close socket when token is invalid. Do not expose expected token.

- [ ] **Step 5: Verify and commit**

Run server tests, then commit:

```bash
git add apps/server/src/auth/devToken.ts apps/server/src/ws.ts apps/server/tests/auth/devToken.test.ts apps/server/tests/ws.test.ts
git commit -m "feat: guard websocket relay with dev token"
```

## Task 3: Agent Token URL Support

**Files:**
- Modify: `apps/agent/src/config.ts`
- Modify: `apps/agent/src/agentClient.ts`
- Test: `apps/agent/tests/config.test.ts`
- Test: `apps/agent/tests/agentClient.test.ts`

- [ ] **Step 1: Write failing Agent tests**

Add tests for `REMOTE_DEV_TOKEN` loading and socket factory URL containing `?token=...` or `&token=...`.

- [ ] **Step 2: Run red test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

- [ ] **Step 3: Implement Agent URL helper**

Add `devToken: string | null` to `AgentConfig`. Add a helper that returns the WebSocket URL with token appended only when configured.

- [ ] **Step 4: Verify and commit**

Run agent tests, then commit:

```bash
git add apps/agent/src/config.ts apps/agent/src/agentClient.ts apps/agent/tests/config.test.ts apps/agent/tests/agentClient.test.ts
git commit -m "feat: support agent dev token relay auth"
```

## Task 4: Mobile Token URL and Redacted Display

**Files:**
- Modify: `apps/mobile/src/config/runtimeConfig.ts`
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`
- Test: `apps/mobile/tests/runtimeConfig.test.ts`

- [ ] **Step 1: Write failing Mobile tests**

Add tests for `EXPO_PUBLIC_REMOTE_DEV_TOKEN`, query append, existing query append, and redacted display URL.

- [ ] **Step 2: Run red test**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
```

- [ ] **Step 3: Implement runtime config**

Add:

```ts
sessionUrl: string;
displaySessionUrl: string;
devToken: string | null;
```

Append token to `sessionUrl`; redact token in `displaySessionUrl`.

- [ ] **Step 4: Update UI**

`TerminalScreen` should use `runtimeConfig.sessionUrl` for the socket and `runtimeConfig.displaySessionUrl` for display.

- [ ] **Step 5: Verify and commit**

Run mobile tests, then commit:

```bash
git add apps/mobile/src/config/runtimeConfig.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/tests/runtimeConfig.test.ts
git commit -m "feat: support mobile dev token relay auth"
```

## Task 5: Final Verification and Tracking

**Files:**
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Run local no-token smoke**

Start local server and Agent without token and verify `printf "__LOCAL__%s\n" "$PWD"` returns output.

- [ ] **Step 3: Run token-mode smoke**

Start server with `REMOTE_REQUIRE_DEV_TOKEN=1 REMOTE_DEV_TOKEN=secret`, start Agent and Mobile/WebSocket probe with matching token, verify `printf "__TOKEN__%s\n" "$PWD"` returns output.

- [ ] **Step 4: Update feature log**

Record commits, verification commands, smoke outputs, known risks, and next steps.

- [ ] **Step 5: Commit log**

```bash
git add docs/superpowers/records/feature-log.md
git commit -m "docs: record minimal external security delivery"
```
