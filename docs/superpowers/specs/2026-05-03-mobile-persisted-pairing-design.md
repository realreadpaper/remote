# Mobile 持久配对与已绑定设备实现方案

## 1. 背景

当前 Mobile 已经能通过配对码拿到 `sessionToken`，并在同一次 App 生命周期内携带 token 打开终端。但 token 只存在 `TerminalScreen` 组件内存中，App 重启、刷新或崩溃后会丢失，用户需要重新配对。

本功能把 Mobile 已批准的配对结果保存到 iOS/Android 安全存储中，并在启动时恢复。目标是让真机使用更接近产品：配对一次后，下次打开 App 能直接看到已绑定设备并点击连接。

## 2. 目标

- Mobile 使用 `expo-secure-store` 保存已批准的配对 token。
- 保存内容包含 `deviceId`、`sessionToken`、`expiresAt`、`pairedAt`。
- App 启动时读取本地保存的配对信息。
- 如果 token 未过期，Mobile 自动恢复为 paired 状态。
- 如果 token 已过期或数据损坏，Mobile 清除本地记录并提示需要重新配对。
- 用户成功配对后，Mobile 将 token 写入安全存储。
- Connect 时优先使用恢复出的 token。
- UI 显示一个紧凑的 “Paired device” 状态行，便于用户确认当前连接目标。

## 3. 非目标

- 不做多设备列表管理。
- 不做 token refresh。
- 不做云端设备列表。
- 不做撤销绑定 UI。
- 不解决 Server 重启后内存 token 失效的问题。
- 不引入账号系统。

## 4. 技术设计

### 4.1 存储抽象

新增 `apps/mobile/src/state/pairingTokenStore.ts`：

- `PairingTokenRecord`
- `PairingTokenStorage`
- `SecureStorePairingTokenStorage`
- `savePairingToken()`
- `loadPairingToken()`
- `clearPairingToken()`

存储 key：

```text
remote-terminal.pairing-token.v1
```

数据格式：

```json
{
  "deviceId": "mac-1",
  "sessionToken": "token",
  "expiresAt": "2026-05-04T00:00:00.000Z",
  "pairedAt": "2026-05-03T00:00:00.000Z"
}
```

`loadPairingToken()` 会严格校验字段：

- 缺失字段：返回 `null` 并清除存储。
- JSON 损坏：返回 `null` 并清除存储。
- `expiresAt <= now`：返回 `null` 并清除存储。
- 有效：返回 `PairingTokenRecord`。

### 4.2 Expo SecureStore

新增依赖：

```text
expo-secure-store
```

默认存储实现使用：

- `SecureStore.getItemAsync(key)`
- `SecureStore.setItemAsync(key, value)`
- `SecureStore.deleteItemAsync(key)`

测试中不直接依赖原生模块，而是注入 fake storage。

### 4.3 TerminalScreen 接入

`TerminalScreen` 启动时：

1. 创建默认 secure storage。
2. 调用 `loadPairingToken()`。
3. 有效时设置 `sessionToken` 和 paired 文案。
4. 无效时保持未配对状态。

配对成功时：

1. 保存 token。
2. 设置 `sessionToken`。
3. 设置 paired 文案。

Connect 时：

- 使用 state 中的 `sessionToken` 创建 `SessionClient`。
- 如果 token 缺失，仍允许 Connect，让 Server 返回明确的 `Missing session token`，同时 UI 保持错误提示。

### 4.4 UI

保留当前紧凑配对面板，不做复杂改版。新增一行状态：

- 有效 token：`Paired <deviceId> · expires <date>`
- 无 token：不显示额外行或显示当前 pending/error 状态。

## 5. 测试方案

### Unit

- `savePairingToken()` 将结构化 token 写入 storage。
- `loadPairingToken()` 能读取有效 token。
- `loadPairingToken()` 遇到过期 token 时返回 `null` 并清除。
- `loadPairingToken()` 遇到损坏 JSON 时返回 `null` 并清除。
- `clearPairingToken()` 删除存储。

### Mobile

- `PairingClient` 和 `SessionClient` 现有测试保持通过。
- `TerminalScreen` 当前没有组件测试环境，本轮通过类型检查和协议层测试覆盖核心逻辑。

### 全量

- `pnpm --filter @remote/mobile test`
- `pnpm --filter @remote/mobile typecheck`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## 6. 验收标准

- iOS 模拟器编译通过。
- Mobile 配对成功后 token 能写入 SecureStore。
- App 重启后能从 SecureStore 恢复有效 token。
- 过期或损坏 token 不会被用于连接。
- 现有配对、连接、终端输入测试全部通过。

## 7. 风险与后续

- Server 端 token 仍是内存态，Server 重启后 Mobile 本地 token 会变成无效 token；后续需要 Server 持久化 token 或 refresh。
- 当前只支持一个本地已绑定设备；后续设备列表会扩展为多记录。
- 没有撤销绑定按钮；后续增加 “Forget device”。
- SecureStore 可用性依赖 Expo 原生模块，真机需要重新安装/构建开发客户端或 Expo Go 支持对应模块。
