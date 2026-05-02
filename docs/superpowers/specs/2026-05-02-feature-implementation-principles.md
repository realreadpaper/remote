# 远控功能点技术实现原理文档

## 1. 文档目的

本文逐项说明终端优先远控产品中每个核心功能点的实现原理。重点覆盖 iOS 客户端连接 macOS 电脑的 MVP，并说明后续文件、桌面、服务状态、广告和 Windows 扩展如何接入。

## 2. 账号与登录

### 功能目标

用户登录后才能查看自己的设备、绑定新设备和发起远控会话。

### 实现原理

Mobile App 通过 HTTPS 调用 Cloud API 完成登录，Cloud API 返回短期访问令牌和刷新令牌。访问令牌用于访问设备列表、绑定接口和会话创建接口。刷新令牌只保存在系统安全存储中，iOS 使用 Keychain，Android 使用 Keystore 或 Expo SecureStore。

Server 在每次 API 请求和 WebSocket 握手时校验访问令牌。WebSocket 建立后，server 将 socket 与 `userId`、`mobileClientId` 绑定，后续消息不再信任客户端传入的用户字段。

### 安全边界

登录令牌只证明“这是某个用户”，不直接证明“该用户可以控制某台设备”。设备控制还必须经过设备绑定和短期会话令牌。

## 3. 设备身份

### 功能目标

每台 Mac 都有稳定身份，重启 Agent 或升级版本后不会变成新设备。

### 实现原理

Agent 首次启动时生成 `deviceId` 和长期密钥对。`deviceId` 是随机 UUID，长期私钥保存在 macOS Keychain 或应用私有目录中，长期公钥注册到 Cloud Server。

Agent 每次连接 server 时发送 `device.register` 消息，包含 `deviceId`、设备名称、平台和能力列表。Server 校验设备身份后更新在线状态。

### 关键点

- 不能用主机名作为唯一身份，因为主机名会变。
- 不能每次启动重新生成设备 ID，否则绑定关系会丢失。
- 私钥不能上传到云端。

## 4. 设备绑定

### 功能目标

只有经过用户确认的手机才能控制 Mac。

### 实现原理

Agent 请求 server 创建一次性配对码，server 保存配对码哈希和过期时间。Agent 把配对码、server 地址、设备 ID 和设备公钥摘要渲染成二维码。

Mobile 扫码后向 server 提交绑定请求。Server 不立即完成绑定，而是把请求推送给 Agent。Agent 本地显示“某手机请求绑定”，用户点击允许后，Agent 发送 `pairing.approved`。Server 才创建 `DeviceBinding`。

### 防滥用设计

- 配对码短期有效。
- 配对码只能使用一次。
- Agent 本地必须确认。
- Agent 可以撤销绑定。
- 撤销后旧 session token 立即失效。

## 5. 在线状态

### 功能目标

手机设备列表能看到 Mac 是否在线、是否可连接、当前支持哪些能力。

### 实现原理

Agent 与 server 保持 WebSocket 长连接。连接建立时注册设备，之后周期性发送 heartbeat。Server 在内存或 Redis 中记录 `deviceId -> socketId -> lastSeenAt`。

Mobile 获取设备列表时，Cloud API 合并数据库中的绑定设备和 Redis 中的在线状态，返回 `online`、`lastSeenAt`、`capabilities`。

### 异常处理

WebSocket 断开时，server 将设备标记为离线，并向相关 mobile socket 广播 `device.status`。如果 Agent 快速重连，server 用新的 socket 替换旧 socket。

## 6. 会话建立

### 功能目标

用户点击设备后，系统创建一个短期、可关闭、可审计的远控会话。

### 实现原理

Mobile 请求 `POST /sessions`，server 校验用户登录、设备绑定、设备在线和 Agent 能力开关。校验通过后生成 `sessionId` 和短期 `sessionToken`。

Mobile 通过 `/ws/mobile` 发送 `session.open`。Server 将连接请求转发给对应 Agent。Agent 检查本地能力状态，接受后打开 PTY，并返回 `session.opened`。Server 将 `session.opened` 转发给 Mobile。

### 生命周期

- `opening`：Mobile 已请求，Agent 尚未确认。
- `open`：Agent 已打开终端。
- `closing`：任一端请求关闭。
- `closed`：PTY 已退出或 socket 已断开。

## 7. 终端会话

### 功能目标

手机直接打开远程 Shell，输入命令并实时查看输出。

### 实现原理

macOS Agent 使用 `node-pty` 创建伪终端。伪终端模拟真实终端设备，因此 `zsh`、`bash`、`vim`、`top`、`npm run dev` 这类交互式程序能按终端语义运行。

