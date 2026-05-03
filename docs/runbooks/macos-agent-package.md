# macOS Agent Desktop 本地运行、签名与公证

本 runbook 覆盖 Electron macOS Agent 的本地运行、开发目录打包、Developer ID 签名和 Apple notarization。没有 Apple Developer 凭据时，只执行开发运行和 `pack:dir`。

## 前置条件

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
```

## 环境变量

- `REMOTE_SERVER_URL`：Agent relay WebSocket 地址，默认 `ws://127.0.0.1:8787/ws/agent`。
- `REMOTE_DEVICE_NAME`：桌面壳展示和上报的设备名称，默认 macOS hostname。
- `REMOTE_DEV_TOKEN`：开发 relay token；只用于内部测试。
- `SHELL`：PTY shell，默认 `/bin/zsh`。

## 本地开发运行

先启动 Server：

```bash
pnpm dev:server
```

启动 Electron 桌面 Agent：

```bash
REMOTE_DEVICE_NAME="MacBook Pro" pnpm --filter @remote/agent-desktop dev
```

预期：

- 主窗口显示设备名、Server、Device ID、Shell。
- 菜单栏出现 Terminal First Agent 状态入口。
- Agent 注册后显示 pairing code 和二维码。
- 终端能力开关关闭时，Agent WebSocket 和本地 PTY 会被关闭。

## 本地目录打包

生成本地 app 目录，用于开发检查：

```bash
pnpm --filter @remote/agent-desktop pack:dir
```

输出位于 `apps/agent-desktop/dist/mac-arm64` 或对应架构目录。

如果本机 keychain 有可用 Developer ID Application 证书，electron-builder 可能会自动签名；如果没有证书，目录打包仍用于本地检查。

## Developer ID 证书

正式分发需要 Apple Developer Program 账号和 Developer ID Application 证书。

1. 在 Apple Developer 账号中创建或下载 Developer ID Application certificate。
2. 把证书和私钥安装到构建机器的 login keychain。
3. 确认证书可用于 codesign：

```bash
security find-identity -v -p codesigning
```

预期输出包含类似：

```text
Developer ID Application: <Team Name> (<TEAM_ID>)
```

如果 CI 使用临时 keychain，需要先导入 `.p12`，解锁 keychain，并允许 `codesign` 访问私钥。

## App Store Connect API Key

Notarization 使用 App Store Connect API Key。准备：

- Key ID。
- Issuer ID。
- `AuthKey_<KEY_ID>.p8` 文件。
- Team ID。

`.p8`、`.p12`、keychain password、API issuer 等 secret 不能提交到仓库。

本地 shell 示例：

```bash
export CSC_NAME="Developer ID Application: <Team Name> (<TEAM_ID>)"
export APPLE_TEAM_ID="<TEAM_ID>"
export APPLE_API_KEY="/absolute/path/AuthKey_<KEY_ID>.p8"
export APPLE_API_KEY_ID="<KEY_ID>"
export APPLE_API_ISSUER="<ISSUER_UUID>"
```

## 正式构建、公证和输出

运行：

```bash
pnpm --filter @remote/agent-desktop dist:mac
```

该命令会：

1. 构建 `@remote/agent`。
2. 构建 `@remote/agent-desktop`。
3. 用 Electron Builder 生成 macOS `.dmg` 和 `.zip`。
4. 使用 Developer ID Application identity 签名。
5. 使用 App Store Connect API Key 提交 notarization。

输出位于 `apps/agent-desktop/dist`，常见文件包括：

- `Terminal First Agent-<version>-arm64.dmg`
- `Terminal First Agent-<version>-arm64-mac.zip`

## 签名与公证验证

验证 app bundle 签名信息：

```bash
codesign --display --verbose=4 "apps/agent-desktop/dist/mac-arm64/Terminal First Agent.app"
```

严格验证签名：

```bash
codesign --verify --deep --strict --verbose=2 "apps/agent-desktop/dist/mac-arm64/Terminal First Agent.app"
```

验证 Gatekeeper：

```bash
spctl --assess --type execute --verbose=4 "apps/agent-desktop/dist/mac-arm64/Terminal First Agent.app"
```

验证 notarization stapling：

```bash
xcrun stapler validate "apps/agent-desktop/dist/mac-arm64/Terminal First Agent.app"
```

检查 `.dmg`：

```bash
spctl --assess --type open --context context:primary-signature --verbose=4 "apps/agent-desktop/dist/Terminal First Agent-0.1.0-arm64.dmg"
```

## 验证命令

```bash
pnpm --filter @remote/agent-desktop test
pnpm --filter @remote/agent-desktop typecheck
pnpm --filter @remote/agent-desktop build
pnpm --filter @remote/agent-desktop pack:dir
```

全仓库验证：

```bash
pnpm test
pnpm typecheck
pnpm build
```

## 已知风险

- `node-pty` 是原生模块，Electron 正式打包可能需要针对 Electron ABI rebuild。
- 当前没有开机启动、自动更新和日志查看器。
- 没有 Developer ID 和 notarization 的 app 在部分 macOS 环境会被 Gatekeeper 拦截，只能作为开发包使用。

## 常见失败原因

### 找不到 Developer ID Application identity

现象：

```text
skipped macOS application code signing
```

或：

```text
Identity name is specified, but no valid identity with this name in the keychain
```

处理：

- 运行 `security find-identity -v -p codesigning`。
- 确认 `CSC_NAME` 与输出完全一致。
- CI 中确认 keychain 已解锁，证书私钥已导入。

### Notarization API Key 无法读取

现象：

```text
Cannot find APPLE_API_KEY
```

处理：

- 使用绝对路径配置 `APPLE_API_KEY`。
- 确认 `.p8` 文件存在且构建用户可读。
- 确认 `APPLE_API_KEY_ID` 和 `APPLE_API_ISSUER` 对应同一把 key。

### Team ID 不匹配

现象：

```text
The specified provider could not be found
```

处理：

- 确认 `APPLE_TEAM_ID` 是 Developer Team ID，不是 Key ID。
- 确认证书、API key、Team ID 属于同一个 Apple Developer team。

### Native module 签名失败

现象：

```text
code object is not signed at all
```

或 `node-pty` 相关 `.node` 文件加载失败。

处理：

- 删除 `apps/agent-desktop/dist` 后重新执行 `pnpm --filter @remote/agent-desktop dist:mac`。
- 确认 electron-builder 日志包含 native dependency rebuild。
- 在目标架构机器上分别验证 arm64/x64。

### Gatekeeper 仍然拦截

处理：

- 运行 `xcrun stapler validate`。
- 对 app 和 dmg 分别执行 `spctl --assess`。
- 如果 notarization 已通过但没有 stapling，重新执行 `xcrun stapler staple <app-or-dmg>`。
