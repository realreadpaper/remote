# 终端优先远程控制技术实现与原理文档

## 1. 技术定位

系统采用自研 Agent 平台路线。控制端为 iOS / Android App，被控端优先实现 macOS Agent，Windows Agent 在 V1 实现。云服务负责账号、设备、信令、P2P 协调和中继兜底，但不保存终端命令、文件内容或屏幕内容。

系统核心不是传统桌面流媒体，而是远程能力通道：

- `Terminal`：远程 Shell 会话。
- `File`：远程文件浏览与传输。
- `Desktop`：屏幕查看与输入辅助。
- `Control`：设备状态、会话控制、心跳和能力协商。

## 2. 总体架构

组件：

- Mobile App：iOS / Android 控制端。
- Agent：macOS / Windows 被控端常驻程序。
- Cloud API：账号、设备、配置、广告策略。
- Signaling Service：会话信令、候选地址交换、能力协商。
- Relay Service：P2P 失败后的加密中继。
- Push Service：离线提醒、会话状态通知。

数据流：

1. Agent 启动后登录设备身份，与云端保持长连接。
2. Mobile App 登录用户账号，拉取绑定设备列表。
3. 用户点击连接，Mobile App 和 Agent 通过 Signaling Service 协商会话。
4. 双端生成短期会话密钥。
5. 双端优先尝试 P2P 连接。
6. P2P 失败时切换到 Relay Service。
7. 会话建立后打开 Control、Terminal、File、Desktop 多通道。

## 3. 第一性原理

远程控制可以拆成四个基础问题：

- 身份：谁允许谁连接哪台设备。
- 连接：两个网络环境不同的端如何互相到达。
- 意图：用户输入的是命令、文件请求、鼠标键盘还是剪贴板。
- 反馈：远端如何把输出、文件、画面和状态返回。

传统远程桌面把所有意图都压缩成“鼠标键盘 + 屏幕视频”。这在手机上低效，因为用户为了执行命令，需要先观看桌面、点击终端、调出键盘，再输入命令。本产品把命令执行作为一等通道，绕过桌面操作，把用户意图直接传给 Shell，从而降低延迟、误触和认知成本。

## 4. Agent 技术设计

### 4.1 macOS Agent

形态：

- 菜单栏常驻 App。
- 登录项可选自启动。
- 本地窗口展示设备二维码、绑定请求、能力开关、权限状态和审计日志。

核心模块：

- Device Identity：设备密钥、设备名称、绑定状态。
- Session Manager：远程会话生命周期。
- Terminal Host：Shell 进程管理。
- File Host：文件系统访问。
- Desktop Host：屏幕采集、输入注入、剪贴板。
- Permission Manager：macOS 权限检测与引导。
- Audit Logger：本地命令和连接日志。

macOS 权限：

- 终端能力：不依赖屏幕录制权限。
- 文件能力：遵守 macOS 沙盒和用户授权目录策略；非沙盒版本可访问用户允许范围。
- 桌面查看：需要 Screen Recording。
- 输入控制：需要 Accessibility。
- 部分键盘监听或输入场景：可能需要 Input Monitoring。

Shell：

- 默认使用用户登录 Shell，通常是 `zsh`。
- 通过伪终端 PTY 创建交互式会话。
- 支持 stdin、stdout、stderr、窗口大小变更、退出码。
- 支持会话保持和断线恢复。
- 当前目录由 Agent 跟踪，并同步给文件页。

### 4.2 Windows Agent

V1 实现：

- 托盘常驻程序。
- 默认 PowerShell。
- 可选 cmd 和 WSL。
- 使用 Windows ConPTY 管理交互式终端。
- 桌面采集可使用 Windows Graphics Capture 或 Desktop Duplication。
- 输入注入使用 SendInput。

需要处理：

- UAC 提示。
- 管理员权限。
- 安全桌面限制。
- Windows Defender / 防火墙提示。
- 多显示器和 DPI 缩放。

## 5. Mobile App 技术设计

核心模块：

- Account Client：登录、令牌刷新。
- Device Client：设备列表、在线状态、绑定。
- Session Client：连接建立、重连、通道管理。
- Terminal UI：输出渲染、命令输入、快捷键条。
- File UI：目录浏览、上传下载。
- Desktop UI：视频解码、触控映射。
- Ads Placement：会话外广告和激励广告入口。

终端 UI 原则：

- 输出区使用等宽字体。
- 支持 ANSI 颜色。
- 输入框支持多行编辑。
- 快捷键条固定提供 `Tab`、`Ctrl+C`、`Esc`、方向键、`Cmd` / `Ctrl`。
- 命令历史保存在本地，并按设备隔离。
- 敏感命令触发二次确认。

桌面 UI 原则：

- 默认不显示工具栏。
- 右下角保留键盘入口。
- 单指移动光标。
- 轻点左键。
- 双指滚动。
- 双指捏合缩放。
- 双指轻点右键。
- 高级功能通过边缘面板打开。

## 6. 连接链路

### 6.1 设备绑定

1. Agent 生成设备密钥对。
2. Agent 显示绑定二维码，二维码包含设备临时绑定令牌和云端地址。
3. Mobile App 扫码后向云端提交绑定请求。
4. Agent 本地弹窗确认。
5. 确认后云端记录用户和设备关系。
6. Mobile App 和 Agent 交换长期设备公钥。

### 6.2 会话建立

1. Mobile App 请求连接设备。
2. 云端向 Agent 推送连接请求。
3. Agent 检查本地能力开关和用户授权。
4. 双端通过信令服务交换会话参数。
5. 双端生成短期会话密钥。
6. 双端开始 P2P 候选地址探测。
7. 直连成功则使用 P2P。
8. 直连失败则切换 Relay。