Mobile 输入的字符通过 `terminal.input` 发送到 server，再由 server 转发给 Agent。Agent 将 `data` 写入 PTY stdin。PTY 输出通过 `terminal.output` 返回 Mobile。Mobile 使用终端渲染器解析 ANSI escape sequence，显示颜色、光标移动和清屏效果。

### 为什么不用普通 `child_process`

普通 `child_process` 更适合执行一次性命令，不适合交互式 Shell。很多命令会检测自己是否运行在 TTY 中。PTY 能提供 TTY 行为，避免补全、颜色、交互程序不可用。

## 8. 命令输入优化

### 功能目标

在手机上输入命令要比传统远程桌面更简单。

### 实现原理

Mobile 不让用户先进入桌面再点开终端，而是在会话打开后默认展示终端页。输入区支持多行文本，底部提供固定快捷键条：

- `Tab`：发送 `\t`。
- `Ctrl+C`：发送 `\x03`。
- `Esc`：发送 `\x1b`。
- 方向键：发送 ANSI cursor sequence。
- `Enter`：发送 `\r` 或 `\n`，按 PTY 配置统一。

命令历史保存在本地，按设备隔离。常用命令可以收藏为模板，但模板只是输入辅助，不在云端自动执行。

## 9. 终端 resize

### 功能目标

手机横竖屏切换、键盘弹出或字体大小变化时，远端程序能知道终端尺寸变化。

### 实现原理

Mobile 根据终端容器宽高和字体度量计算 `cols`、`rows`，通过 `terminal.resize` 发送给 Agent。Agent 调用 PTY resize API。远端 Shell 收到窗口大小变化后，交互式程序会重新布局。

### 注意事项

resize 消息需要节流，避免用户拖动或键盘动画期间发送过多 resize。最后一次 resize 必须可靠送达。

## 10. 中断与退出

### 功能目标

用户能停止长运行命令，也能明确关闭远程终端。

### 实现原理

`Ctrl+C` 本质是向 PTY 写入控制字符 `\x03`，Shell 通常会把它转换为 `SIGINT` 发送给前台进程。关闭终端则使用 `terminal.close`。Agent 收到 close 后关闭 PTY，并释放会话资源。

如果 PTY 自然退出，Agent 发送 `terminal.exit`，server 转发给 Mobile。Mobile 将会话状态标记为已结束，并禁用输入框。

## 11. 断线重连

### 功能目标

手机网络抖动或 App 前后台切换后，不应立即丢失远端正在运行的命令。

### 实现原理

Agent 在 mobile socket 断开后不立即杀掉 PTY，而是保留短时间，例如 5 分钟。Server 记录会话仍由某个 Agent 持有。Mobile 重连后携带 `sessionId` 和新的短期 token 请求恢复。

Agent 为每个会话维护有限输出环形缓冲区。恢复成功后发送 `terminal.snapshot`，包含最近输出、PTY 是否存活、退出码和当前尺寸。Mobile 用 snapshot 重建屏幕状态，再继续接收增量输出。

### 资源控制

每台设备限制最大保留会话数量和最大输出缓冲大小。超过限制时，优先关闭最旧或已断开的会话。

## 12. 文件浏览

### 功能目标

用户能从手机查看远端目录，并和终端当前目录联动。

### 实现原理

Agent 提供 File 通道。Mobile 发送 `file.list`，包含目标路径和分页参数。Agent 在本机读取目录，返回文件名、类型、大小、修改时间和权限摘要。

终端当前目录通过 Shell hook 或命令探测同步。最简单做法是在交互 Shell 初始化时注入轻量 prompt hook，在每次 prompt 渲染前输出当前目录标记，Agent 解析后更新 session cwd。文件页默认打开该 cwd。

### 权限原则

文件能力必须有独立开关。用户关闭文件能力后，即使终端仍可用，File 通道也不能访问文件系统。

## 13. 文件传输

### 功能目标

用户能上传、下载和预览文本文件。

### 实现原理

大文件按固定块传输。下载时 Mobile 发送 `file.read`，Agent 返回 `file.chunk`。上传时 Mobile 发送 `file.write.start`、多个 `file.write.chunk`、最后 `file.write.complete`。每个块带序号和哈希，完成后校验总哈希。

传输任务使用独立 task id。断线后 Mobile 查询任务状态，并从最后确认的块继续。

### 优先级

文件传输优先级低于 Terminal。弱网情况下，文件通道限速，不能影响命令输入输出。

## 14. 桌面画面

### 功能目标

当用户必须看 GUI、处理弹窗或查看浏览器页面时，提供辅助桌面画面。

### 实现原理

macOS 使用 ScreenCaptureKit 或 CGDisplayStream 采集屏幕。采集帧进入编码器，优先使用 VideoToolbox 硬件编码为 H.264 或 HEVC。Mobile 解码后在画面页渲染。

