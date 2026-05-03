# macOS Agent Desktop Shell Design

## 背景

当前 macOS Agent 是命令行进程：通过 `pnpm dev:agent` 启动，读取环境变量，注册到 Server，收到会话后用 `node-pty` 打开本机 Shell。这个形态适合开发，不适合普通用户安装和长期运行。主 MVP 计划的下一步是给 Agent 加一个 macOS 桌面壳，让用户能看到设备状态、配对信息，并能从本机控制终端能力。

Task 10 只做“可运行的最小桌面壳”，签名、公证、正式 `.dmg` 和 Developer ID 流程进入 Task 11。

## 目标

- 新增 `apps/agent-desktop` workspace。
- 使用 Electron 包装现有 `apps/agent` core，不复制 Agent 协议和 PTY 逻辑。
- 主窗口展示：
  - 设备名称。
  - Agent 连接状态。
  - Server 地址。
  - 终端能力开关。
  - 当前配对码和二维码。
  - 待确认的手机配对请求。
- macOS 菜单栏/托盘展示连接状态，并提供显示窗口、启停终端能力、退出入口。
- 本地文档写明开发运行和本地打包步骤。
- 保持 `pnpm test`、`pnpm typecheck`、`pnpm build` 可通过。

## 非目标

- 不做签名、公证、notarization、正式安装包发布。
- 不做系统开机启动。
- 不做完整日志查看器。
- 不做多设备、多账号管理。
- 不重写 Agent core。
- 不实现远程桌面、文件管理或服务状态面板。

## 方案选择

### 方案 A：Electron

Electron 主进程与现有 Agent 同为 Node runtime，可以直接复用 `AgentClient`、`loadAgentConfig()` 和 `node-pty`。桌面壳只负责窗口、菜单栏、IPC、配置展示和生命周期控制。缺点是安装包体积较大，但 MVP 阶段开发速度和复用率最高。

### 方案 B：Tauri

Tauri 包体更小，系统集成更轻，但当前 Agent 是 TypeScript + `node-pty`，仍需要额外 Node sidecar 或 Rust bridge。这个阶段会增加进程管理和打包复杂度。

### 方案 C：Swift 原生

Swift 原生体验最好，但需要重写 Agent runtime 或把 Node Agent 作为子进程管理。对当前目标来说成本最高，适合后续成熟后再评估。

## 决策

选择 Electron。原因：

- 直接复用现有 TypeScript Agent core。
- `node-pty` 在 Electron/Node 环境中路径最短。
- 可以用最少的桥接代码完成窗口、菜单栏和配对确认。
- 后续 Task 11 可以基于 Electron Builder 或 electron-forge 增加签名、公证和安装包。

## 架构

```text
apps/agent-desktop
  |
  | imports
  v
apps/agent
  |
  | WSS
  v
Server
```

### 进程划分

- Electron main process：
  - 创建窗口。
  - 创建 macOS menu/tray。
  - 加载 Agent config。
  - 启动/停止 AgentClient。
  - 接收 Agent pairing/status callback。
  - 通过 IPC 推送状态给 renderer。
- Electron preload：
  - 暴露受控 API：读取状态、订阅状态、启停终端能力、批准/拒绝配对、退出。
  - 不暴露 Node 全局能力给 renderer。
- Renderer：
  - 静态 HTML/CSS/JS。
  - 展示状态和配对二维码。
  - 发送用户操作到 main process。

### Agent core 复用边界

`apps/agent` 保持 Agent core 所有协议、PTY 和配对逻辑。为了让 desktop 壳能安全控制生命周期，需要给 `AgentClient` 增加一个公开 `close()` 方法：

- 关闭 WebSocket。
- 清理所有 PTY session。
- 可重复调用。

`apps/agent/package.json` 增加 subpath exports，让 desktop 壳能通过包边界导入：

- `@remote/agent/agentClient`
- `@remote/agent/config`
- `@remote/agent/pairing`

## UI 设计

风格选择：安静、实用、运维工具感。桌面壳是长期后台工具，不做营销式 hero，不做装饰性大卡片。界面强调快速扫描：

