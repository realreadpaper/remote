# iOS Mobile UI And Simulator Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 iOS 移动端从整屏黑色改成浅色终端工作台，并在模拟器验证启动、配对、连接、命令链路后重新安装真机。

**Architecture:** 抽出 `mobileShellTheme.ts` 作为可测试的主题边界，`TerminalScreen.tsx` 保持现有协议和状态逻辑，只替换布局文案和样式。`app.json` 同步改浅色 splash，降低开发构建加载时的黑屏感知。

**Tech Stack:** Expo React Native、Vitest、iOS Simulator、Expo dev build、macOS Agent、Fastify Server。

---

## 文件结构

- Create: `apps/mobile/src/components/mobileShellTheme.ts`，移动端 UI 主题和状态文案。
- Create: `apps/mobile/tests/mobileShellTheme.test.ts`，验证主题不再整屏黑色。
- Modify: `apps/mobile/src/components/TerminalScreen.tsx`，更新布局和样式。
- Modify: `apps/mobile/app.json`，更新 splash/adaptive icon 背景。
- Modify: `docs/superpowers/records/feature-log.md`，记录实现、验证和真机状态。

## Task 1: 主题边界和红灯测试

- [x] **Step 1: 新增失败测试**

Create `apps/mobile/tests/mobileShellTheme.test.ts`，断言：

```ts
import { describe, expect, it } from "vitest";
import { mobileShellTheme, getConnectionStatusLabel } from "../src/components/mobileShellTheme";

describe("mobile shell theme", () => {
  it("uses a non-black app background and a distinct terminal surface", () => {
    expect(mobileShellTheme.colors.appBackground).not.toMatch(/^#0[0-9a-f]{5}$/i);
    expect(mobileShellTheme.colors.appBackground).not.toBe(mobileShellTheme.colors.terminalBackground);
    expect(mobileShellTheme.colors.splashBackground).toBe(mobileShellTheme.colors.appBackground);
  });

  it("keeps connection status labels short for narrow phones", () => {
    expect(getConnectionStatusLabel({ connected: true, connecting: false, deviceId: "home-mac" })).toBe("Online");
    expect(getConnectionStatusLabel({ connected: false, connecting: true, deviceId: "home-mac" })).toBe("Connecting");
    expect(getConnectionStatusLabel({ connected: false, connecting: false, deviceId: "home-mac" })).toBe("home-mac");
  });
});
```

- [x] **Step 2: 运行红灯**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- mobileShellTheme.test.ts
```

Expected: fail because `mobileShellTheme.ts` does not exist.

## Task 2: 实现浅色终端工作台 UI

- [x] **Step 1: 新增主题实现**

Create `apps/mobile/src/components/mobileShellTheme.ts` with color and status helpers.

- [x] **Step 2: 更新 TerminalScreen**

Use the theme in `TerminalScreen.tsx` and adjust:

- Root/screen background to light.
- Header to compact light surface.
- Pairing panel to secondary light panel.
- Pairing panel collapses after a device is paired, leaving command entry as the primary action.
- Output panel to framed terminal surface.
- Input row to persistent command dock.

- [x] **Step 3: 更新 splash**

Set `apps/mobile/app.json` splash and adaptive icon background to the new light app background.

- [x] **Step 4: 运行绿灯**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- mobileShellTheme.test.ts
```

Expected: pass.

## Task 3: 移动端回归和模拟器验证

- [x] **Step 1: 移动端包验证**

Run:

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build
```

Expected: all pass.

- [x] **Step 2: 启动本地链路**

Use local Server, Metro, and Agent with:

```bash
HOST=0.0.0.0 PORT=8788 pnpm --filter @remote/server dev
EXPO_PUBLIC_REMOTE_WS_URL=ws://127.0.0.1:8788/ws/mobile EXPO_PUBLIC_REMOTE_API_URL=http://127.0.0.1:8788 pnpm --filter @remote/mobile exec expo start --lan --port 8082
REMOTE_SERVER_URL=ws://127.0.0.1:8788/ws/agent REMOTE_DEVICE_ID=sim-ui-mac pnpm --filter @remote/agent dev
```

- [x] **Step 3: 安装并启动 iOS 模拟器 App**

Run:

```bash
EXPO_PUBLIC_REMOTE_WS_URL=ws://127.0.0.1:8788/ws/mobile EXPO_PUBLIC_REMOTE_API_URL=http://127.0.0.1:8788 EXPO_PUBLIC_REMOTE_DEVICE_ID=sim-ui-mac pnpm --filter @remote/mobile exec expo run:ios --simulator "iPhone 15" --port 8082
```

- [x] **Step 4: 截图检查**

Run:

```bash
xcrun simctl io booted screenshot /tmp/remote-terminal-ui.png
```

Expected: screenshot is not a full black screen and shows the command dock.

- [x] **Step 5: 模拟器链路 smoke**

Complete Pair, approve in Agent, Connect, then run:

```bash
printf "__SIM_UI__%s\n" "$PWD"
```

Expected: simulator output contains `__SIM_UI__`.

## Task 4: 真机重新安装和记录

- [x] **Step 1: 重新安装真机**

Run:

```bash
EXPO_PUBLIC_REMOTE_WS_URL=ws://192.168.2.16:8788/ws/mobile EXPO_PUBLIC_REMOTE_API_URL=http://192.168.2.16:8788 EXPO_PUBLIC_REMOTE_DEVICE_ID=real-ios-mac pnpm --filter @remote/mobile exec expo run:ios --device long --port 8082
```

Result: installed `Remote Terminal com.terminalfirst.remote 0.1.0 (2)` on device `long`.

- [x] **Step 2: 启动真机 App**

Run:

```bash
xcrun devicectl device process launch --device 67C1404D-0644-489C-9014-879E44FFFBEA --terminate-existing --activate com.terminalfirst.remote
```

Result: process list contains `/RemoteTerminal.app/RemoteTerminal`.

- [x] **Step 3: 更新日志并提交**

Update `docs/superpowers/records/feature-log.md` with test results, simulator screenshot result, real device install result, and any manual-operation gaps.

Simulator evidence:

- `/tmp/remote-terminal-ui-reconnected.png`: light app shell, paired panel collapsed, `Online` status.
- `/tmp/remote-terminal-ui-autosmoke.png`: end-to-end output contains `__SIM_UI__/Users/hejianglong`.

Real-device automation gap:

- `devicectl` verified install, launch, and process.
- Current toolchain cannot tap or screenshot the physical iPhone UI; final visual confirmation needs user observation on device.

Commit:

```bash
git add apps/mobile/src/components/mobileShellTheme.ts apps/mobile/tests/mobileShellTheme.test.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/src/config/runtimeConfig.ts apps/mobile/tests/runtimeConfig.test.ts apps/mobile/app.json apps/mobile/package.json apps/agent/src/config.ts apps/agent/src/agentClient.ts apps/agent/tests/config.test.ts apps/agent/tests/agentClient.test.ts apps/agent-desktop/tests/agentDesktopRuntime.test.ts apps/agent-desktop/tests/desktopState.test.ts apps/server/tests/presence/redisPresenceStore.test.ts docs/superpowers/specs/2026-05-03-ios-mobile-ui-simulator-validation-design.md docs/superpowers/plans/2026-05-03-ios-mobile-ui-simulator-validation-plan.md docs/superpowers/records/feature-log.md
git commit -m "feat: refine mobile terminal ui"
```