### 6.3 多通道模型

会话中使用逻辑多通道：

- `Control`：心跳、能力状态、错误、重连。
- `Terminal`：stdin、stdout、stderr、PTY resize、exit status。
- `File`：目录列表、元数据、分块读写、校验。
- `Desktop`：视频帧、输入事件、剪贴板事件。

不同通道可以有不同优先级：

- Terminal 优先级最高。
- Control 次之。
- File 可后台限速。
- Desktop 可根据网络自动降码率。

## 7. 安全模型

原则：

- 云端只做身份、设备发现、信令和中继。
- 命令、文件和屏幕内容端到端加密。
- 中继服务只转发密文。
- Agent 本地拥有最终权限控制。
- 终端、文件、桌面分别授权。

密钥设计：

- 账号令牌用于访问云 API。
- 设备长期密钥用于设备身份。
- 会话短期密钥用于单次连接。
- 会话结束后短期密钥失效。

敏感命令确认：

手机端应对高风险命令做二次确认，例如：

- `rm -rf /`
- `sudo rm -rf`
- `shutdown`
- `reboot`
- `mkfs`
- `diskutil eraseDisk`
- 批量删除用户目录的命令。

说明：敏感命令识别只能降低误操作风险，不能作为安全边界。真正安全边界仍然是设备绑定、Agent 本地授权、系统用户权限和端到端加密。

审计：

- Agent 本地记录连接时间、控制端设备、Shell 会话开始结束、命令摘要和退出码。
- 云端不保存命令内容。
- 用户可在 Agent 本地查看和清理审计日志。

## 8. 终端实现原理

macOS：

- Agent 通过 PTY 启动用户 Shell。
- Mobile App 的输入经加密 Terminal 通道写入 PTY stdin。
- PTY 输出经 Terminal 通道返回 App。
- App 使用终端渲染器解析 ANSI escape sequence。
- 窗口大小变化时 App 发送 resize 事件给 Agent。

Windows：

- 使用 ConPTY 创建 PowerShell 交互式会话。
- 输入输出模型与 macOS PTY 类似。
- WSL 可作为后续 Shell 类型接入。

断线恢复：

- Agent 保持 Shell 会话一段时间。
- Mobile App 重连后请求最近输出缓冲区。
- Agent 返回当前会话状态、当前目录、最近输出和运行中进程状态。

## 9. 文件实现原理

文件通道提供：

- 列目录。
- 读取元数据。
- 分块下载。
- 分块上传。
- 断点续传。
- 哈希校验。
- 文本预览。

终端与文件页共享上下文：

- Agent 跟踪 Shell 当前目录。
- 文件页默认打开当前目录。
- 用户在文件页复制路径后可直接插入终端输入框。

## 10. 桌面辅助实现原理

macOS：

- ScreenCaptureKit 或 CGDisplayStream 用于屏幕采集，具体方案按系统版本选择。
- VideoToolbox 用于硬件编码。
- Accessibility API 和 CGEvent 用于输入控制。
- 剪贴板通过 NSPasteboard 同步。

Windows：

- Windows Graphics Capture 或 Desktop Duplication 采集画面。
- Media Foundation 或硬件编码器编码。
- SendInput 注入鼠标键盘。
- Clipboard API 同步剪贴板。

弱网策略：

- Terminal 通道不降级。
- Desktop 通道优先降帧、降分辨率、降码率。
- File 通道后台限速。
- 重连时优先恢复 Terminal。

## 11. 广告实现边界

广告模块只允许出现在：

- 设备列表。
- 连接前页面。
- 断开后页面。
- 设置页。
- 激励资源入口。

广告模块禁止访问：

- Terminal 通道内容。
- File 通道内容。
- Desktop 视频内容。
- 命令历史。
- 文件路径内容。

广告策略由云端配置，但客户端必须有硬性限制：会话内页面不渲染广告容器。

## 12. MVP 技术里程碑

阶段 1：基础工程

- iOS / Android App 骨架。
- macOS Agent 骨架。
- Cloud API。
- 设备注册和绑定。

阶段 2：终端闭环

- Agent PTY。
- Terminal 通道。
- 手机终端 UI。
- 命令输入、输出、快捷键。
- 会话保持。

阶段 3：文件能力

- 目录浏览。
- 上传下载。
- 当前目录联动。
- 文本预览。

阶段 4：桌面辅助

- macOS 屏幕采集。
- 手机画面查看。
- 基础输入注入。
- 权限引导。

阶段 5：连接优化

- P2P。
- 中继兜底。
- 弱网重连。
- 端到端加密完善。

阶段 6：广告与发布

- 会话外广告位。
- 激励广告资源策略。
- App Store / Google Play 发布准备。
- macOS Agent 签名和公证。

## 13. 主要风险

- macOS 权限引导复杂，可能影响首次转化。
- P2P 成功率受网络环境影响，需要中继兜底。
- 云中继成本与免费策略存在压力，需要广告和限流策略。
- 远程命令执行风险高，需要清晰授权和本地审计。
- App Store 对远控、后台连接、广告和权限解释可能有审核要求。

## 14. 技术决策

- 采用自研 Agent 平台路线。
- MVP 不聚合 RDP / VNC / SSH。
- MVP 优先 macOS，不优先 Windows。
- 默认会话页是 Terminal，不是 Desktop。
- Terminal 通道优先级高于 Desktop。
- 会话内容端到端加密。
- 云中继只转发密文。
- 会话内无广告。