- 顶部：设备名、连接状态、终端能力开关。
- 中部：配对二维码和 6 位配对码。
- 右侧/下方：Server URL、Device ID、Shell。
- 底部：待确认配对请求，提供 Approve / Reject。

颜色使用中性浅色背景、深色正文、绿色/红色状态点和蓝色操作按钮，避免单一紫蓝渐变主题。

## 状态模型

Desktop shell 维护一个可序列化状态：

```ts
interface DesktopState {
  deviceName: string;
  deviceId: string;
  serverUrl: string;
  shell: string;
  terminalEnabled: boolean;
  connectionStatus: "stopped" | "connecting" | "online" | "offline" | "error";
  statusMessage: string;
  pairingCode: string | null;
  pairingQrDataUrl: string | null;
  pairingExpiresAt: string | null;
  pendingPairingRequest: {
    pairingRequestId: string;
    mobileClientId: string;
    mobileName: string;
    requestedAt: string;
  } | null;
}
```

状态由 main process 更新，renderer 只读取和发起命令。

## 配对流程

1. Desktop shell 启动 AgentClient。
2. Agent 注册成功后创建 pairing code。
3. `displayPairingCode` callback 被 desktop runtime 接管。
4. Main process 生成二维码 data URL，并更新 renderer 状态。
5. Mobile 提交 pairing code 后，Agent 收到 `pairing.requested`。
6. `approvePairingRequest` callback 创建一个 pending promise，并把请求显示到 UI。
7. 用户点击 Approve 或 Reject。
8. Runtime resolve promise，AgentClient 发送 `pairing.approved` 或 `pairing.rejected`。

## 终端能力开关

- 开启：创建 AgentClient 并连接 Server。
- 关闭：调用 `AgentClient.close()`，关闭 WebSocket 和本地 PTY session，状态变成 `stopped`。
- 关闭后不会接受新的 terminal session。
- 重新开启后复用同一设备身份。

## 菜单栏/托盘

Electron 使用 `Tray` 在 macOS 菜单栏显示状态图标和菜单：

- `Show Window`
- `Terminal: On/Off`
- `Quit`

状态文本来自同一份 `DesktopState`，避免 UI 与菜单栏显示不一致。

## 测试策略

### Agent core

- `AgentClient.close()` 可关闭 socket。
- `AgentClient.close()` 会清理 sessions。
- 重复调用 `close()` 不抛错。

### Desktop state

- 初始状态从 Agent config 构建。
- pairing created 后保存 pairing code、过期时间和 QR data URL。
- pairing requested 后保存 pending request。
- approve/reject 后清除 pending request。
- terminal enabled toggle 更新状态。

### Desktop runtime

- 用 fake AgentClient factory 测试启停 lifecycle。
- terminal off 时调用 AgentClient.close()`。
- terminal on 时创建并 connect AgentClient。

### 验证

- `pnpm --filter @remote/agent test`
- `pnpm --filter @remote/agent-desktop test`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## 验收标准

- `apps/agent-desktop` 能通过 `pnpm --filter @remote/agent-desktop dev` 启动 Electron。
- 主窗口能显示设备名、状态、Server URL、终端能力开关。
- Agent 注册后主窗口能显示 pairing code 和二维码。
- 收到 pairing request 后 UI 能批准或拒绝。
- 关闭终端能力会关闭 Agent socket 和本地 PTY。
- 菜单栏有显示窗口、启停终端能力、退出入口。
- README 或 runbook 写明本地运行和本地打包命令。
- 主 MVP 计划 Task 10 完成项全部勾选。

## 已知风险

- Electron 包体较大，后续发布体验需要 Task 11 优化。
- `node-pty` 原生模块在 Electron 打包时可能需要 rebuild；Task 11 runbook 必须记录。
- 当前状态只保存在内存中，窗口刷新后可从 main process 重新同步，但不会持久化历史事件。
- 正式开机启动、日志采集、自动更新不在 Task 10 范围。

## 自检

- Placeholder scan: 没有 TBD/TODO。
- Scope check: 聚焦 macOS Agent desktop shell，不包含签名公证和正式安装包。
- Consistency: Electron main 复用 `apps/agent` core，renderer 不直接访问 Node。
