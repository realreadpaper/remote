# 服务端最小外网安全边界实现方案

## 1. 背景

当前服务端适合局域网开发：`/ws/agent` 可以注册 Agent，`/ws/mobile` 可以打开终端会话，`/devices` 可以查看在线设备。局域网内这能快速验证体验，但外网部署时存在明显风险：

- 任意客户端可以注册任意 `deviceId`。
- 任意手机端可以连接任意在线设备。
- `/devices` 无鉴权暴露设备列表。
- WebSocket 没有 token 校验。

外网第一阶段目标不是完整账号系统，而是在部署公网 Relay 前增加最小安全边界，防止裸 WebSocket 直接暴露公网。

## 2. 目标

- Server 支持运行配置：host、port、是否要求开发 token、开发 token。
- `/ws/agent` 和 `/ws/mobile` 支持最小 token 校验。
- 本地局域网开发保持默认无 token，避免影响当前模拟器和真机开发。
- 外网开发环境可以通过 `REMOTE_REQUIRE_DEV_TOKEN=1` 强制 token。
- Agent 和 Mobile 可以携带 token 连接云端。
- Mobile UI 展示连接 URL 时必须脱敏 token。

## 3. 非目标

- 不实现完整账号系统。
- 不实现设备绑定。
- 不实现短期 session token。
- 不实现 PostgreSQL/Redis。
- 不实现端到端加密。
- 不实现正式生产鉴权。

这些能力属于后续功能。本阶段只解决“公网开发 Relay 不允许匿名裸连”。

## 4. 用户和开发流程

### 4.1 本地开发

默认命令保持不变：

```bash
pnpm dev:server
REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
pnpm --filter @remote/mobile exec expo start --ios --localhost --port 8081
```

默认不要求 token。

### 4.2 外网开发

Server：

```bash
HOST=127.0.0.1 \
PORT=8787 \
REMOTE_REQUIRE_DEV_TOKEN=1 \
REMOTE_DEV_TOKEN=<secret> \
pnpm --filter @remote/server dev
```

Agent：

```bash
REMOTE_SERVER_URL=wss://dev-api.example.com/ws/agent \
REMOTE_DEV_TOKEN=<secret> \
REMOTE_DEVICE_ID=mac-dev \
pnpm dev:agent
```

Mobile：

```bash
EXPO_PUBLIC_REMOTE_WS_URL=wss://dev-api.example.com/ws/mobile \
EXPO_PUBLIC_REMOTE_DEV_TOKEN=<secret> \
pnpm dev:mobile
```

## 5. 技术设计

### 5.1 Server 配置

新增 `apps/server/src/config.ts`：

```ts
export interface ServerConfig {
  host: string;
  port: number;
  requireDevToken: boolean;
  devToken: string | null;
  publicBaseUrl: string | null;
}
```

规则：

- `HOST` 默认 `127.0.0.1`。
- `PORT` 默认 `8787`。
- `REMOTE_REQUIRE_DEV_TOKEN=1` 时启用 token 校验。
- `REMOTE_DEV_TOKEN` 为空且启用 token 校验时，server 启动失败。
- `REMOTE_PUBLIC_BASE_URL` 可选，用于文档、日志或后续 route 返回。

### 5.2 Dev token 校验

新增 `apps/server/src/auth/devToken.ts`。

支持两种来源：

1. WebSocket query：

   ```text
   /ws/mobile?token=<secret>
   /ws/agent?token=<secret>
   ```

2. HTTP header：

   ```text
   Authorization: Bearer <secret>
   ```

校验规则：

- `requireDevToken=false`：直接通过。
- `requireDevToken=true` 且 token 正确：通过。
- `requireDevToken=true` 且 token 缺失或错误：拒绝连接。

拒绝策略：

- WebSocket 握手进入 handler 后，如果 token 不合法，立即发送安全错误或直接关闭 socket。
- 不暴露 expected token。
- 日志只记录错误码，不记录 token。

