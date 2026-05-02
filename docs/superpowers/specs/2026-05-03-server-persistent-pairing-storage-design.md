# Server 持久配对与 token 存储实现方案

## 1. 背景

Server 当前的 pairing code、pairing request、binding 和 session token 都保存在内存中。进程重启后：

- Mobile SecureStore 中保存的 token 会变成无效。
- 已批准 binding 丢失。
- 用户需要重新配对。

Mobile 已经具备本地 token 恢复能力，因此 Server 也需要一个最小持久层，让云中转或本地长期运行时不会因为进程重启丢失绑定关系。

## 2. 目标

- Server 增加 `REMOTE_DATA_DIR` 配置。
- 未配置 `REMOTE_DATA_DIR` 时保持当前内存模式，避免影响测试和快速开发。
- 配置 `REMOTE_DATA_DIR` 时，Server 将 pairing records 和 session token records 保存到 JSON 文件。
- Server 重启后能读取已有 binding、request 和 token。
- 已保存且未过期 token 在重启后仍可通过 `session.open` 校验。
- JSON 损坏时启动失败，避免静默丢失授权数据。

## 3. 非目标

- 不引入数据库。
- 不做多用户账号隔离。
- 不做 token hash 存储。
- 不做跨进程文件锁。
- 不做 token refresh/revoke。

## 4. 技术设计

### 4.1 配置

`ServerConfig` 增加：

```ts
dataDir: string | null;
```

环境变量：

```text
REMOTE_DATA_DIR=/path/to/server-data
```

### 4.2 文件布局

当 `REMOTE_DATA_DIR` 存在时：

```text
<REMOTE_DATA_DIR>/pairing-store.json
<REMOTE_DATA_DIR>/session-tokens.json
```

### 4.3 Pairing store

将现有 `MemoryPairingStore` 抽象为 `PairingStore` interface。

新增 `JsonFilePairingStore`：

- 构造时读取 JSON 文件。
- 文件不存在时从空状态启动。
- 每次 `saveCode()`、`markCodeUsed()`、`saveRequest()`、`saveBinding()` 后写回文件。
- 写入前确保目录存在。
- 读取到损坏 JSON 或不合法结构时抛错。

### 4.4 Session token store

将 `MemorySessionTokenStore` 抽象为 `SessionTokenStore` interface。

新增 `JsonFileSessionTokenStore`：

- 构造时读取 JSON 文件。
- 文件不存在时从空状态启动。
- `issueSessionToken()` 后写回文件。
- `verifySessionToken()` 使用已加载 token 校验。
- 损坏 JSON 或不合法结构时抛错。

### 4.5 Server 接入

`registerWsRoutes()` 根据 `config.dataDir` 选择：

- `null`：`MemoryPairingStore` + `MemorySessionTokenStore`
- 有值：`JsonFilePairingStore` + `JsonFileSessionTokenStore`

`tokensByPairingRequestId` 当前也要持久化恢复。为了避免新增第三个文件，`GET /pairing/requests/:id` 在 approved 状态下根据 request 的 `deviceId`、`mobileClientId` 到 token store 中查找对应 token。新增方法：

```ts
findTokenForBinding(deviceId, mobileClientId): SessionTokenRecord | undefined
```

如果找到多个 token，选择 `issuedAt` 最新且未过期的 token。

## 5. 测试方案

- `loadServerConfig()` 能读取 `REMOTE_DATA_DIR`。
- `JsonFilePairingStore` 能保存并重新加载 binding/request。
- `JsonFilePairingStore` 遇到损坏 JSON 抛错。
- `JsonFileSessionTokenStore` 能保存并重新加载 token。
- `JsonFileSessionTokenStore` 遇到损坏 JSON 抛错。
- Server 使用同一个 `REMOTE_DATA_DIR` 重建后，旧 token 仍可打开在线 Agent 的 terminal session。

## 6. 验收标准

- 配置 `REMOTE_DATA_DIR` 后，配对批准生成 JSON 文件。
- Server 重启后，`GET /pairing/bindings` 仍返回旧 binding。
- Server 重启后，Mobile 已保存 token 仍能通过 `session.open`。
- 未配置 `REMOTE_DATA_DIR` 时，现有测试和本地开发行为不变。

## 7. 风险与后续

- JSON 文件适合单进程 MVP，不适合多实例云部署。
- token 仍是明文保存，正式账号体系需要 hash 或加密存储。
- 没有文件锁，多进程写入会丢数据。
- 后续应迁移到 SQLite/Postgres，并加 token revoke/refresh。
