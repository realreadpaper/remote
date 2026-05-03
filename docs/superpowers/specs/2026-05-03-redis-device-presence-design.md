# Redis Device Presence Design

## 背景

当前 `DeviceRegistry` 同时保存设备元数据和在线状态。这个内存实现对单进程开发可用，但云端多实例时，Agent 连接在某个 Server 实例上，Mobile 可能请求另一个实例，在线状态需要共享。Task 15 的目标是把在线状态抽象成 store，并提供内存和 Redis 两种实现。

## 目标

- `DeviceRegistry` 保留设备元数据管理，但在线状态通过 `DevicePresenceStore` 读取。
- 开发期默认使用 `MemoryDevicePresenceStore`。
- 新增 `RedisDevicePresenceStore`，用于云端共享在线状态。
- 支持上线、心跳、断开、过期。
- 保持现有 `/devices` 和 session open 的行为不变。
- 保持 `pnpm --filter @remote/server test/typecheck/build` 通过。

## 非目标

- 不把设备元数据迁移到 Redis。
- 不实现 Redis Sentinel/Cluster 配置。
- 不把 Server 启动配置切到 Redis，Task 16 云部署时再接环境变量。
- 不实现跨实例 WebSocket route affinity。

## Store 接口

```ts
export interface DevicePresenceStore {
  markOnline(deviceId: string, now?: Date): void | Promise<void>;
  heartbeat(deviceId: string, now?: Date): void | Promise<void>;
  markOffline(deviceId: string, now?: Date): void | Promise<void>;
  getPresence(deviceId: string, now?: Date): DevicePresence | undefined | Promise<DevicePresence | undefined>;
}
```

`DevicePresence`：

```ts
interface DevicePresence {
  online: boolean;
  lastSeenAt: string;
  expiresAt: string | null;
}
```

内存实现默认 TTL 为 60 秒。`getPresence()` 如果当前时间超过 `expiresAt`，返回 offline。

## Redis 设计

Redis key：

```text
presence:device:<deviceId>
```

Value JSON：

```json
{
  "online": true,
  "lastSeenAt": "2026-05-03T10:00:00.000Z",
  "expiresAt": "2026-05-03T10:01:00.000Z"
}
```

上线/心跳：

- 写 JSON。
- 设置 Redis key TTL。

离线：

- 写 `online=false`、`expiresAt=null`。
- 保留短 TTL，便于短期查询 lastSeen。

## DeviceRegistry 调整

- `register()` 保存设备元数据，并调用 `presence.markOnline(deviceId)`。
- `markOffline()` 调用 `presence.markOffline(deviceId)`。
- 新增 `heartbeat(deviceId)` 调用 `presence.heartbeat(deviceId)`。
- `get()` 和 `list()` 从 presence store 合成 `online`。

为了保持现有调用简单，`DeviceRegistry` 使用同步 store 接口；Redis store 独立实现 async methods，后续接入 Server 时再引入 async registry 或 presence service。当前 Task 15 交付 Redis store 类和内存 registry 抽象。

## 测试策略

- `DeviceRegistry` 默认内存 store 下现有测试继续通过。
- 新增上线/心跳/断开/过期测试：
  - register 后 online true。
  - heartbeat 延长 expiresAt。
  - markOffline 后 online false。
  - TTL 过期后 online false。
- `RedisDevicePresenceStore` 通过 fake Redis client 测试 set/get/ttl payload。

## 验收标准

- `apps/server/src/deviceRegistry.ts` 存在 presence store 抽象和内存实现。
- `apps/server/src/presence/redisPresenceStore.ts` 存在 Redis 实现。
- Server 测试覆盖上线、心跳、断开、过期。
- `pnpm --filter @remote/server test` 通过。
- 主计划 Task 15 全部勾选。

## 已知风险

- 当前 Server 路由仍实例内 route；Redis presence 只解决在线状态共享，不解决会话消息跨实例路由。
- Redis store 暂未接入 config，Task 16 云部署时再绑定环境变量。
- DeviceRegistry 暂保持同步 API，Redis 接入运行时可能需要引入 async presence service。

## 自检

- Placeholder scan: 没有 TBD/TODO。
- Scope check: 聚焦 presence store，不改 WebSocket routing。
- Consistency: 主计划 Task 15 每个验收点都有对应设计。
