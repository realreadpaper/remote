# iOS 连接 macOS 可安装 MVP 完整实现方案

## 1. 目标

本方案把当前已经完成的本地终端远控垂直切片，推进到“用户可以安装 iOS 客户端，安装 macOS Agent，绑定设备，并从手机打开远程终端输入命令”的 MVP。

MVP 的第一成功目标不是完整桌面远控，而是：

1. iPhone 安装客户端。
2. Mac 安装 Agent。
3. 手机和 Mac 完成绑定。
4. 手机点击设备后默认进入终端。
5. 用户能稳定执行 `pwd`、`ls`、`git status`、`npm run dev`、`tail -f`、`Ctrl+C` 等常见命令。

桌面画面、文件传输、广告和 Windows 支持作为后续阶段推进，不进入本阶段的交付关键路径。

## 2. 当前已完成状态

仓库当前已经具备一个本地开发 MVP 基础：

- `packages/protocol`：已定义设备注册、会话打开、终端输入、终端输出、终端关闭、终端退出等消息协议，并用 `zod` 做运行时校验。
- `apps/server`：已实现 Fastify + WebSocket 中转服务，提供 `/health`、`/devices`、`/ws/agent`、`/ws/mobile`。
- `apps/agent`：已实现 macOS 命令行 Agent，能通过 `node-pty` 打开本机 Shell，会话输入输出通过 server 转发。
- `apps/mobile`：已实现 Expo React Native 终端优先界面和会话客户端。
- 本地验证：server、Agent、mobile/WebSocket 探针之间可以完成终端命令往返。

当前系统还不是正式产品，缺口集中在安装、绑定、安全、发布和运行稳定性。

## 3. MVP 范围

### 3.1 必做

- iOS 客户端可通过 TestFlight 安装。
- macOS Agent 可通过 `.dmg` 或 `.pkg` 安装。
- Agent 有基础图形界面或菜单栏入口。
- 设备通过二维码或一次性配对码绑定。
- 绑定后手机能看到 Mac 在线状态。
- 手机连接 Mac 后默认进入终端。
- 支持交互式 Shell、快捷键、窗口 resize、退出和重连。
- Server 支持账号、设备、绑定关系、会话令牌。
- 全链路使用 TLS。
- 会话消息具备鉴权，未绑定设备不能连接。
- Agent 本地能主动断开会话、关闭终端能力。
- 会话内不展示广告。

### 3.2 非 MVP

- App Store 正式上架。
- Google Play 正式上架。
- Windows Agent。
- P2P 打洞。
- 完整端到端加密。
- 远程桌面视频流。
- 文件上传下载。
- 服务状态面板。
- 激励广告和广告变现。
- 多用户组织权限。

这些能力必须预留接口，但不能阻塞 iOS 连接 macOS 终端的第一版。

## 4. 产品实现路径

### 4.1 阶段 A：真机开发版

目标：iPhone 通过 Expo Go 在同一局域网连接 Mac Agent。

实现内容：

- Server 监听 `0.0.0.0`，允许 iPhone 访问开发机局域网 IP。
- Mobile 使用 `EXPO_PUBLIC_REMOTE_WS_URL` 指向局域网 server。
- Agent 使用 `REMOTE_SERVER_URL` 注册到同一个 server。
- README 提供清晰真机步骤。

验收标准：

- iPhone 打开 Expo Go 后能连接设备。
- 输入 `pwd` 能返回 Mac 当前目录。
- 输入 `Ctrl+C` 能中断 `tail -f` 或 `ping` 类长运行命令。

### 4.2 阶段 B：配对与鉴权

目标：去掉固定 `mac-dev` 和裸 WebSocket 信任，形成可产品化的绑定模型。

实现内容：

- Agent 首次启动生成 `deviceId` 和设备密钥。
- Agent 展示二维码，二维码包含短期 `pairingCode`、server 地址和设备公钥摘要。
- Mobile 扫码后向 server 提交绑定请求。
- Agent 本地确认绑定。
- Server 保存用户、手机、设备的绑定关系。
- Mobile 连接设备时使用登录令牌换取短期 `sessionToken`。
- Agent 只接受 server 验证过、且本地允许的会话。

