# Render Server Deploy Config Design

## 1. 背景

局域网链路已经可以让 iPhone 通过本机 Server 连接 macOS Agent。下一步需要把默认外网路径落到真实云 Server：手机和家里的 macOS Agent 都主动连接公网 relay，避免用户先处理 DDNS、端口映射、IPv6 或反向隧道。

Render 被选为第一阶段默认云平台，因为它能用仓库里的 `render.yaml` 一次性创建 Web Service、Postgres 和 Key Value，并自动提供 HTTPS/WSS 入口。Render 官方 Blueprint 规范要求 Web Service 和 Key Value 都放在 `services`，Postgres 放在 `databases`；Docker 服务使用 `runtime: docker`；Key Value 使用 `type: keyvalue`，旧的 `redis` 只是兼容别名。

## 2. 目标

把真实 server 的部署入口落到仓库，使用 Render Blueprint + Dockerfile 创建公网 WebSocket relay。

- 给 Render Dashboard 一个可直接识别的 `render.yaml`。
- 给 Render Docker runtime 一个可构建 `@remote/server` 的根目录 `Dockerfile`。
- 确保云 Server 默认开启 `REMOTE_REQUIRE_DEV_TOKEN=1`，不允许未授权 WebSocket 连接。
- 预创建 Postgres 和 Key Value，并把 `DATABASE_URL`、`REDIS_URL` 注入 Server 运行时配置。
- 把部署、健康检查、Agent 接入、iPhone 接入、云 smoke 步骤写入 runbook。

## 3. 非目标

本任务交付：

- 根目录 `Dockerfile`
- 根目录 `.dockerignore`
- 根目录 `render.yaml`
- cloud runbook 更新

本任务不交付：

- 实际 Render 账号登录和部署。
- 自定义域名 DNS 配置。
- PostgreSQL/Redis 业务 store wiring；当前只完成运行时 URL 注入和资源创建入口。
- 多实例 WebSocket 会话路由；第一阶段必须保持 `numInstances: 1`。
- 生产账号体系；第一阶段继续使用长随机 dev token 做外网开发边界。

## 4. 用户流程

1. 开发者把代码推到 GitHub。
2. 在 Render 创建 Blueprint，选择仓库根目录的 `render.yaml`。
3. Render 创建 `remote-terminal-server`、`remote-terminal-postgres`、`remote-terminal-redis`。
4. Render 生成 `REMOTE_DEV_TOKEN` 并注入 Web Service。
5. 开发者在 Render Dashboard 读取 `REMOTE_DEV_TOKEN` 和服务域名。
6. 家里的 macOS Agent 使用 `wss://<relay-host>/ws/agent` 和 token 连接云 Server。
7. iPhone App 使用 `wss://<relay-host>/ws/mobile` 和同一个 token 连接云 Server。
8. iPhone 通过配对码绑定 Agent，点击 Connect，执行 `printf "__CLOUD__%s\n" "$PWD"`。

## 5. 技术设计

### 5.1 组件变化

`render.yaml` 定义：

- `remote-terminal-server` web service，`runtime: docker`
- `remote-terminal-postgres` Postgres
- `remote-terminal-redis` Key Value，作为 `services` 列表里的 `type: keyvalue`

环境变量：

- `HOST=0.0.0.0`
- `REMOTE_REQUIRE_DEV_TOKEN=1`
- `REMOTE_DEV_TOKEN` 由 Render 生成
- `DATABASE_URL` 引用 Postgres `connectionString`
- `REDIS_URL` 引用 Key Value `connectionString`

Dockerfile 负责：

- 使用 Node 22
- 启用 `pnpm@9.15.0`
- 安装 workspace 依赖
- 构建 `@remote/protocol` 和 `@remote/server`
- 启动 `node apps/server/dist/index.js`

### 5.2 协议变化

不修改 WebSocket 协议。公网路径继续使用已有：

- Agent: `/ws/agent`
- Mobile: `/ws/mobile`
- HTTP health: `/health`
- HTTP devices: `/devices`

### 5.3 数据变化

本任务不新增业务表，也不改变 schema。Render 会创建：

- `remote-terminal-postgres`：供后续绑定、session token、审计存储使用。
- `remote-terminal-redis`：供后续 presence、限流、短期状态共享使用。

Server 当前只读取并校验 `DATABASE_URL`、`REDIS_URL` 格式。业务 store wiring 完成前，云 Server 仍按单实例内存状态工作。

### 5.4 错误处理

- `REMOTE_REQUIRE_DEV_TOKEN=1` 且缺少 `REMOTE_DEV_TOKEN` 时，Server 启动失败。
- `DATABASE_URL` 或 `REDIS_URL` 不是合法 URL 时，Server 启动失败。
- 未带 token 或 token 错误的 WebSocket 连接会被 Server 关闭。
- Docker 镜像启动时监听 `HOST=0.0.0.0` 和 Render 注入的 `PORT`。

### 5.5 安全边界

- Render Web Service 公开 HTTPS/WSS，这是默认外网入口。
- Key Value 设置 `ipAllowList: []`，阻止公网直连，只通过 Render 内网连接。
- Postgres 设置 `ipAllowList: []`，阻止公网直连，只通过 Render 内网连接。
- `REMOTE_DEV_TOKEN` 使用 `generateValue: true`，不进入仓库。
- 第一阶段 dev token 是外网开发门槛，不是最终用户认证。正式发布前需要账号、设备绑定、短期 session token、审计和吊销。

## 6. 测试方案

- 文档自检：检查方案和计划无未完成标记。
- 配置自检：`git diff --check`。
- Server 测试：`pnpm --filter @remote/server test`。
- 全量回归：`pnpm test`、`pnpm typecheck`、`pnpm build`。
- Docker 验证：如果本机有 Docker，运行 `docker build -t remote-terminal-server:render .`；如果没有 Docker，必须在记录里标注未运行。
- 云验收：Render 部署后执行 `/health`、未授权 WebSocket 关闭、Agent 在线、iPhone 蜂窝网络 `__CLOUD__` 命令输出。

## 7. 验收标准

- `render.yaml` 使用 Render 官方 Blueprint 字段：`runtime: docker`、`dockerfilePath`、`dockerContext`、`fromDatabase`、`fromService`。
- Key Value 使用当前字段 `type: keyvalue`，并设置必填的 `ipAllowList`。
- Postgres 和 Key Value 通过 `connectionString` 注入 Server。
- 本地无 Docker 时不能声称镜像构建通过。
- 至少运行 server test/typecheck/build。

## 8. 风险与后续

- Render 免费 Web Service 可能休眠，首连会慢。
- Render 免费资源额度和可用性会变化，需要把失败原因记录到云 smoke 结果里。
- Server 业务状态还没有全部接入 Postgres/Redis，因此云部署必须单实例。
- iPhone 真机 TestFlight、macOS Agent 签名公证、断线恢复仍是后续发布前重点。
