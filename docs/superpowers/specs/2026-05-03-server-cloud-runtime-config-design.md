# Server Cloud Runtime Config Design

## 1. 目标

把云端运行所需的 `DATABASE_URL` 和 `REDIS_URL` 纳入 server runtime config。当前 PostgreSQL repository 和 Redis presence store 已存在，但 server 启动配置还不会读取这些 URL，导致云端 runbook 只能写成“准备资源但未 wiring”。

本任务先做配置 readiness，不改变业务存储路径。

## 2. 范围

本任务交付：

- `ServerConfig.databaseUrl`
- `ServerConfig.redisUrl`
- `loadServerConfig()` 读取 `DATABASE_URL` 和 `REDIS_URL`
- URL 基础校验
- runbook/feature log 更新

本任务不交付：

- PairingStore 改为 PostgreSQL。
- SessionTokenStore 改为 PostgreSQL。
- DeviceRegistry 改为 Redis async presence。
- 多实例 WebSocket session routing。

## 3. 行为

默认本地开发：

```ts
databaseUrl: null
redisUrl: null
```

云端：

```bash
DATABASE_URL=postgres://...
REDIS_URL=redis://...
```

`loadServerConfig()` 返回这两个 URL。空字符串会归一为 `null`。

非法 URL 抛错：

```text
DATABASE_URL must be a valid URL
REDIS_URL must be a valid URL
```

## 4. 后续 wiring

后续任务才能把这些配置接入运行时：

- `DATABASE_URL` -> PostgreSQL-backed pairing/session token stores。
- `REDIS_URL` -> Redis-backed device presence。
- 多实例前仍需要 WebSocket route affinity 或集中式 session routing。