验收标准：

- 未绑定手机不能连接 Agent。
- 绑定码过期后不可复用。
- Agent 可以撤销手机绑定。
- 手机退出登录后无法继续连接。

### 4.3 阶段 C：macOS Agent 产品化

目标：从命令行 Agent 变成普通用户可安装、可理解、可停止的 Mac 应用。

实现内容：

- 使用 Tauri、Electron 或 Swift 原生壳包装现有 TypeScript/Node Agent 能力。
- 菜单栏显示连接状态。
- 主窗口显示设备名称、绑定二维码、能力开关、当前会话。
- 提供开机启动开关。
- 提供日志查看与清理。
- 打包 `.dmg` 或 `.pkg`。
- 使用 Apple Developer ID 进行签名和公证。

验收标准：

- 双击安装包可安装。
- Agent 重启后设备身份不丢失。
- 菜单栏可看到在线/离线/连接中状态。
- 用户可一键关闭终端能力。

推荐路线：先用 Electron 或 Tauri 快速产品化，后续再评估 Swift 原生重写。原因是当前 Agent 已经是 TypeScript，复用成本最低。

### 4.4 阶段 D：iOS TestFlight

目标：从 Expo 开发预览进入 TestFlight 可安装版本。

实现内容：

- 使用 Expo EAS Build 生成 iOS 构建。
- 配置 bundle identifier、图标、启动页和权限说明。
- 接入登录、设备列表、扫码绑定、终端会话。
- 处理 App 前后台切换。
- 处理网络断开、重连、会话恢复。
- 通过 TestFlight 分发给测试用户。

验收标准：

- 测试用户无需本地开发环境即可安装 App。
- App 能登录、扫码、连接 Mac、执行命令。
- App 进入后台再回到前台后能恢复状态或明确提示重连。

### 4.5 阶段 E：云服务部署

目标：从本地 server 变成可访问的开发/测试云服务。

实现内容：

- 部署 API + WebSocket 服务。
- 使用 PostgreSQL 保存用户、设备、绑定关系、会话元数据。
- 使用 Redis 保存在线状态、短期配对码、会话路由。
- 使用 HTTPS/WSS。
- 提供基础限流和审计。
- 提供健康检查和日志。

验收标准：

- iPhone 不在同一局域网时仍能通过云中转连接 Mac。
- server 重启后长期设备绑定不丢失。
- 断线后 Agent 和 Mobile 可以自动重连。

## 5. 系统架构

```text
iOS App
  |
  | HTTPS: login, devices, pairing
  | WSS: mobile session
  v
Cloud Server
  |
  | WSS: agent control/session
  v
macOS Agent
  |
  | PTY stdin/stdout
  v
User Shell
```

MVP 使用云中转模式，所有终端消息经 Cloud Server 转发。这样可以先绕开 NAT、P2P 和中继网络复杂度，最快完成可安装可验证版本。

后续架构演进：

- 增加端到端加密后，Cloud Server 只转发密文。
- 增加 P2P 后，Cloud Server 主要负责信令和失败兜底。
- 增加文件、桌面、服务状态后，通过同一个会话建立多个逻辑通道。

## 6. 数据模型

### 6.1 User

- `id`：用户 ID。
- `email` 或 `phone`：登录标识。
- `createdAt`：创建时间。
- `disabledAt`：禁用时间。

### 6.2 Device

- `id`：设备 ID，由 Agent 首次启动生成。
- `ownerUserId`：设备归属用户。
- `name`：设备展示名。
- `platform`：`macos`、`windows`。
- `publicKey`：设备长期公钥。
- `capabilities`：`terminal`、`file`、`desktop`。
- `lastSeenAt`：最后在线时间。
- `revokedAt`：撤销时间。

### 6.3 MobileClient

- `id`：手机客户端 ID。
- `userId`：所属用户。
- `platform`：`ios`、`android`。
- `publicKey`：手机端公钥。
- `lastSeenAt`：最后在线时间。

