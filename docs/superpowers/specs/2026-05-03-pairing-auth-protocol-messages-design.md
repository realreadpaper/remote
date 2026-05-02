# 配对与鉴权协议消息实现方案

## 1. 背景

当前 iOS 开发链路可以通过 Expo/局域网连接 macOS Agent，并能打开终端执行命令；Server 也已经有最小 dev token 边界。但产品化接入还缺少“设备绑定”和“短期会话授权”的协议基础。后续 Agent 安装版需要展示配对码或二维码，iOS 客户端需要提交配对请求，Server 需要把请求推送给 Agent 并记录会话状态。

本功能先补齐协议消息 schema，不实现配对状态机、账号系统、数据库或 UI。

## 2. 目标

- 在 `packages/protocol` 增加配对、设备状态、短期会话 token 和终端快照消息。
- 所有新增消息继续使用 `zod` 做运行时校验。
- 保持现有终端消息兼容，不影响当前本地和局域网链路。
- 为后续 Server 配对状态机、Mobile 扫码绑定、Agent 安装版二维码提供稳定消息结构。

## 3. 非目标

- 不实现配对码创建、过期、确认、拒绝状态机。
- 不实现登录、用户、设备绑定数据库。
- 不实现 Mobile 扫码 UI。
- 不实现 Agent GUI、二维码渲染或安装包。
- 不实现会话恢复逻辑，只定义 `terminal.snapshot` 消息结构。

## 4. 用户流程

本阶段没有新的可见用户流程，只有协议能力准备。后续完整流程会是：

1. Agent 请求 Server 创建配对码。
2. Server 返回 `pairing.created`。
3. iOS 扫码或输入配对码后提交配对请求。
4. Server 向 Agent 推送 `pairing.requested`。
5. Agent 本地允许或拒绝，发送 `pairing.approved` 或 `pairing.rejected`。
6. Mobile 打开终端会话时携带短期 `sessionToken`。
7. Server 推送 `device.status` 和 `terminal.snapshot` 支撑设备列表与会话恢复。

## 5. 技术设计

### 5.1 组件变化

只修改协议包：

- `packages/protocol/src/messages.ts`
- `packages/protocol/tests/messages.test.ts`

### 5.2 协议变化

新增 Client 消息：

- `pairing.create`：Agent 请求创建一次性配对码。
- `pairing.approved`：Agent 本地确认绑定请求。
- `pairing.rejected`：Agent 本地拒绝绑定请求。
- `session.open` 增加可选 `sessionToken`，供后续鉴权使用。
- `terminal.snapshot.request`：Mobile 请求恢复会话快照。

新增 Server 消息：

- `pairing.created`：Server 返回配对码、过期时间、server URL、设备信息。
- `pairing.requested`：Server 将 Mobile 绑定请求推送给 Agent。
- `auth.sessionToken`：Server 或 API 层返回短期会话 token。
- `device.status`：Server 推送设备在线状态和能力。
- `terminal.snapshot`：Server/Agent 返回终端最近输出和会话状态。

字段约束：

- ID、token、pairing code 必须是非空字符串。
- `expiresAt`、`requestedAt`、`lastSeenAt` 使用 ISO 字符串，协议层只校验非空，业务层再校验时间语义。
- `terminal.snapshot.output` 是字符串数组，保留最近输出片段。
- `terminal.snapshot.exitCode` 为 `number | null`，运行中为 `null`。

### 5.3 数据变化

无持久化数据变化。本阶段只扩展消息类型。

### 5.4 错误处理

协议层继续保持严格 schema：

- 未知消息类型抛出解析错误。
- 已知消息携带多余字段抛出解析错误。
- 缺少关键字段或字段为空抛出解析错误。

业务错误仍通过已有 `session.error` 表达；后续配对状态机可以增加专用错误码，不在本阶段实现。

### 5.5 安全边界

- `sessionToken` 只定义为协议字段，不在本阶段生成或校验。
- token 不应出现在日志或 UI 明文展示；具体脱敏由后续 Server/Mobile 功能实现。
- 配对码只允许短期使用；过期和一次性使用由后续 Server 状态机实现。

## 6. 测试方案

- 增加协议单测，覆盖每个新增合法消息可以解析。
- 增加缺失 `deviceId`、`pairingCode`、`sessionId`、`sessionToken` 的失败测试。
- 增加 `session.open` 带可选 `sessionToken` 的兼容测试。
- 运行 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol test`。
- 本功能只改协议包，提交前运行 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/protocol typecheck`。

## 7. 验收标准

- 新增协议消息都有 schema 和测试。
- 现有 103 条 workspace 测试不因协议扩展失败。
- `ClientMessage` 和 `ServerMessage` 类型能被后续 Server、Agent、Mobile 引用。
- 现有本地终端链路消息保持兼容。

## 8. 风险与后续

- 只定义协议不等于安全完成；下一步必须实现 Server 配对状态机和 session token 校验。
- 字段命名一旦被业务层使用，后续修改成本会上升；本阶段保持字段少而明确。
- `terminal.snapshot` 先用纯文本输出数组，后续 ANSI 终端渲染可能需要扩展光标和屏幕缓冲结构。
