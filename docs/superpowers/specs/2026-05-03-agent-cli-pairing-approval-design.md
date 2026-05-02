# Agent CLI 配对码展示和确认实现方案

## 1. 背景

Server 已实现配对状态机，Mobile 已有手动输入配对码入口。但当前 Agent 还不会主动创建配对码，也不会处理 `pairing.requested`。开发者仍需要手写 WebSocket probe 才能完成配对闭环。

本功能让 Node CLI Agent 支持开发态配对闭环：启动后自动请求配对码并打印，收到 Mobile 配对请求后在本地终端确认或拒绝。

## 2. 目标

- Agent 收到 `device.registered` 后自动发送 `pairing.create`。
- Agent 收到 `pairing.created` 后在本地控制台展示配对码、过期时间、server 地址。
- Agent 收到 `pairing.requested` 后在本地控制台询问是否批准。
- 用户输入 `y`/`yes` 时发送 `pairing.approved`。
- 用户输入其他内容或非交互环境时发送 `pairing.rejected`。
- 不影响现有终端会话逻辑。

## 3. 非目标

- 不做 GUI。
- 不做二维码渲染。
- 不做菜单栏。
- 不做持久化绑定列表。
- 不实现 secure approval policy；正式安全策略在账号/session token 阶段完成。

## 4. 用户流程

1. 用户启动 Agent。
2. Agent 连接 Server 并注册设备。
3. Server 返回 `device.registered`。
4. Agent 自动发送 `pairing.create`。
5. Server 返回 `pairing.created`。
6. Agent 控制台打印配对码。
7. 用户在 iOS App 输入配对码并点击 `Pair`。
8. Agent 控制台出现确认提示。
9. 用户输入 `y` 后，Agent 发送 `pairing.approved`。

## 5. 技术设计

### 5.1 组件变化

- 新增 `apps/agent/src/pairing.ts`
  - `displayPairingCode()`
  - `promptPairingApproval()`
  - 测试可注入的类型定义。
- 修改 `apps/agent/src/agentClient.ts`
  - 处理 `device.registered`、`pairing.created`、`pairing.requested`。
  - 支持依赖注入 display 和 approve 函数。
- 修改 `apps/agent/tests/agentClient.test.ts`
  - 覆盖自动创建配对码、展示配对码、approve/reject 发送消息。

### 5.2 消息流

Agent 接收：

- `device.registered`
- `pairing.created`
- `pairing.requested`

Agent 发送：

- `pairing.create`
- `pairing.approved`
- `pairing.rejected`

### 5.3 默认交互

默认 `promptPairingApproval()` 使用 `node:readline/promises`：

- TTY 环境：询问 `Approve pairing for <mobileName> (<mobileClientId>)? [y/N]`
- 非 TTY 环境：拒绝，reason 为 `Agent console is not interactive`

### 5.4 错误处理

- approve prompt 抛错：Agent 发送 `pairing.rejected`，reason 为错误信息。
- 发送失败沿用现有 `sendMessage()` 错误处理。
- 无效 Server 消息仍走现有 `Invalid agent server message`。

## 6. 测试方案

- `agentClient.test.ts`
  - 收到 `device.registered` 后发送 `pairing.create`。
  - 收到 `pairing.created` 后调用 display 函数。
  - 收到 `pairing.requested` 且 approval 返回 approve 后发送 `pairing.approved`。
  - 收到 `pairing.requested` 且 approval 返回 reject 后发送 `pairing.rejected`。
- `pnpm --filter @remote/agent test`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## 7. 验收标准

- Agent 无需 WebSocket probe 即可创建配对码。
- Mobile 手动提交配对码后，Agent 能本地确认并发送 approve/reject。
- 现有终端命令链路不受影响。

## 8. 风险与后续

- CLI prompt 只是开发态能力，安装版需要 GUI 或菜单栏确认。
- 非交互环境默认拒绝，云端/后台运行时需要显式策略或本地 UI。
- 配对码仍只打印文本，后续需要二维码。
