# macOS Agent Signing and Notarization Design

## 背景

`apps/agent-desktop` 已经能用 Electron 运行并生成本地目录包，但这还不是普通用户可安装的 macOS 应用。macOS 对互联网下载的应用有 Gatekeeper 校验；要让用户正常打开，需要使用 Apple Developer ID Application 证书签名、开启 hardened runtime，并提交 Apple notarization。

Task 11 的目标是把签名、公证和本地验证流程固化到配置和 runbook。没有 Apple Developer 账号、证书、App Store Connect API Key 的本地环境不能完成真实 notarization，因此本任务提供可执行配置、命令和失败排查；真实签名/公证验收在拿到证书后执行。

## 目标

- `apps/agent-desktop` 配置稳定的 bundle id。
- Electron Builder mac 配置启用 hardened runtime。
- 增加 entitlements 文件，满足 hardened runtime 下 Electron + `node-pty` 的运行需求。
- 配置 Developer ID Application 签名入口。
- 配置 notarization 所需命令和环境变量。
- runbook 写清证书、Apple API Key、构建、签名、公证、验证、常见失败原因。
- 保持未配置证书时仍可执行开发目录打包。
- 更新主 MVP 计划和 feature log。

## 非目标

- 不提交真实 Apple 证书、API Key、profile 或 `.p8` 文件。
- 不执行真实 notarization，因为当前环境没有 App Store Connect 凭据。
- 不实现 auto update。
- 不生成正式营销安装页。
- 不解决所有 `node-pty` 分发场景，只记录 Electron native module rebuild 风险。

## 技术依据

- Electron Builder `mac` 配置支持 `hardenedRuntime`、`entitlements`、`entitlementsInherit`、`identity`、`notarize` 等字段。
- Apple 推荐对 Developer ID 分发的 macOS app 使用 notarization，并用 `notarytool` 提交。
- Electron macOS 分发需要同时考虑主 app、helper app、native module 和 runtime entitlement。

## 设计决策

### Bundle ID

保持 Task 10 已配置的 app id：

```text
com.terminalfirst.agent
```

Electron helper 会使用 Electron Builder 派生 bundle id。后续若创建正式 Apple Developer 账号，应在 Certificates, Identifiers & Profiles 中注册对应 App ID。

### 签名

使用 Developer ID Application 证书签名，不使用 Mac App Store 签名。原因：

- MVP 分发目标是官网/私发 `.dmg` 或 `.zip`，不是 Mac App Store。
- Agent 需要本地 PTY 能力，Mac App Store 沙盒路径更复杂。

配置约定：

```json
"identity": "Developer ID Application: <Team Name> (<TEAM_ID>)"
```

实际身份通过环境变量 `CSC_NAME` 或 electron-builder 自动发现控制；仓库配置不写真实证书名。

### Hardened runtime 和 entitlements

Electron Builder mac 配置：

```json
"hardenedRuntime": true,
"entitlements": "build/entitlements.mac.plist",
"entitlementsInherit": "build/entitlements.mac.plist",
"gatekeeperAssess": false
```

初始 entitlements 使用最小集合：

- `com.apple.security.cs.allow-jit`
- `com.apple.security.cs.allow-unsigned-executable-memory`
- `com.apple.security.cs.disable-library-validation`

原因：

- Electron/Chromium 通常需要 JIT 和 unsigned executable memory。
- `node-pty` 和 native module 在签名/加载阶段可能需要关闭 library validation。
- 不开启 App Sandbox，因为当前 Agent 需要访问用户 shell、环境变量和本地 PTY。

### Notarization

使用 electron-builder 的 notarization 配置读取 App Store Connect API Key 环境变量：

```text
APPLE_API_KEY=/absolute/path/AuthKey_XXXXXXXXXX.p8
APPLE_API_KEY_ID=XXXXXXXXXX
APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

正式命令：

```bash
pnpm --filter @remote/agent-desktop dist:mac
```

开发命令继续保留：

```bash
pnpm --filter @remote/agent-desktop pack:dir
```

`pack:dir` 用于无证书开发检查；`dist:mac` 用于带证书的签名、公证发布。

### 验证

本地可验证：

- `pnpm --filter @remote/agent-desktop build`
- `pnpm --filter @remote/agent-desktop pack:dir`
- `codesign --display --verbose=4 <app>`

有证书和 Apple API Key 后验证：

- `codesign --verify --deep --strict --verbose=2 <app>`
- `spctl --assess --type execute --verbose=4 <app>`
- `xcrun stapler validate <app>`

## 文件变更

- `apps/agent-desktop/package.json`
  - 增加 `dist:mac` script。
  - 增加 `mac` target：`dmg` 和 `zip`。
  - 配置 hardened runtime、entitlements、notarize。
- `apps/agent-desktop/build/entitlements.mac.plist`
  - 新增 hardened runtime entitlement。
- `docs/runbooks/macos-agent-package.md`
  - 扩展签名、公证和验证流程。
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
  - 勾选 Task 11。
- `docs/superpowers/records/feature-log.md`
  - 记录交付。

## 验收标准

- `apps/agent-desktop/package.json` 明确 appId/bundle id、hardened runtime、entitlements、notarization 配置。
- runbook 写明 Developer ID Application 证书准备、环境变量、构建命令、验证命令和排障。
- 无证书环境下 `pnpm --filter @remote/agent-desktop pack:dir` 仍可运行。
- `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。
- 主计划 Task 11 全部勾选。

## 已知风险

- 真实 notarization 必须在有 Apple Developer 账号、Developer ID Application 证书、App Store Connect API Key 的机器或 CI 上执行。
- `node-pty` 原生模块可能在不同 macOS/CPU 架构下暴露额外签名或 rebuild 问题。
- `disable-library-validation` 是 Electron native module 常用权衡，但正式安全评审时需要复核。
- 当前没有 CI 密钥管理方案；证书和 API Key 管理进入后续发布工程任务。

## 自检

- Placeholder scan: 没有 TBD/TODO。
- Scope check: 聚焦签名、公证配置和文档，不包含真实 Apple 凭据和发布自动化。
- Consistency: 开发 `pack:dir` 与正式 `dist:mac` 分离，避免无证书环境被阻断。