桌面通道不是 MVP 第一关键路径，因为桌面视频会带来权限、编码、延迟和成本复杂度。第一版可以先实现低帧率查看，再加入输入控制。

### 权限

屏幕查看需要 Screen Recording 权限。Agent 必须检测权限状态，并引导用户到系统设置。

## 15. 鼠标键盘输入

### 功能目标

用户能在手机上简单点击远端桌面。

### 实现原理

Mobile 将触控手势转换为逻辑输入事件：

- 单指滑动：移动光标。
- 轻点：左键点击。
- 双指滑动：滚动。
- 双指轻点：右键。
- 捏合：本地缩放画面，不一定发送到远端。

Agent 在 macOS 上使用 Accessibility API 和 CGEvent 注入鼠标键盘事件。输入坐标需要按远端屏幕分辨率、缩放比例和多显示器布局转换。

### 权限

输入控制需要 Accessibility 权限。未授权时只允许查看画面，不允许注入输入。

## 16. 服务状态

### 功能目标

后续面向开发/运维用户，手机能查看服务、端口、日志和进程。

### 实现原理

服务状态不是独立远控协议，而是终端能力上的结构化封装。Agent 在本机执行受控探测命令，例如：

- `launchctl list` 查看 macOS 服务。
- `lsof -i` 或 `netstat` 查看端口。
- `ps` 查看进程。
- 项目目录内读取 `package.json` scripts。

Agent 将结果解析成结构化数据返回 Mobile。用户点击“重启服务”时，本质上仍由终端通道执行明确命令，并在手机端展示命令和确认弹窗。

### 安全原则

服务操作必须显式展示将要执行的命令。不能让用户在不知道命令内容的情况下点击危险按钮。

## 17. 剪贴板

### 功能目标

用户能在手机和 Mac 之间复制命令、路径和少量文本。

### 实现原理

Mobile 读取本地剪贴板需遵守系统权限和提示。Agent 读取/写入 macOS 剪贴板使用 NSPasteboard。剪贴板同步通过独立 `clipboard` 通道，不混入 Terminal 通道。

默认策略是手动同步：用户点击“发送到远端”或“从远端读取”。不做默认实时双向同步，避免隐私风险。

## 18. 广告

### 功能目标

核心功能免费，后续通过会话外广告补贴云中转成本。

### 实现原理

广告 SDK 只接入 Mobile App 的会话外页面，例如设备列表、连接前、断开后和设置页。会话页组件树内不渲染广告容器。广告策略从 Cloud API 拉取，但客户端有硬编码安全限制：`Terminal`、`File`、`Desktop` 页面禁止广告。

激励广告只用于高成本资源，例如更长云中继时长或更高桌面码率。终端基础能力不应被广告阻断。

## 19. Windows Agent

### 功能目标

V1 支持 Windows 电脑，优先 PowerShell。

### 实现原理

Windows 终端使用 ConPTY。Agent 创建 PowerShell、cmd 或 WSL 会话，输入输出模型与 macOS PTY 一致。桌面采集使用 Windows Graphics Capture 或 Desktop Duplication，输入注入使用 SendInput。

Windows 需要额外处理 UAC、安全桌面、管理员权限、防火墙和 DPI 缩放。

## 20. 监控与审计

### 功能目标

用户能知道何时、哪个手机连接过 Mac；开发团队能定位连接失败问题。

### 实现原理

Agent 本地记录连接时间、控制端名称、能力使用、会话开始结束、退出原因和命令摘要。云端只记录会话元数据和错误码，不保存命令输出、文件内容或屏幕内容。

Server 对关键路径打结构化日志：

- 登录失败。
- 设备上线/离线。
- 绑定请求/确认/拒绝。
- 会话打开/关闭。
- WebSocket 断开原因。
- 消息 schema 校验失败。

日志中不得记录终端原始输入输出。

## 21. 测试策略

### 协议测试

所有消息 schema 都必须有正反向测试：合法消息通过，缺字段、错类型、未知 type 被拒绝。

### Server 测试

覆盖设备注册、绑定鉴权、会话路由、错误 sender 拒绝、mobile 断开后资源清理。

### Agent 测试

覆盖 PTY 创建、输入输出、resize、close、exit、断线保留和资源上限。

### Mobile 测试

覆盖 session client 状态机、terminal store、重连、输出追加、输入禁用和错误展示。

### 端到端测试

本地启动 server 和 Agent，用 WebSocket 探针发送 `printf "__PWD__%s\n" "$PWD"`，确认收到 marker 输出。真机测试再验证 iPhone 输入、快捷键和前后台恢复。
