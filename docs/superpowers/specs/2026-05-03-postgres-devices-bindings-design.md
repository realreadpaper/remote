# Postgres Devices and Bindings Persistence Design

## 背景

当前 Server 的设备、配对和 session token 主要使用内存或 JSON 文件存储。这能支撑本地开发，但不适合云中转：Server 重启后绑定关系可能丢失，多实例部署时 JSON 文件也无法共享。

Task 14 要先引入 PostgreSQL schema 和 repository 边界，为后续云端化做准备。为了控制范围，本任务只交付 schema、DB adapter、repository 和测试，不把全部 WebSocket/PairingService 业务立即迁移到 Postgres。

## 目标

- 新增 PostgreSQL schema：
  - `users`
  - `devices`
  - `mobile_clients`
  - `device_bindings`
  - `sessions`
- 新增 DB adapter，Server 业务层后续只依赖 repository，不直接写 SQL。
- 新增 `DeviceRepository`：
  - device upsert。
  - 根据 id 查询 device。
  - 查询用户设备列表。
- 新增 `BindingRepository`：
  - upsert mobile client。
  - create device binding。
  - revoke device binding。
  - list active bindings。
- 开发测试使用 in-memory Postgres 兼容库跑 schema 和 repository 测试，不依赖 Docker。
- 保持现有 Server 行为不变。

## 非目标

- 不接入真实云 PostgreSQL。
- 不把 PairingService 立即替换为 Postgres store。
- 不实现登录系统。
- 不实现迁移工具版本管理。
- 不实现多租户权限完整模型。

## 方案

### DB Adapter

新增轻量接口：

```ts
export interface Queryable {
  query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
```

真实运行时可用 `pg.Pool`，测试可用 `pg-mem` adapter。Repository 只依赖 `Queryable`。

### Schema

`schema.sql` 使用 PostgreSQL DDL：

- `users`
  - `id text primary key`
  - `email text unique`
  - `created_at timestamptz not null`
  - `disabled_at timestamptz`
- `devices`
  - `id text primary key`
  - `owner_user_id text references users(id)`
  - `name text not null`
  - `platform text not null`
  - `capabilities jsonb not null`
  - `last_seen_at timestamptz not null`
  - `revoked_at timestamptz`
- `mobile_clients`
  - `id text primary key`
  - `user_id text references users(id)`
  - `name text not null`
  - `platform text not null`
  - `last_seen_at timestamptz not null`
  - `revoked_at timestamptz`
- `device_bindings`
  - `id text primary key`
  - `device_id text references devices(id)`
  - `mobile_client_id text references mobile_clients(id)`
  - `user_id text references users(id)`
  - `approved_at timestamptz not null`
  - `revoked_at timestamptz`
- `sessions`
  - `id text primary key`
  - `device_id text references devices(id)`
  - `mobile_client_id text references mobile_clients(id)`
  - `state text not null`
  - `created_at timestamptz not null`
  - `closed_at timestamptz`

### Repository

`DeviceRepository`:

```ts
upsertDevice(input): Promise<DeviceRecord>
getDevice(deviceId): Promise<DeviceRecord | undefined>
listDevicesForUser(userId): Promise<DeviceRecord[]>
```

`BindingRepository`:

```ts
upsertMobileClient(input): Promise<MobileClientRecord>
createBinding(input): Promise<DeviceBindingRecord>
revokeBinding(bindingId, revokedAt): Promise<boolean>
listActiveBindingsForUser(userId): Promise<DeviceBindingRecord[]>
```

### 测试

使用 `pg-mem`：

- 建库。
- 执行 `schema.sql`。
- 用 repository 写入/查询。

测试覆盖：

- device register upsert。
- binding create。
- binding revoke。
- query user device list。

## 验收标准

- `apps/server/src/persistence/schema.sql` 存在并包含五张表。
- Repository 测试跑真实 SQL schema。
- `pnpm --filter @remote/server test` 通过。
- `pnpm test`、`pnpm typecheck`、`pnpm build` 通过。
- 主计划 Task 14 全部勾选。

## 已知风险

- `pg-mem` 不是完整 PostgreSQL，真实云库上线前仍需跑真实 Postgres 验收。
- 当前只是引入 repository，业务层仍有内存/JSON store；后续任务需要逐步迁移。
- `users.email` 允许 null，MVP 设备绑定可先由内部 user id 驱动。

## 自检

- Placeholder scan: 没有 TBD/TODO。
- Scope check: 聚焦 schema/repository，不改业务行为。
- Consistency: 表名、repository 方法和主计划 Task 14 对齐。
