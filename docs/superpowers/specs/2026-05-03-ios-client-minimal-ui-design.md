# iOS Client Minimal UI Design

## 目标

将 iOS 客户端优化成终端优先、极简、清晰的工具界面。第一屏重点是打开终端并输入命令；配对和状态信息只保留必要信息，不抢占终端空间。

## 设计方向

- 使用接近 Apple 原生工具的浅色中性背景、白色面板、深石墨终端区和单一蓝色主动作。
- 页面层级保持三段：顶部状态、终端输出、底部命令输入。
- 已配对状态下配对面板压缩为一行，降低视觉重量。
- 保留终端快捷键 rail，但降低装饰感，让它像工具条而不是卡片。
- 输入区固定底部，输入框和发送按钮尺寸稳定，避免键盘出现时布局跳动。

## 范围

本次只做客户端 UI 和主题 token 优化：

- 修改 `apps/mobile/src/components/mobileShellTheme.ts`。
- 修改 `apps/mobile/src/components/TerminalScreen.tsx`。
- 修改 `apps/mobile/tests/mobileShellTheme.test.ts`。
- 更新功能记录。

不新增页面、不改协议、不改配对/会话逻辑、不引入图标库或动画框架。

## 验收

- 客户端不再呈现大面积黑屏；深色只用于终端输出区。
- 主视觉是轻、白、克制，主动作清晰。
- 终端输出区域仍然最大，命令输入在底部稳定可用。
- `pnpm --filter @remote/mobile test`、`pnpm typecheck`、`pnpm build` 通过。