### 6.4 PairingCode

- `codeHash`：一次性配对码哈希。
- `deviceId`：对应设备。
- `expiresAt`：过期时间。
- `usedAt`：使用时间。

### 6.5 DeviceBinding

- `id`：绑定 ID。
- `deviceId`：设备 ID。
- `mobileClientId`：手机 ID。
- `userId`：用户 ID。
- `approvedAt`：Agent 本地确认时间。
- `revokedAt`：撤销时间。

### 6.6 Session

- `id`：会话 ID。
- `deviceId`：被控设备。
- `mobileClientId`：控制端。
- `state`：`opening`、`open`、`closing`、`closed`。
- `openedAt`：打开时间。
- `closedAt`：关闭时间。
- `closeReason`：关闭原因。

## 7. 协议演进

当前协议已经支持终端会话基本消息。下一阶段增加以下消息类型：

- `pairing.created`：Agent 上报配对码。
- `pairing.requested`：Mobile 请求绑定。
- `pairing.approved`：Agent 本地确认。
- `pairing.rejected`：Agent 本地拒绝。
- `auth.sessionToken`：Server 下发短期会话令牌。
- `device.status`：设备在线和能力状态。
- `terminal.snapshot`：断线重连后的输出缓冲和当前状态。
- `terminal.signal`：发送 `SIGINT`、`SIGTERM`、`EOF` 等控制信号。

协议原则：

- 所有消息必须有 `type`。
- 涉及会话的消息必须有 `sessionId`。
- Server 只接受符合 schema 的消息。
- Agent 输出只允许来自当前会话绑定的 Agent socket。
- Mobile 输入只允许来自已鉴权且已绑定的 Mobile socket。

## 8. 安全策略

MVP 安全边界：

- 账号登录保护设备列表和连接入口。
- 设备绑定需要 Agent 本地确认。
- 配对码短期有效、一次性使用。
- 会话连接使用短期 token。
- 传输层使用 TLS。
- Agent 本地能力开关优先级高于云端。
- Agent 退出或禁用终端能力后，server 必须关闭相关会话。

MVP 不把敏感命令识别作为安全边界。敏感命令提示只用于降低误操作，真正边界是用户系统权限、设备绑定、会话鉴权和 Agent 本地授权。

## 9. 安装与发布

### 9.1 iOS

- 开发阶段：Expo Go。
- 内测阶段：Expo EAS Build + TestFlight。
- 正式阶段：App Store。

TestFlight 前置条件：

- Apple Developer Program。
- Bundle identifier。
- App 图标和启动页。
- 隐私说明。
- 网络权限说明。
- 远程控制用途说明。

### 9.2 macOS

- 开发阶段：命令行 Agent。
- 内测阶段：带 GUI 的 `.dmg` 或 `.pkg`。
- 正式阶段：签名、公证、自动更新。

macOS 前置条件：

- Apple Developer ID Application 证书。
- Hardened Runtime。
- Notarization。
- 权限引导文案。
- 登录项配置。

## 10. 验收标准

MVP 完成时必须满足：

- 新用户能在 5 分钟内完成安装、绑定和首次命令执行。
- 连接成功后默认进入终端页。
- 终端输入延迟在正常网络下主观可接受。
- 断线后能自动重连或明确展示失败原因。
- Agent 能在本地关闭会话。
- 未绑定手机无法连接 Mac。
- 会话内没有广告。
- 测试覆盖协议、server 路由、Agent 会话、mobile session client 和 terminal store。

## 11. 推荐推进顺序

1. 先做 iPhone + Expo Go 真机联调，确认手机端体验。
2. 再做设备配对和会话鉴权，消除安全硬伤。
3. 再做 macOS Agent 图形化和安装包。
4. 再做 EAS/TestFlight。
5. 最后部署云服务，做跨网络连接。

这个顺序的理由是：先验证真实手机输入命令是否足够简单，再投入签名、发布和云成本；同时在进入 TestFlight 前补上绑定和鉴权，避免产品化后返工。
