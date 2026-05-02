# Session Token 绑定鉴权实现方案

## 1. 背景

当前链路已经具备：

- Agent 持久设备身份。
- Server 内存配对状态机。
- Mobile 手动输入配对码。
- Agent CLI 展示配对码并本地 approve/reject。

但终端会话仍然没有真正依赖配对结果：Mobile 可以直接向 `/ws/mobile` 发送 `session.open` 打开在线设备。这个缺口会导致配对只是展示流程，不是访问控制。

本功能把配对结果接入终端会话：Agent 批准 Mobile 后，Server 发放短期 `sessionToken`；Mobile 保存 token；后续 `session.open` 必须携带 token，Server 校验 token 后才打开终端。

## 2. 目标

- Agent 发送 `pairing.approved` 后，Server 创建 binding，并生成短期 `sessionToken`。
- Mobile 可通过 `GET /pairing/requests/:pairingRequestId` 查询配对状态。
- 配对状态为 approved 时，接口返回 `auth.sessionToken` 内容。
- Mobile 在手动配对提交后轮询状态接口，拿到 token 后保存到内存状态。
- `SessionClient` 支持传入 `sessionToken`，连接打开时发送 `{ type: "session.open", deviceId, sessionToken }`。
- Server 对 `/ws/mobile` 的 `session.open` 强制校验 token。
- 未携带 token、token 不存在、token 过期、token 对应设备不匹配时返回 `session.error`。

## 3. 非目标

- 不做账号系统。
- 不做 refresh token。
- 不做数据库持久化。
- 不做 Keychain/SecureStore 持久保存。
- 不做多设备绑定管理 UI。
- 不改变 dev token 的 WebSocket 边界；dev token 仍只保护外网开发入口，不替代 session token。

## 4. 用户流程

1. 用户启动 Agent。
2. Agent 打印配对码。
3. 用户在 iOS App 输入配对码并点击 `Pair`。
4. Server 返回 `pairingRequestId`，Mobile 显示 pending。
5. Agent 本地提示是否批准。
6. 用户在 Agent 终端输入 `y`。
7. Server 创建 binding 和短期 token。
8. Mobile 轮询配对状态，拿到 token 后显示 paired。
9. 用户点击 `Connect`。
10. Mobile 发送带 `sessionToken` 的 `session.open`。
11. Server 校验 token 后打开终端会话。

## 5. 技术设计

### 5.1 Server token 模型

新增内存 token store，记录：

- `sessionToken`
- `deviceId`
- `mobileClientId`
- `bindingId`
- `issuedAt`
- `expiresAt`

默认有效期：24 小时。

token 使用 `crypto.randomBytes(32).toString("base64url")` 生成。Server 只在内存中保存 token 记录；本轮不做 hash 存储，因为这是开发态内存实现，后续数据库版本再升级为 hash。

### 5.2 Pairing 状态查询

新增 HTTP：

```text
GET /pairing/requests/:pairingRequestId
```

返回：

- pending：`{ pairingRequestId, deviceId, status: "pending" }`
- rejected：`{ pairingRequestId, deviceId, status: "rejected", reason }`
- approved：

```json
{
  "pairingRequestId": "request-1",
  "deviceId": "mac-1",
  "status": "approved",
  "auth": {
    "type": "auth.sessionToken",
    "sessionId": "pending",
    "deviceId": "mac-1",
    "sessionToken": "token",
    "expiresAt": "2026-05-04T00:00:00.000Z"
  }
}
```

`auth.sessionToken.sessionId` 当前用于协议兼容，配对阶段还没有真实 terminal session，因此固定为 `pending`。正式 session 打开后仍以 `session.opened.sessionId` 为准。

### 5.3 Server session.open 校验

`/ws/mobile` 收到 `session.open` 时：

1. 要求 `sessionToken` 存在。
2. 查找 token 记录。
3. 校验未过期。
4. 校验 token 的 `deviceId` 等于 `session.open.deviceId`。
5. 校验通过后调用现有 `hub.openSession()`。

错误统一返回 `session.error`：

- `Missing session token`
- `Invalid session token`
- `Session token expired`
- `Session token is not valid for device <deviceId>`

### 5.4 Mobile 配对轮询

`PairingClient` 增加：

- `getPairingRequest(pairingRequestId)`
- `waitForApproval(pairingRequestId, options)`

默认轮询参数：

- interval：1000ms
- timeout：60000ms

`TerminalScreen` 在提交配对请求后调用 `waitForApproval()`：

- pending：保持 pending 文案。
- approved：保存 `sessionToken` 到组件内存状态，显示 paired。
- rejected：显示 rejected reason。
- timeout：显示超时错误。

### 5.5 Mobile session.open

`SessionClientOptions` 增加可选 `sessionToken`。

- 有 token 时，`onopen` 发送 `{ type: "session.open", deviceId, sessionToken }`。
- 没有 token 时仍发送不带 token 的消息，让 Server 返回明确错误；这样自动连接场景能显示“需要先配对”。

`TerminalScreen` 将内存中的 token 传给 `SessionClient`。

## 6. 测试方案

### Server

- 配对批准后，`GET /pairing/requests/:id` 返回 approved 和 session token。
- pending request 查询返回 pending。
- rejected request 查询返回 rejected 和 reason。
- `session.open` 不带 token 返回 `session.error`。
- `session.open` 带错误 token 返回 `session.error`。
- `session.open` 带正确 token 成功打开 session。
- token 设备不匹配时拒绝。

### Mobile

- `PairingClient` 能查询 pending/approved/rejected。
- `PairingClient.waitForApproval()` 在 approved 时返回 token。
- `PairingClient.waitForApproval()` 在 rejected 时抛错。
- `SessionClient` 有 token 时发送带 token 的 `session.open`。
- `SessionClient` 无 token 时保持原消息形态。

### 全量

- `pnpm --filter @remote/server test`
- `pnpm --filter @remote/mobile test`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## 7. 验收标准

- 未配对 Mobile 无法打开终端。
- 完成配对并批准后，Mobile 能拿到 session token。
- Mobile 携带 token 后能打开终端并继续输入命令。
- 现有 Agent 终端转发行为不变。

## 8. 风险与后续

- token 和 binding 仍在内存中，Server 重启会失效；后续云中转必须持久化。
- Mobile token 只保存在内存中，App 重启需要重新配对；后续接入 SecureStore。
- 当前没有账号身份，token 发放仍依赖配对码和 Agent 本地批准；后续加入账号登录和设备列表。
- token 未做撤销接口；后续绑定管理 UI 需要支持撤销。
