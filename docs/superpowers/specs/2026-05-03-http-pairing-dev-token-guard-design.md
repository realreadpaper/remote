# HTTP Pairing Dev Token Guard 实现方案

## 1. 背景

当前 `REMOTE_REQUIRE_DEV_TOKEN=1` 时，Server 已保护 `/ws/agent` 和 `/ws/mobile` WebSocket 握手。但 HTTP 接口仍未统一保护：

- `POST /pairing/requests`
- `GET /pairing/requests/:id`
- `GET /pairing/bindings`
- `POST /session-tokens/revoke`

外网开发部署时，这些 HTTP 接口同样需要 dev token 边界，否则攻击者可以尝试提交配对码、查询请求状态或撤销 token。

## 2. 目标

- `REMOTE_REQUIRE_DEV_TOKEN=1` 时，HTTP pairing/revoke 接口必须校验 dev token。
- 支持 header：`Authorization: Bearer <token>`。
- 支持 query：`?token=<token>`，便于开发 smoke。
- 未开启 `REMOTE_REQUIRE_DEV_TOKEN` 时保持当前本地开发行为。
- Mobile `PairingClient` 支持配置 `devToken`，自动给 HTTP 请求加 `Authorization` header。
- `TerminalScreen` 使用 runtime config 的 `devToken` 创建 `PairingClient`。

## 3. 非目标

- 不做正式账号登录。
- 不做 CSRF。
- 不做 rate limit。
- 不移除 query token；正式生产后再改为登录态/header only。

## 4. 技术设计

### 4.1 Server

复用现有：

- `getProvidedDevToken(request)`
- `validateDevToken(config, token)`

新增 helper：

```ts
function isAuthorizedHttpRequest(request, reply, config): boolean
```

行为：

- authorized：返回 true。
- unauthorized：`reply.code(401).send({ error: "Unauthorized" })`，返回 false。

在以下 route 开头调用：

- `GET /pairing/bindings`
- `GET /pairing/requests/:pairingRequestId`
- `POST /pairing/requests`
- `POST /session-tokens/revoke`

### 4.2 Mobile

`PairingClientOptions` 增加：

```ts
devToken?: string | null;
```

所有 HTTP 请求使用统一 `buildHeaders()`：

- 总是带 `Content-Type: application/json` 的 POST 请求。
- devToken 存在时增加 `Authorization: Bearer <token>`。
- GET status 请求 devToken 存在时也增加 Authorization。

`TerminalScreen`：

```ts
new PairingClient({
  apiBaseUrl: runtimeConfig.apiBaseUrl,
  devToken: runtimeConfig.devToken
})
```

## 5. 测试方案

### Server

- token guard 开启时，`POST /pairing/requests` 无 token 返回 401。
- token guard 开启时，`GET /pairing/requests/:id` 无 token 返回 401。
- token guard 开启时，`POST /session-tokens/revoke` 无 token 返回 401。
- token guard 开启时，正确 token 可访问 pairing/revoke 接口。

### Mobile

- `PairingClient.requestPairing()` devToken 存在时发送 Authorization header。
- `PairingClient.getPairingRequest()` devToken 存在时发送 Authorization header。
- `PairingClient.revokeSessionToken()` devToken 存在时发送 Authorization header。

## 6. 验收标准

- 外网 dev token 开启后，HTTP pairing/revoke 不再匿名可访问。
- Mobile 配置 `EXPO_PUBLIC_REMOTE_DEV_TOKEN` 后，配对、轮询和 revoke 仍可用。
- 全量测试、typecheck、build 通过。

## 7. 风险与后续

- dev token 仍是开发期边界，不是正式账号系统。
- query token 可能进入日志；正式生产要改为登录态和短期 API token。
- 还没有 rate limit，配对码接口仍需要限流。
