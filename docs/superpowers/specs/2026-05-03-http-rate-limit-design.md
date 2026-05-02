# HTTP Pairing Rate Limit Design

## 背景

现在 Server 已经支持 dev token guard，并保护了 WebSocket 与 HTTP pairing/revoke 路由。但如果后续默认走云中转，公网入口仍需要基础防滥用能力：

- `POST /pairing/requests` 可以被反复提交配对码。
- `GET /pairing/requests/:pairingRequestId` 会被 Mobile 轮询，不能被误伤，但也不能无限刷。
- `POST /session-tokens/revoke` 需要避免被高频打空请求。
- `GET /pairing/bindings` 只用于开发/管理查看，也应该受基础保护。

本设计实现免费方案：单进程内存固定窗口限流。不引入 Redis、云 WAF、付费服务或账号系统。

## 目标

- 为 HTTP pairing/status/bindings/revoke 路由增加基础 rate limit。
- 默认启用，保护本地暴露到局域网或公网开发环境。
- Mobile 正常配对轮询不会触发默认限流。
- 超限返回 HTTP 429，并给出可读错误和 `Retry-After`。
- 限流逻辑独立成小模块，后续云中转多实例时可替换为 Redis/数据库实现。

## 非目标

- 不实现分布式限流。
- 不实现账号级、设备级或正式风控。
- 不限制 WebSocket 消息频率。
- 不做验证码、封禁列表、IP reputation。
- 不改变 pairing、token、binding 的业务语义。

## 推荐方案

采用固定窗口内存限流：

- 每个 Server 进程维护一个 `Map<string, RateLimitBucket>`。
- key 由 route scope 和客户端来源组成，例如 `pairing.request:127.0.0.1`。
- 每个 bucket 包含 `windowStartedAt` 和 `count`。
- 当前时间超过窗口长度时重置 bucket。
- count 超过 limit 时拒绝请求。

选择这个方案的原因：

- 完全免费，不增加部署依赖。
- 对单机 MVP 和开发云中转足够。
- 行为可通过 fake clock 单测稳定验证。
- 后续迁移 Redis 时可以保留 `RateLimiter` 接口，替换 store 即可。

## 配置

`ServerConfig` 增加：

```ts
rateLimitWindowMs: number;
rateLimitMaxRequests: number;
```

环境变量：

```bash
REMOTE_HTTP_RATE_LIMIT_WINDOW_MS=60000
REMOTE_HTTP_RATE_LIMIT_MAX=120
```

默认值：

- `rateLimitWindowMs = 60_000`
- `rateLimitMaxRequests = 120`

默认值说明：

- Mobile 配对等待时默认每秒轮询一次，60 秒约 60 次。
- 120 次/分钟允许正常轮询、重试和少量并发，不会误伤常规使用。
- 对公网爆破来说，120 次/分钟/IP 是基础保护，不是最终安全边界。

配置校验：

- 两个值必须是正整数。
- `REMOTE_HTTP_RATE_LIMIT_WINDOW_MS` 小于 1000 时拒绝启动，避免误配置导致窗口过短。
- `REMOTE_HTTP_RATE_LIMIT_MAX` 小于 1 时拒绝启动。

## 客户端识别

限流 key 使用：

1. `x-forwarded-for` 的第一个 IP，适配反向代理。
2. 否则使用 `request.ip`。
3. 如果都不存在，使用 `unknown`。

设计取舍：

- 开发期反向代理场景可以工作。
- 多用户共用出口 IP 时会共享额度，这是免费 MVP 的可接受限制。
- 正式云中转后应在可信代理层清洗 `x-forwarded-for`，不能盲信用户伪造 header。

## 路由范围

所有已受 HTTP dev token guard 保护的 route 都接入限流：

- `GET /pairing/bindings`
- `POST /pairing/requests`
- `GET /pairing/requests/:pairingRequestId`
- `POST /session-tokens/revoke`

顺序：

1. 先做 dev token guard。
2. token 通过后做 rate limit。
3. rate limit 通过后进入业务逻辑。

原因：

- 未授权请求已经被 401 拦截，不消耗业务限流额度。
- 授权 token 泄漏或客户端异常时，限流仍能保护 pairing/revoke。

## 响应格式

超限时返回：

```json
{
  "error": "Rate limit exceeded",
  "retryAfterMs": 42000
}
```

同时设置：

```http
Retry-After: 42
```

`Retry-After` 使用向上取整秒数，兼容 HTTP 客户端。

## 模块边界

新增 `apps/server/src/rateLimit.ts`：

```ts
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export class MemoryRateLimiter {
  constructor(options: RateLimitOptions);
  check(key: string): RateLimitResult;
}
```

`ws.ts` 只负责：

- 创建 `MemoryRateLimiter`。
- 从 request 提取 client key。
- 在 route handler 入口调用 helper。
- 返回 429。

`rateLimit.ts` 不依赖 Fastify，方便单测和后续替换。

## 测试策略

### 单元测试

新增 `apps/server/tests/rateLimit.test.ts`：

- 同一 key 在窗口内允许前 N 次。
- 第 N+1 次返回 `allowed: false` 和正确 `retryAfterMs`。
- 窗口过期后同一 key 重新允许。
- 不同 key 使用独立额度。

### 配置测试

更新 `apps/server/tests/config.test.ts`：

- 默认配置包含 `rateLimitWindowMs: 60000`、`rateLimitMaxRequests: 120`。
- 环境变量能覆盖默认值。
- 非数字、非正数和过短窗口会抛错。

### 路由测试

更新 `apps/server/tests/ws.test.ts`：

- 使用低额度 config，例如 `rateLimitMaxRequests: 2`。
- 带正确 dev token 连续请求同一 HTTP route，第 3 次返回 429。
- `Retry-After` header 存在。
- 不同 IP 不共享额度。
- 现有配对/撤销测试继续通过。

## 验收标准

- `REMOTE_REQUIRE_DEV_TOKEN=1` 时，带正确 token 的 HTTP route 仍会被限流保护。
- 默认配置下，现有 Server 和 Mobile 测试不需要特殊修改即可通过。
- 超限请求返回 429，不进入业务逻辑。
- `pnpm --filter @remote/server test` 通过。
- 全仓 `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- 内存限流只对单进程有效，多实例云中转需要共享 store。
- `x-forwarded-for` 必须由可信代理设置，否则生产环境可能被伪造。
- IP 级限流可能误伤同一 NAT 后的多个用户。
- 120 次/分钟只是基础保护，不替代正式账号、设备绑定和审计。

## 后续

- 云中转正式化时新增 Redis/Postgres rate limit store。
- 增加 WebSocket 消息级限流，保护 terminal input/output。
- 增加账号级、设备级和 pairing code 维度的组合限流。
