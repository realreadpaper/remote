# macOS Agent Desktop Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增可运行的 Electron macOS Agent 桌面壳，复用现有 Agent core，显示设备/配对状态，并提供终端能力开关和菜单栏入口。

**Architecture:** `apps/agent` 继续持有协议、PTY、配对和 WebSocket core；`apps/agent-desktop` 只负责 Electron main/preload/renderer、状态投影、菜单栏和生命周期控制。Desktop main process 通过自定义 AgentClient dependencies 接收 pairing code/request，并通过 IPC 推送到 renderer。

**Tech Stack:** TypeScript, Electron, Vitest, qrcode, existing `@remote/agent`, pnpm workspace.

---

## File Structure

```text
apps/agent/src/agentClient.ts
apps/agent/tests/agentClient.test.ts
apps/agent/package.json
apps/agent-desktop/package.json
apps/agent-desktop/tsconfig.json
apps/agent-desktop/src/main.ts
apps/agent-desktop/src/preload.ts
apps/agent-desktop/src/desktopState.ts
apps/agent-desktop/src/agentDesktopRuntime.ts
apps/agent-desktop/src/renderer/index.html
apps/agent-desktop/src/renderer/app.js
apps/agent-desktop/src/renderer/styles.css
apps/agent-desktop/tests/desktopState.test.ts
apps/agent-desktop/tests/agentDesktopRuntime.test.ts
docs/runbooks/macos-agent-package.md
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/records/feature-log.md
README.md
```

## Task 1: AgentClient lifecycle API

**Files:**
- Modify: `apps/agent/src/agentClient.ts`
- Modify: `apps/agent/tests/agentClient.test.ts`
- Modify: `apps/agent/package.json`

- [ ] **Step 1: Write failing close tests**

In `apps/agent/tests/agentClient.test.ts`, extend `FakeSocket` with `closeCalls` and `close()`:

```ts
closeCalls = 0;

close(): void {
  this.closeCalls += 1;
  this.emit("close");
}
```

Add tests:

```ts
it("closes the socket when the client is closed", () => {
  const { client, socket } = createHarness();

  client.close();

  expect(socket.closeCalls).toBe(1);
});

it("closes active terminal sessions when the client is closed", () => {
  const { client, socket, terminals } = createHarness();

  socket.emit("message", encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" }));
  client.close();

  expect(terminals.get("session-1")?.close).toHaveBeenCalledOnce();
});

it("allows close to be called more than once", () => {
  const { client, socket } = createHarness();

  client.close();
  client.close();

  expect(socket.closeCalls).toBe(1);
});
```

- [ ] **Step 2: Run red Agent tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

Expected: fail because `AgentClient.close()` does not exist.

- [ ] **Step 3: Implement AgentClient close**

In `AgentSocket`, add optional close:

```ts
close?(): void;
```

In `AgentClient`:

```ts
close(): void {
  const socket = this.socket;
  this.socket = undefined;
  this.closeSessions();

  if (!socket?.close) {
    return;
  }

  try {
    socket.close();
  } catch (error) {
    console.error("Agent socket close failed", error);
  }
}
```

Update socket close/error handlers to avoid duplicate close after explicit close:

```ts
socket.on("close", () => {
  if (this.socket === socket) {
    this.socket = undefined;
  }
  this.closeSessions();
});
```

- [ ] **Step 4: Export Agent subpaths**

In `apps/agent/package.json`, add:

```json
"exports": {
  "./agentClient": {
    "types": "./dist/agentClient.d.ts",
    "import": "./dist/agentClient.js"
  },
  "./config": {
    "types": "./dist/config.d.ts",
    "import": "./dist/config.js"
  },
  "./pairing": {
    "types": "./dist/pairing.d.ts",
    "import": "./dist/pairing.js"
  }
}
```

