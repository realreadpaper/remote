# iOS Mobile UI And Simulator Validation Design

## 1. 背景

真机已经安装开发构建，但用户反馈“全黑，很难看”。当前 `TerminalScreen` 的根背景、Header、配对区、输入区和输出区全部使用深色，Expo splash 也是 `#101214`，因此即使应用没有崩溃，也会在真机上呈现接近黑屏的体验。开发构建依赖 Metro，网络不通或 JS 加载慢时，深色 splash 还会放大“黑屏”感知。

本次把移动端调整为“浅色运维工作台 + 深色终端面板”：终端仍有专业的命令行质感，但 App 首屏不再是整屏黑色。完成后必须先在 iOS 模拟器验证启动、配对、连接、命令输入，再重新安装到真机。

## 2. 目标

- iOS App 启动页不再使用黑色背景。
- 主界面不再整屏黑色，默认可见 Header、状态、配对输入和命令输入。
- 保持核心目标：打开终端、输入命令、看到输出。
- 配对和连接流程在模拟器中可验证。
- 真机重新安装后至少验证 App 能启动并显示新 UI。

## 3. 非目标

- 本阶段不做完整 ANSI 终端渲染。
- 本阶段不接入广告位。
- 本阶段不做云端 Render 真部署。
- 本阶段不提交 TestFlight。

## 4. 用户流程

1. 用户打开 App，看到浅色顶部区域、连接状态和配对输入框。
2. 用户输入 Agent 配对码并点击 `Pair`。
3. macOS Agent 终端出现批准提示，开发者输入 `y`。
4. App 显示已配对设备，用户点击 `Connect`。
5. 用户在底部输入 `pwd` 或 smoke 命令，点击发送。
6. 输出区显示远端 macOS shell 输出。

## 5. 技术设计

### 5.1 组件变化

- 新增 `apps/mobile/src/components/mobileShellTheme.ts`，集中管理移动端颜色、字体和状态文案，方便测试和后续多主题。
- `TerminalScreen.tsx` 继续负责交互逻辑，但样式改为引用主题常量。
- `app.json` 的 splash 和 Android adaptive icon background 改成浅色，避免启动阶段黑屏。

### 5.2 UI 原则

- 外层背景使用浅色，不使用整屏黑色。
- Header 使用低高度信息密度设计，标题、状态、relay host 保持可读。
- 配对区是次级面板，不抢占终端输入。
- 已配对后配对区折叠为设备状态和 `Forget` 操作，不再继续展示配对码输入框。
- 输出区保持深色但有边距、边框和圆角，用户知道这是“终端窗口”，不是 App 黑屏。
- 底部命令输入固定可见，发送按钮高对比。

### 5.3 协议变化

不改协议。继续使用：

- HTTP pairing API
- `/ws/mobile`
- `session.open`
- `terminal.input`
- `terminal.output`

### 5.4 错误处理

- 连接错误仍显示在 Banner。
- 未配对或未连接时，发送命令继续输出本地提示。
- App 后台恢复和手动重连逻辑不变。
- 开发烟测中如果 SecureStore 已恢复 token，即使配置了自动配对码，也应直接自动连接；没有 token 时才等待自动配对。

### 5.5 测试方案

- 新增主题测试，确保根背景和 splash 背景不是黑色，终端面板与外层背景不同。
- 移动端现有协议和状态测试继续运行。
- iOS 模拟器截图检查 UI 是否非黑屏。
- iOS 模拟器端到端 smoke：Server + Agent + Metro + App，执行命令并观察输出。
- 真机重新安装并启动，验证进程和新 UI 可见。

## 6. 验收标准

- `pnpm --filter @remote/mobile test` 通过。
- `pnpm --filter @remote/mobile typecheck` 通过。
- `pnpm --filter @remote/mobile build` 通过。
- iOS 模拟器截图主界面不是整屏黑色。
- 模拟器能完成配对、连接和 `pwd` 或 `printf "__SIM_UI__%s\n" "$PWD"` 输出。
- 真机重新安装后能启动，不再停留在黑色 splash 或整屏黑 UI。

## 7. 风险与后续

- 当前没有 Detox/idb，模拟器 UI 操作可能需要 AppleScript 坐标点击；如果系统权限阻止自动点击，需要用截图和底层 smoke 作为替代验证并明确记录。
- 真机自动触控不可用，最终 Pair/Connect 仍可能需要用户手动确认。
- 真实云端链路仍要等 Render 部署后验证。
