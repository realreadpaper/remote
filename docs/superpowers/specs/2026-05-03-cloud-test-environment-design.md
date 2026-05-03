# Cloud Test Environment Design

## 1. 目标

本设计用于 Task 16：把当前本地可用的 iOS -> Cloud Relay -> macOS Agent 链路，推进到可复现的外网测试环境。目标不是一次性完成生产级云平台，而是让团队能按固定步骤部署一个免费层优先的云端 relay，并在 iPhone 蜂窝网络下打开家里 Mac 的终端执行命令。

验收命令：

```bash
printf "__CLOUD__%s\n" "$PWD"
```

通过标准：iPhone 关闭 Wi-Fi 后，连接云端 `wss://` server，命令输出包含 `__CLOUD__`。

## 2. 范围

本任务交付：

- 云端测试环境 runbook。
- 第一阶段平台选择和资源拓扑。
- PostgreSQL、Redis/Key Value、server、HTTPS/WSS 的配置说明。
- iOS TestFlight/Expo、macOS Agent 指向云端的启动命令。
- 云端冒烟测试记录模板。
- README 中的云端测试入口。

本任务不交付：

- 正式生产计费方案。
- 多租户账号系统。
- Redis/PostgreSQL runtime wiring 改造。
- 多实例 WebSocket session routing。
- 真实 TestFlight 上传和 App Store 审核。

## 3. 第一阶段平台选择

推荐默认使用 Render 免费层做第一阶段云端测试：

- Render Web Service 可托管 Node/Fastify server，公开 HTTPS URL，支持 WebSocket。
- Render 支持 Dockerfile，也支持配置环境变量。
- Render 有免费 Web Service、Postgres 和 Key Value 入口，适合 MVP 试跑。
- Render 托管 TLS 和自定义域名，降低早期运维复杂度。

约束：

- 免费层只用于开发验证，不用于生产。
- Free Postgres 有过期和容量限制。
- Free Key Value 是内存型，重启会丢数据。
- 免费 Web Service 可能休眠、重启或达到月度限制。
- 平台政策可能变化，runbook 需要以官方文档为准。

如果 Render 免费层不可用，备用路径是单台 VPS + Caddy + systemd + 自装 PostgreSQL/Valkey。现有 `docs/runbooks/cloud-relay-dev-deploy.md` 已覆盖这条自托管路径。

## 4. 云端拓扑

```text
iPhone App
  -> wss://<relay-host>/ws/mobile
  -> Render Web Service: @remote/server
  -> wss://<relay-host>/ws/agent
  -> macOS Agent
  -> local PTY

Render Web Service
  -> Render Postgres: future persistent devices/bindings/sessions
  -> Render Key Value: future presence/session short-lived state
```

当前 server runtime 仍使用内存/JSON store。Task 14 和 Task 15 已实现 PostgreSQL repository 与 Redis presence store，但尚未 wiring 到生产 server 配置。因此 Task 16 的 runbook 必须写清楚：

- PostgreSQL/Key Value 要先创建，作为云端化准备。
- 当前 smoke test 的核心链路仍是单实例 WebSocket relay。
- 真实多实例扩容前不能横向扩容 Web Service。

## 5. 配置原则

Server：

```bash
HOST=0.0.0.0
PORT=<platform-provided-port>
REMOTE_REQUIRE_DEV_TOKEN=1
REMOTE_DEV_TOKEN=<long-random-secret>
REMOTE_PUBLIC_BASE_URL=https://<relay-host>
REMOTE_DATA_DIR=/var/data/terminal-first-remote
```

Render Web Service 必须绑定到 `0.0.0.0`，并使用平台提供的 `PORT`。如果走 Dockerfile，镜像只启动 server，不启动 mobile 或 agent。

Agent：

```bash
REMOTE_SERVER_URL=wss://<relay-host>/ws/agent
REMOTE_DEV_TOKEN=<long-random-secret>
REMOTE_DEVICE_ID=home-mac
pnpm dev:agent
```

iOS：

```bash
EXPO_PUBLIC_REMOTE_WS_URL=wss://<relay-host>/ws/mobile
EXPO_PUBLIC_REMOTE_API_URL=https://<relay-host>
EXPO_PUBLIC_REMOTE_DEV_TOKEN=<long-random-secret>
EXPO_PUBLIC_REMOTE_DEVICE_ID=home-mac
pnpm dev:mobile
```

## 6. 安全边界

公网环境必须启用 `REMOTE_REQUIRE_DEV_TOKEN=1`。未带 token 的 WebSocket 应关闭，HTTP pairing/status 请求应返回未授权。

开发 token 不是最终账号系统，只是 MVP 外网测试的最低安全边界。token 不能提交到仓库，必须通过云平台环境变量或本机 shell 注入。

## 7. 冒烟测试流程

1. 验证公网健康检查：

   ```bash
   curl https://<relay-host>/health
   ```

2. 验证无 token WebSocket 被拒绝。
3. 家里 Mac 启动 Agent，指向 `wss://<relay-host>/ws/agent`。
4. 云端 `/devices` 能看到 `home-mac` 且 `online=true`。
5. iPhone 关闭 Wi-Fi，只用蜂窝网络。
6. Mobile 指向 `wss://<relay-host>/ws/mobile`。
7. 配对并打开终端。
8. 执行：

   ```bash
   printf "__CLOUD__%s\n" "$PWD"
   ```

9. 记录延迟、断线、重连、错误信息和云平台日志链接。

## 8. 文档结构

新增：

- `docs/runbooks/cloud-test-environment.md`

修改：

- `README.md`
- `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- `docs/superpowers/records/feature-log.md`

## 9. 验收标准

- runbook 能让一个没有当前上下文的人创建云端测试环境。
- runbook 明确 Render 默认路径和 VPS 备用路径。
- README 能快速定位云端测试入口。
- 文档列出真实云端 smoke test 的阻塞条件：账号、域名、云资源、TestFlight 或 Expo 真机。
- 在缺少真实云端账号时，不能把真实外网验收标记为完成，只能标记 runbook 和本地文档验证完成。

## 10. 参考

- Render Web Services: https://render.com/docs/web-services/
- Render Environment Variables and Secrets: https://render.com/docs/configure-environment-variables
- Render Deploy for Free: https://render.com/docs/free
- Render Key Value: https://render.com/docs/redis
- Render Docker: https://render.com/docs/docker
