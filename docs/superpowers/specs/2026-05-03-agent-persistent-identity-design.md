# Agent 持久设备身份实现方案

## 1. 背景

当前 Agent 的 `deviceId` 来自 `REMOTE_DEVICE_ID`，未配置时使用 `${hostname}-dev`。这适合本地调试，但不适合安装版和 iOS 绑定：Agent 重装、换主机名或用户忘记环境变量后，Server 会把同一台 Mac 当成不同设备。

后续配对、绑定、设备列表、会话授权都需要稳定设备身份。因此先让 Agent 在本地生成并保存设备身份。

## 2. 目标

- Agent 首次启动时生成稳定 `deviceId` 和 Ed25519 密钥对。
- 开发期身份保存到 `~/.remote-terminal-agent/identity.json`。
- Agent 后续启动读取同一份身份，不再因为未配置 `REMOTE_DEVICE_ID` 而变化。
- 保留 `REMOTE_DEVICE_ID` 作为开发覆盖项，便于现有脚本、测试和手动 smoke 不被破坏。
- 损坏的身份文件必须拒绝启动，并给出明确错误。
- 在 identity 模块中预留生产期 Keychain 接口边界。

## 3. 非目标

- 不接入 macOS Keychain。
- 不实现 Server 设备公钥校验。
- 不实现二维码、配对码或绑定状态机。
- 不实现 Agent GUI 或安装包。
- 不迁移已有 `${hostname}-dev` 设备 ID。

## 4. 用户流程

1. 用户第一次启动 Agent。
2. Agent 检查身份文件是否存在。
3. 如果不存在，Agent 生成 `deviceId`、`publicKey`、`privateKey`、`createdAt` 并保存。
4. Agent 使用持久 `deviceId` 注册到 Server。
5. 用户后续重启 Agent，Agent 读取同一个 `deviceId`。
6. 如果身份文件损坏，Agent 启动失败，提示本地身份文件无效。

## 5. 技术设计

### 5.1 组件变化

- 新增 `apps/agent/src/identity.ts`。
- 修改 `apps/agent/src/config.ts`，默认从 identity 模块读取 `deviceId`。
- `apps/agent/src/agentClient.ts` 不需要业务改动，因为它已经只消费 `AgentConfig.deviceId`。
- 新增 `apps/agent/tests/identity.test.ts`。

### 5.2 identity 文件结构

```json
{
  "version": 1,
  "deviceId": "uuid",
  "publicKey": "-----BEGIN PUBLIC KEY-----...",
  "privateKey": "-----BEGIN PRIVATE KEY-----...",
  "createdAt": "2026-05-03T00:00:00.000Z"
}
```

字段规则：

- `version` 必须是 `1`。
- `deviceId` 必须非空。
- `publicKey`、`privateKey` 必须非空。
- `createdAt` 必须非空。
- 文件 JSON 使用 strict 校验，不接受多余字段。

### 5.3 Keychain 预留

`identity.ts` 暴露 `DeviceIdentityStore` 接口：

```ts
export interface DeviceIdentityStore {
  load(): DeviceIdentity | null;
  save(identity: DeviceIdentity): void;
}
```

开发期默认实现为文件 store。未来 macOS 安装版可以增加 Keychain store，但调用方仍使用 `loadOrCreateDeviceIdentity()`。

### 5.4 配置优先级

`loadAgentConfig()` 的 `deviceId` 规则：

1. 如果 `REMOTE_DEVICE_ID` 是非空字符串，使用它。
2. 否则调用 `loadOrCreateDeviceIdentity()`，使用持久身份的 `deviceId`。

这保持当前本地 smoke 和文档命令兼容，同时让安装版默认稳定。

### 5.5 错误处理

- 身份文件不存在：创建目录并写入新身份。
- 身份文件 JSON 无法解析：抛出 `Agent identity file is invalid: <path>`。
- 身份文件字段缺失或多余：抛出同样前缀的错误。
- 保存失败：让文件系统错误向上抛出，Agent 启动失败。

## 6. 测试方案

- `identity.test.ts`
  - 首次调用生成身份文件。
  - 第二次调用返回同一身份。
  - 损坏 JSON 拒绝启动。
  - 缺失关键字段拒绝启动。
  - 默认路径为 `~/.remote-terminal-agent/identity.json`。
- `config.test.ts`
  - 未配置 `REMOTE_DEVICE_ID` 时使用持久 identity 的 `deviceId`。
  - 配置 `REMOTE_DEVICE_ID` 时仍使用环境变量覆盖。
- 运行：
  - `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent test`
  - `PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent typecheck`
  - 影响 Agent 运行配置，最终运行 `PATH="/tmp/codex-corepack-shims:$PATH" pnpm test`

## 7. 验收标准

- Agent 不配置 `REMOTE_DEVICE_ID` 时，连续两次加载配置得到同一个 `deviceId`。
- 新身份文件包含 `deviceId` 和密钥对。
- 损坏身份文件不会静默生成新设备。
- 现有 Agent 测试和 workspace 测试通过。

## 8. 风险与后续

- 私钥暂存在开发期文件中，后续 macOS 安装版必须切换到 Keychain 或受保护存储。
- 还没有把 `publicKey` 发给 Server 校验，下一阶段 Server 配对状态机会使用它。
- 如果用户删除身份文件，Agent 会生成新设备；安装版需要提供“重置设备身份”的明确 UI。