- [ ] **Step 5: Run green Agent tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test
```

## Task 2: Desktop package scaffold

**Files:**
- Create: `apps/agent-desktop/package.json`
- Create: `apps/agent-desktop/tsconfig.json`
- Create: `apps/agent-desktop/src/renderer/index.html`
- Create: `apps/agent-desktop/src/renderer/app.js`
- Create: `apps/agent-desktop/src/renderer/styles.css`

- [ ] **Step 1: Add workspace package**

Create `apps/agent-desktop/package.json`:

```json
{
  "name": "@remote/agent-desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -p tsconfig.json && mkdir -p dist/renderer && cp -R src/renderer/. dist/renderer/",
    "dev": "pnpm build && electron dist/main.js",
    "pack:dir": "pnpm build && electron-builder --dir --mac",
    "test": "vitest run --root ../.. apps/agent-desktop/tests",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit"
  },
  "dependencies": {
    "@remote/agent": "workspace:*",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@types/qrcode": "^1.5.5",
    "electron": "^30.5.1",
    "electron-builder": "^24.13.3"
  },
  "build": {
    "appId": "com.terminalfirst.agent",
    "productName": "Terminal First Agent",
    "files": [
      "dist/**/*",
      "package.json"
    ],
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": "dir"
    }
  }
}
```

Create `apps/agent-desktop/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "electron"]
  },
  "include": ["src/**/*.ts"]
}
```

Create `apps/agent-desktop/tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "types": ["node", "vitest"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 2: Install dependencies**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm install
```

Expected: lockfile updates with Electron, electron-builder and qrcode packages.

- [ ] **Step 3: Add placeholder renderer files**

Create minimal renderer files:

```html
<!-- apps/agent-desktop/src/renderer/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Terminal First Agent</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script src="./app.js"></script>
  </body>
</html>
```

```js
// apps/agent-desktop/src/renderer/app.js
document.getElementById("app").textContent = "Terminal First Agent";
```

```css
/* apps/agent-desktop/src/renderer/styles.css */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

- [ ] **Step 4: Run package build red/green checkpoint**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop build
```

Expected after scaffold: fail until `main.ts` and `preload.ts` exist in later tasks; do not commit yet.

## Task 3: Desktop state model TDD

**Files:**
- Create: `apps/agent-desktop/src/desktopState.ts`
- Create: `apps/agent-desktop/tests/desktopState.test.ts`

- [ ] **Step 1: Write failing state tests**

Create tests for:

- `createInitialDesktopState(config)` maps device fields and starts as `stopped`.
- `withConnectionStatus()` updates status and message.
- `withPairingCreated()` stores code, expiry and QR data URL.
- `withPairingRequest()` stores pending request.
- `withPairingDecision()` clears pending request.
- `withTerminalEnabled()` updates terminalEnabled.

- [ ] **Step 2: Run red desktop tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test
```

Expected: fail because `desktopState.ts` does not exist.

- [ ] **Step 3: Implement desktop state functions**

Create `DesktopState`, `PendingPairingRequest`, and pure update helpers in `apps/agent-desktop/src/desktopState.ts`.

- [ ] **Step 4: Run green desktop state tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test
```

## Task 4: Desktop Agent runtime TDD

**Files:**
- Create: `apps/agent-desktop/src/agentDesktopRuntime.ts`
- Create: `apps/agent-desktop/tests/agentDesktopRuntime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Use a fake AgentClient with `connect()` and `close()` spies. Cover:

- `start()` creates AgentClient and calls `connect()`.
- `stop()` calls `close()` and sets terminal disabled/stopped.
- `setTerminalEnabled(true)` starts runtime.
- `setTerminalEnabled(false)` stops runtime.
- `handlePairingCreated()` updates state with QR data URL.
- `approvePairing()` resolves pending pairing decision as approved.
- `rejectPairing()` resolves pending pairing decision as rejected.

- [ ] **Step 2: Run red runtime tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test
```

Expected: fail because runtime module does not exist.

- [ ] **Step 3: Implement runtime**

Implement a small `AgentDesktopRuntime` class with injectable:

```ts
interface AgentDesktopRuntimeDependencies {
  createAgentClient: (dependencies: AgentClientDependencies) => Pick<AgentClient, "connect" | "close">;
  createQrDataUrl: (payload: string) => Promise<string>;
  onStateChange?: (state: DesktopState) => void;
}
```

The default factory uses `new AgentClient(config, dependencies)`.

- [ ] **Step 4: Run green runtime tests**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test
```

## Task 5: Electron main, preload, renderer and tray

**Files:**
- Create: `apps/agent-desktop/src/main.ts`
- Create: `apps/agent-desktop/src/preload.ts`
- Modify: `apps/agent-desktop/src/renderer/index.html`
- Modify: `apps/agent-desktop/src/renderer/app.js`
- Modify: `apps/agent-desktop/src/renderer/styles.css`

- [ ] **Step 1: Implement preload bridge**

Expose:

```ts
contextBridge.exposeInMainWorld("agentDesktop", {
  getState: () => ipcRenderer.invoke("agent:get-state"),
  setTerminalEnabled: (enabled: boolean) => ipcRenderer.invoke("agent:set-terminal-enabled", enabled),
  approvePairing: () => ipcRenderer.invoke("agent:approve-pairing"),
  rejectPairing: () => ipcRenderer.invoke("agent:reject-pairing"),
  showWindow: () => ipcRenderer.invoke("agent:show-window"),
  quit: () => ipcRenderer.invoke("agent:quit"),
  onState: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on("agent:state", listener);
    return () => ipcRenderer.removeListener("agent:state", listener);
  }
});
```

- [ ] **Step 2: Implement Electron main**

Create BrowserWindow with `contextIsolation: true`, load `dist/renderer/index.html`, create tray/menu, instantiate `AgentDesktopRuntime`, wire IPC handlers, and start runtime on app ready.

- [ ] **Step 3: Implement renderer UI**

Renderer must show:

- Header with device name and status.
- Terminal enabled checkbox/toggle.
- Pairing QR image and pairing code.
- Device ID, Server URL, shell.
- Pending request with Approve/Reject buttons.

- [ ] **Step 4: Run desktop tests, typecheck and build**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop build
```

## Task 6: Runbook, README, status tracking and verification

**Files:**
- Create: `docs/runbooks/macos-agent-package.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-macos-agent-desktop-shell-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Write runbook**

Runbook must include:

- local dev command: `pnpm --filter @remote/agent-desktop dev`
- local package directory command: `pnpm --filter @remote/agent-desktop pack:dir`
- environment variables: `REMOTE_SERVER_URL`, `REMOTE_DEVICE_NAME`, `REMOTE_DEV_TOKEN`, `SHELL`
- known native module risk for `node-pty` and Electron rebuild
- Task 11 note: signing/notarization not covered here

- [ ] **Step 2: Update README**

Add macOS desktop agent runbook link and local command.

- [ ] **Step 3: Full verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 4: Commit implementation**

```bash
git add apps/agent apps/agent-desktop docs/runbooks/macos-agent-package.md README.md docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-macos-agent-desktop-shell-plan.md docs/superpowers/records/feature-log.md package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat: add macos agent desktop shell"
```

## Self-Review

- Spec coverage: 覆盖 Electron 选择、Agent core 复用、主窗口、菜单栏、终端能力开关、配对二维码、配对审批、runbook 和验证。
- Placeholder scan: 没有 TBD/TODO。
- Type consistency: Runtime dependencies、DesktopState、AgentClient close API 在任务之间命名一致。
