# iOS Client Minimal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 iOS 客户端优化成终端优先、极简、浅色、符合 Apple 工具审美的界面。

**Architecture:** 保留现有 Expo React Native 单屏结构。先把颜色、间距、圆角、字体等视觉决策固化到 `mobileShellTheme` 并用测试约束，再让 `TerminalScreen` 使用这些 token 做布局和视觉收敛。

**Tech Stack:** Expo React Native, TypeScript, Vitest, pnpm workspaces.

---

## File Structure

- `apps/mobile/src/components/mobileShellTheme.ts`: 主题颜色、字体和稳定布局 token。
- `apps/mobile/src/components/TerminalScreen.tsx`: 单屏终端 UI，消费主题 token。
- `apps/mobile/tests/mobileShellTheme.test.ts`: 约束 UI 方向，防止回到整屏黑或厚重卡片风格。
- `docs/superpowers/records/feature-log.md`: 记录本次 UI 优化和验证结果。

## Task 1: Theme Tokens

- [x] 写失败测试：主题必须是浅色中性背景、白色面板、深色终端区、Apple 蓝主动作，并提供稳定布局 token。
- [x] 运行 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test -- mobileShellTheme.test.ts`，确认红灯。
- [x] 修改 `mobileShellTheme.ts`，加入极简主题 token。
- [x] 运行同一测试，确认绿灯。

## Task 2: Terminal Screen Visual Polish

- [x] 修改 `TerminalScreen.tsx`：顶部更轻、配对区更紧凑、终端区更大、快捷键工具条更薄、底部输入更稳定。
- [x] 运行 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test`。
- [x] 运行 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck`。
- [x] 运行 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm build`。
- [x] 用 `expo run:ios --device "iPhone 15"` 重新安装开发构建，并截图验证 UI。
- [x] 更新 `docs/superpowers/records/feature-log.md`。
- [ ] 提交并推送。