### 5.3 WebSocket 改造

`registerWsRoutes` 接收配置：

```ts
registerWsRoutes(app, config)
```

在 `/ws/agent` 和 `/ws/mobile` handler 入口做 token 校验。校验失败时：

- 不允许 Agent 注册。
- 不允许 Mobile 打开会话。
- 关闭 socket。

本地测试默认保持兼容；新增测试覆盖 token 模式。

### 5.4 Agent 配置

当前 Agent 已支持 `REMOTE_SERVER_URL`。新增：

```text
REMOTE_DEV_TOKEN
```

当 token 存在时，把 token 追加到 WebSocket URL：

```text
wss://dev-api.example.com/ws/agent?token=<secret>
```

注意：

- 如果 URL 已经有 query，需要追加 `&token=...`。
- 日志中不能打印完整 token。

### 5.5 Mobile 配置

新增：

```text
EXPO_PUBLIC_REMOTE_DEV_TOKEN
```

当 token 存在时，把 token 追加到 `EXPO_PUBLIC_REMOTE_WS_URL`。

UI 展示连接 URL 时必须脱敏：

```text
wss://dev-api.example.com/ws/mobile?token=***
```

### 5.6 错误处理

Mobile 连接 token 错误时，可能收到：

- socket close。
- `session.error`。
- server unreachable。

本阶段不追求精确用户文案，但要避免 App 崩溃，并展示可理解错误：

```text
连接被拒绝，请检查服务地址或开发 token。
```

### 5.7 安全边界

本功能只是外网开发最小边界，不是正式安全方案。

能防止：

- 无 token 的公网扫描直接连上 WebSocket。
- 错 token 的 Agent 注册设备。
- 错 token 的 Mobile 打开 session。

不能防止：

- token 泄漏后的滥用。
- 绑定关系缺失导致的授权不足。
- 中转服务读取终端内容。

因此后续必须继续做账号、设备绑定、短期 session token 和端到端加密。

## 6. 测试方案

### 6.1 Server 单元测试

覆盖：

- 默认配置不要求 token。
- `REMOTE_REQUIRE_DEV_TOKEN=1` 且缺少 `REMOTE_DEV_TOKEN` 启动失败。
- query token 正确通过。
- header token 正确通过。
- token 缺失失败。
- token 错误失败。

### 6.2 Server WebSocket 测试

覆盖：

- token 模式下 `/ws/agent` 无 token 不能注册设备。
- token 模式下 `/ws/mobile` 无 token 不能打开 session。
- token 模式下正确 token 保持现有链路可用。
- 非 token 模式下现有测试不变。

### 6.3 Agent 测试

覆盖：

- 无 token 时 URL 不变。
- 有 token 时 URL 追加 `?token=...`。
- 原 URL 已有 query 时追加 `&token=...`。

### 6.4 Mobile 测试

覆盖：

- 无 token 时 URL 不变。
- 有 token 时 URL 追加 token。
- 展示 URL 脱敏。
- auto smoke 模式仍可用。

## 7. 验收标准

- 本地无 token 开发链路不受影响。
- 开启 `REMOTE_REQUIRE_DEV_TOKEN=1` 后，无 token 的 Agent/Mobile 不能连接。
- 正确 token 下，WebSocket 端到端命令仍能返回输出。
- UI 不展示明文 token。
- `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。
- 完成后在 `docs/superpowers/records/feature-log.md` 记录提交和验证结果。

## 8. 风险与后续

风险：

- 开发 token 如果写入公开构建，会被提取。
- query token 可能出现在代理日志中。
- 这不是生产级鉴权。

缓解：

- 只用于外网开发版。
- 文档明确生产前必须替换成账号和短期 session token。
- 日志脱敏。

后续：

- 完整账号登录。
- 设备绑定。
- Agent 本地确认。
- 短期 session token。
- Redis 在线状态。
- 端到端加密。
