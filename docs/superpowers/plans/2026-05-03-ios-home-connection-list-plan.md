# iOS Home Connection List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 iOS 客户端从“直达终端页”升级为“首页连接列表 -> 新建连接 -> 终端会话”的正式产品流程。

**Architecture:** 保留现有 Expo 单应用结构。先把本地 token 存储升级为多设备列表，再把 `TerminalScreen` 改为接收选中设备，最后由 `App.tsx` 管理首页、新建连接和终端页的轻量路由状态。

**Tech Stack:** Expo React Native, TypeScript, SecureStore, Vitest, pnpm workspaces.

---

## File Structure

- `apps/mobile/src/state/pairingTokenStore.ts`: 多设备 token 存储、旧单 token 迁移、upsert/remove。
- `apps/mobile/tests/pairingTokenStore.test.ts`: 存储红绿灯测试。
- `apps/mobile/src/components/HomeScreen.tsx`: 首页连接列表和空状态。
- `apps/mobile/src/components/NewConnectionScreen.tsx`: 配对码输入和审批等待。
- `apps/mobile/src/components/TerminalScreen.tsx`: 只负责选中设备的终端会话。
- `apps/mobile/App.tsx`: 轻量路由状态。
- `docs/superpowers/records/feature-log.md`: 功能记录。

## Task 1: Multi Device Pairing Token Store

- [x] 写失败测试：保存两个设备后 `loadPairingTokens` 返回两个记录。
- [x] 写失败测试：旧 `PAIRING_TOKEN_STORAGE_KEY` 单 token 能迁移为列表。
- [x] 写失败测试：`removePairingToken` 只移除指定设备。
- [x] 实现 `loadPairingTokens`、`upsertPairingToken`、`removePairingToken`。
- [x] 保留 `loadPairingToken`、`savePairingToken`、`clearPairingToken` 兼容旧调用。

## Task 2: Home And New Connection Screens

- [x] 新增 `HomeScreen.tsx`。
- [x] 新增 `NewConnectionScreen.tsx`。
- [x] 抽出新建连接流程，配对成功后回调保存 token。
- [x] 首页空状态和列表状态都使用当前极简主题。

## Task 3: Selected Device Terminal

- [x] 修改 `TerminalScreen` 接收 `selectedDevice`、`onBack`、`onForget`。
- [x] `SessionClient` 使用 `selectedDevice.deviceId` 和 `selectedDevice.sessionToken`。
- [x] 终端页返回首页时关闭当前 session client。
- [x] 忘记设备后移除列表记录并回到首页。

## Task 4: Verification And Record

- [x] 运行移动端存储测试。
- [x] 运行移动端全量测试。
- [x] 运行全仓测试、类型检查、构建。
- [x] iOS 模拟器安装并截图验证首页。
- [x] 更新 feature log。
- [x] 提交并推送。
