# Session Token Revoke 实现方案

## 1. 背景

Mobile 已有 Forget device，但当前只清除本机 SecureStore token。Server 端 token 仍会存在到过期时间，理论上只要 token 被复制，仍可继续打开 session。

本功能补齐最小撤销链路：Mobile Forget 时通知 Server revoke 当前 token，Server 删除 token，后续该 token 无法再用于 `session.open`。

## 2. 目标

- Server 提供 token revoke HTTP API。
- Server token store 支持删除指定 token。
- JSON token store revoke 后写回文件。
- Mobile Forget 调用 revoke API 后清除本地 token。
- 即使 revoke 请求失败，Mobile 也允许清除本地 token，并显示失败提示，避免用户被卡住。

## 3. 非目标

- 不做账号鉴权。
- 不做批量 revoke。
- 不做按设备 revoke 所有 token。
- 不做 refresh token。

## 4. 技术设计

### 4.1 API

新增：

```text
POST /session-tokens/revoke
```

请求：

```json
{
  "deviceId": "mac-1",
  "sessionToken": "token"
}
```

行为：

- token 不存在：返回 `200 { revoked: false }`，避免暴露 token 是否存在。
- token 存在但 deviceId 不匹配：返回 `400 { error }`。
- token 存在且匹配：删除 token，返回 `200 { revoked: true }`。

### 4.2 Store

`SessionTokenStore` 增加：

```ts
revokeSessionToken(input: { sessionToken: string; deviceId: string }): { revoked: boolean };
```

`MemorySessionTokenStore` 从 Map 删除。

`JsonFileSessionTokenStore` 调用内存实现后写回文件。

### 4.3 Mobile

`PairingClient` 增加：

```ts
revokeSessionToken({ deviceId, sessionToken }): Promise<{ revoked: boolean }>
```

`TerminalScreen.handleForgetPairing()`：

1. 如果有 `sessionToken`，调用 revoke API。
2. revoke 成功或失败后都执行本地清理。
3. revoke 失败时 append local line 提示，但不阻止 Forget。

## 5. 测试方案

- Server token store revoke 后 verify 返回 invalid。
- JSON token store revoke 后新实例也 verify invalid。
- Server `POST /session-tokens/revoke` 删除 token 后旧 token 无法打开 session。
- Mobile `PairingClient.revokeSessionToken()` 发送正确请求并解析响应。

## 6. 验收标准

- Forget 后本机 token 被清除。
- Forget 请求成功后 Server token 被删除。
- 被 revoke 的 token 不能再打开 terminal session。
- 全量测试、typecheck、build 通过。

## 7. 风险与后续

- Revoke API 当前只凭 token 本身授权，正式账号体系需要登录态和设备归属校验。
- 仍没有批量撤销和设备列表。
- HTTP pairing/revoke 接口还没有统一 dev token/header 鉴权。
