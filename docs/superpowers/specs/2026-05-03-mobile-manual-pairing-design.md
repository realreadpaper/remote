# Mobile 手动配对入口实现方案

## 1. 背景

Server 已经支持开发态配对状态机：

- Agent 创建配对码。
- Mobile 通过 `POST /pairing/requests` 提交配对码。
- Server 推送 `pairing.requested` 给 Agent。
- Agent approve 后 Server 创建内存 binding。

Mobile 目前只有终端连接界面，没有输入配对码的入口。下一步先做“手动输入配对码”的最小入口，方便真机和模拟器验证配对链路；扫码、登录、安全存储放后续。

## 2. 目标

- Mobile runtime config 提供 `apiBaseUrl`，默认从 `sessionUrl` 推导。
- 新增 Mobile pairing client，调用 `POST /pairing/requests`。
- Terminal 页新增紧凑配对面板：输入配对码、提交、展示 pending/失败状态。
- 提交成功后显示 `pairingRequestId` 和 pending 状态，等待 Agent 本地确认。
- 不影响现有终端连接和 smoke 模式。

## 3. 非目标

- 不做扫码。
- 不做登录。
- 不做 secure storage 持久化。
- 不做设备列表页。
- 不做绑定成功轮询；绑定结果仍通过 server `GET /pairing/bindings` 开发验证。
- 不实现 Agent UI 确认弹窗。

## 4. 用户流程

1. Agent 创建配对码，开发者从 Agent 日志或 WebSocket 调试拿到 code。
2. iOS App 顶部输入配对码。
3. 用户点击 `Pair`。
4. Mobile 调用 `POST /pairing/requests`。
5. 成功后界面显示 `pending` 和请求 ID。
6. Agent 收到 `pairing.requested`，后续由 Agent approve/reject。

## 5. 技术设计

### 5.1 组件变化

- `apps/mobile/src/config/runtimeConfig.ts`
  - 增加 `apiBaseUrl`。
  - 增加 `displayApiBaseUrl`。
  - 默认由 `sessionUrl` 推导：`ws://host/ws/mobile` -> `http://host`，`wss://host/ws/mobile` -> `https://host`。
- `apps/mobile/src/protocol/pairingClient.ts`
  - 新增 `requestPairing()`。
  - 支持注入 `fetch`，便于测试。
- `apps/mobile/src/components/TerminalScreen.tsx`
  - 新增配对码输入状态。
  - 新增 `Pair` 按钮。
  - 成功/失败状态写入界面和 terminal 本地输出。

### 5.2 HTTP 接口

请求：

```http
POST /pairing/requests
{
  "pairingCode": "123456",
  "mobileClientId": "mobile-dev",
  "mobileName": "iPhone"
}
```

响应：

```json
{
  "pairingRequestId": "...",
  "deviceId": "...",
  "status": "pending"
}
```

### 5.3 Runtime 配置

新增环境变量：

- `EXPO_PUBLIC_REMOTE_API_URL`：显式 API base URL。
- `EXPO_PUBLIC_REMOTE_MOBILE_CLIENT_ID`：开发期 mobile client id，默认 `mobile-dev`。
- `EXPO_PUBLIC_REMOTE_MOBILE_NAME`：开发期 mobile 名称，默认 `iPhone`。

### 5.4 错误处理

- 配对码为空：本地提示 `Enter a pairing code first.`，不发请求。
- HTTP 非 2xx：解析 `{ error }`，展示 server error。
- 网络失败：展示 `Pairing request failed: <reason>`。
- 协议响应缺字段：展示 `Invalid pairing response.`。

### 5.5 安全边界

- 本阶段是开发配对入口，不等同正式安全绑定。
- 配对码不持久保存。
- dev token 不加入 HTTP pairing 请求；公网产品化前需要登录态和短期 token。

## 6. 测试方案

- `runtimeConfig.test.ts`
  - 默认从 WebSocket URL 推导 API URL。
  - `wss` 推导为 `https`。
  - 显式 `EXPO_PUBLIC_REMOTE_API_URL` 覆盖推导。
- `pairingClient.test.ts`
  - 成功提交 pairing request。
  - HTTP error 使用 server error。
  - 缺字段响应失败。
- `pnpm --filter @remote/mobile test`
- 影响 mobile/runtime，最终运行 workspace test/typecheck/build。

## 7. 验收标准

- Mobile 能向 Server 发起配对请求。
- Server 集成测试仍能证明 Agent 收到 `pairing.requested`。
- 现有 Terminal 连接按钮和命令输入不受影响。
- 所有测试、类型检查、构建通过。

## 8. 风险与后续

- 当前 UI 是开发态手动输入，后续需要独立 Pairing screen 和扫码。
- 当前不保存 binding，App 重启后不知道绑定状态；后续 secure storage 解决。
- 当前不轮询 binding 结果；后续设备列表和 session token 会解决。
