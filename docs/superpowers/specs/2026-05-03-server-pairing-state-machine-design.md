# Server 配对状态机实现方案

## 1. 背景

当前链路已经具备：

- Agent 持久 `deviceId`。
- 协议层配对消息：`pairing.create`、`pairing.created`、`pairing.requested`、`pairing.approved`、`pairing.rejected`。
- Server WebSocket 路由和 dev token 外网开发边界。

下一步需要把这些能力连起来，让 Server 能创建一次性配对码、接收 Mobile 配对请求、推送给 Agent，并在 Agent 本地确认后记录绑定关系。该功能是 iOS 扫码绑定和 macOS Agent 安装版二维码的前置。

## 2. 目标

- Agent 通过 `/ws/agent` 发送 `pairing.create` 后，Server 返回 `pairing.created`。
- Mobile 通过 HTTP 提交配对码后，Server 推送 `pairing.requested` 给对应 Agent。
- Agent 发送 `pairing.approved` 后，Server 创建内存绑定关系。
- Agent 发送 `pairing.rejected` 后，Server 标记请求失败。
- 配对码具备过期、一次性使用和重复使用保护。
- 现有终端远控链路不受影响。

## 3. 非目标

- 不做账号登录。
- 不接数据库。
- 不实现 Mobile 扫码 UI。
- 不实现 Agent GUI 确认弹窗。
- 不把绑定关系用于会话鉴权；短期 session token 在下一功能实现。

## 4. 用户流程

1. Agent 已连接并注册设备。
2. Agent 发送：

   ```json
   {"type":"pairing.create","deviceId":"device-1"}
   ```

3. Server 返回：

   ```json
   {"type":"pairing.created","deviceId":"device-1","pairingCode":"123456","expiresAt":"...","serverUrl":"...","deviceName":"MacBook Pro"}
   ```

4. Mobile 调用：

   ```http
   POST /pairing/requests
   {
     "pairingCode": "123456",
     "mobileClientId": "mobile-1",
     "mobileName": "Alice iPhone"
   }
   ```

5. Server 推送给 Agent：

   ```json
   {"type":"pairing.requested","pairingRequestId":"...","deviceId":"device-1","mobileClientId":"mobile-1","mobileName":"Alice iPhone","requestedAt":"..."}
   ```

6. Agent 本地确认后发送：

   ```json
   {"type":"pairing.approved","pairingRequestId":"...","deviceId":"device-1"}
   ```

7. Server 创建绑定记录，后续 `/pairing/bindings` 可查看。

## 5. 技术设计

### 5.1 组件变化

- 新增 `apps/server/src/pairing/pairingStore.ts`
- 新增 `apps/server/src/pairing/pairingService.ts`
- 修改 `apps/server/src/ws.ts`
- 新增 `apps/server/tests/pairing/pairingService.test.ts`
- 修改 `apps/server/tests/ws.test.ts`

### 5.2 状态模型

内存状态：

- `PairingCodeRecord`
  - `pairingCode`
  - `deviceId`
  - `deviceName`
  - `expiresAt`
  - `createdAt`
  - `usedAt`
- `PairingRequestRecord`
  - `pairingRequestId`
  - `pairingCode`
  - `deviceId`
  - `mobileClientId`
  - `mobileName`
  - `requestedAt`
  - `status`: `pending | approved | rejected`
  - `decidedAt`
  - `reason`
- `DeviceBindingRecord`
  - `bindingId`
  - `deviceId`
  - `mobileClientId`
  - `mobileName`
  - `approvedAt`

### 5.3 接口变化

新增 HTTP：

- `POST /pairing/requests`
  - 输入：`pairingCode`、`mobileClientId`、`mobileName`
  - 成功：`202`，返回 `pairingRequestId`、`deviceId`、`status: "pending"`
  - 失败：`400`，返回 `{ error: "..." }`
- `GET /pairing/bindings`
  - 返回当前内存绑定列表，方便开发验证。

新增 Agent WebSocket 行为：

- 注册前仍只允许 `device.register`。
- 注册后允许：
  - `pairing.create`
  - `pairing.approved`
  - `pairing.rejected`
  - 原有 `terminal.output`
  - 原有 `terminal.exit`

### 5.4 错误处理

- 过期配对码：`Pairing code expired`
- 不存在配对码：`Pairing code not found`
- 已使用配对码：`Pairing code already used`
- Agent 离线：`Device <id> is not online`
- Agent approve/reject 不属于自己的请求：`Pairing request <id> is not pending for device <id>`

HTTP 请求失败返回 `400`，WebSocket 失败通过已有 `session.error` 返回。

### 5.5 安全边界

- 本阶段仍是开发态内存配对，不可直接作为公网正式账号体系。
- dev token guard 已保护 WebSocket；HTTP 配对接口在本阶段不强制登录，后续账号系统必须补上。
- 配对码一次性使用，并且只在有效期内可提交。

## 6. 测试方案

- `pairingService.test.ts`
  - 创建配对码。
  - 过期码失败。
  - 重复使用失败。
  - Agent 拒绝失败并记录 rejected。
  - Agent approve 成功并创建 binding。
- `ws.test.ts`
  - Agent 注册后发送 `pairing.create` 能收到 `pairing.created`。
  - Mobile HTTP 提交配对码后 Agent 收到 `pairing.requested`。
  - Agent approve 后 `GET /pairing/bindings` 返回绑定。
  - 现有终端 session 流仍通过。

## 7. 验收标准

- Server tests 通过。
- Workspace tests/typecheck/build 通过。
- 不破坏已有 Mobile -> Server -> Agent -> PTY 终端链路。
- 功能记录写入 `docs/superpowers/records/feature-log.md`。

## 8. 风险与后续

- 内存 store 重启丢失状态；下一步数据库持久化时替换 store。
- HTTP 配对接口尚未登录鉴权；下一步账号体系和 session token 需要补齐。
- Agent 还没有 UI 展示配对码或确认弹窗；后续 macOS Agent 安装版实现。
