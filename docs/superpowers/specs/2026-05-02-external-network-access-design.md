# 外网接入与家庭网络地址转换设计

## 1. 目标

本设计说明局域网远控已经可用后，如何让手机在外网连接家里的 Mac。核心目标是：用户不需要理解路由器、防火墙、公网 IP，也能从 4G/5G、公司 Wi-Fi、酒店网络等外部网络打开手机 App，连接家里的 Mac Agent，并进入远程终端。

结论：

- 产品默认方案：Mac Agent 主动连接云端，手机也主动连接云端，云端中转终端会话。
- 不默认要求用户把家里地址暴露成公网地址。
- 家庭公网地址、DDNS、端口映射只作为高级模式或自托管模式。
- 后续大流量能力再增加 P2P 优先、Relay 兜底。

## 2. 第一性原理

家里的 Mac 通常在路由器后面，Mac 只有内网地址，例如：

```text
192.168.1.23
10.0.0.8
```

这些地址不能被外网手机直接访问。外网手机只能访问公网可路由地址，例如：

```text
家里宽带公网 IP
云服务器公网 IP
公网域名 api.example.com
```

要让外网手机连到家里 Mac，本质上有三类方法：

1. 让家里的网络拥有可访问的公网入口。
2. 让 Mac 主动向公网服务器建立长连接。
3. 让手机和 Mac 通过 NAT 穿透尝试直连，失败后走中继。

对普通用户产品来说，第二类最稳：Mac 主动连云端，不需要用户配置路由器。

## 3. 家里地址如何变成外网地址

### 3.1 内网地址

Mac 在家里 Wi-Fi 下拿到的地址通常是内网地址：

```bash
ipconfig getifaddr en0
```

示例：

```text
192.168.1.23
```

这个地址只在家里局域网可用。手机离开家后，不能访问 `192.168.1.23`。

### 3.2 家庭公网 IP

家里的路由器会从运营商拿到一个 WAN 地址。这个地址可能是真公网 IP，也可能是运营商 CGNAT 内网地址。

判断方式：

1. 登录路由器后台，查看 WAN IP。
2. 在家里网络访问公网 IP 查询服务，查看对外 IP。
3. 比较两个值。

如果路由器 WAN IP 和公网查询 IP 一致，通常说明家里有公网 IP。
如果不一致，通常说明家里在 CGNAT 后面，不能直接端口映射。

常见 CGNAT 地址段包括：

```text
100.64.0.0/10
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
```

如果路由器 WAN IP 落在这些网段，外网手机通常无法直接访问家里路由器。

### 3.3 动态公网 IP 与 DDNS

家庭宽带公网 IP 往往会变化。DDNS 的作用是把动态 IP 绑定到稳定域名：

```text
myhome.example.com -> 当前家庭公网 IP
```

流程：

1. 路由器或 Mac 定时检测当前公网 IP。
2. IP 变化后调用 DDNS 服务更新域名解析。
3. 外网用户访问域名，而不是记 IP。

DDNS 只能解决“公网 IP 会变”的问题，不能解决“没有公网 IP”的问题。

### 3.4 端口映射

如果家里有公网 IP，可以在路由器上做端口映射：

```text
公网:443 或 公网:8787 -> Mac:8787
```

外网手机访问：

```text
wss://myhome.example.com:8787/ws/mobile
```

路由器把请求转发给家里 Mac。

不建议产品默认使用端口映射，原因：

- 用户配置复杂。
- 暴露家庭网络入口。
- 证书、TLS、端口冲突麻烦。
- 公司/校园/运营商网络可能限制入站。
- CGNAT 下不可用。

### 3.5 IPv6

如果家庭宽带提供 IPv6，Mac 可能有公网可达 IPv6 地址。理论上手机可以通过 IPv6 直接访问 Mac。

问题：

- 不是所有移动网络都稳定支持 IPv6。
- 家庭路由器防火墙仍需放行。
- iOS/Android、DNS、证书配置复杂。
- 用户排查成本高。

因此 IPv6 直连也不作为默认产品路径，只作为高级直连能力。

## 4. 推荐产品方案：云端反向连接

### 4.1 核心思想

不要把家里地址变成外网地址。让 Mac Agent 主动连到云端：

```text
macOS Agent -> wss://api.example.com/ws/agent
iPhone App  -> wss://api.example.com/ws/mobile
```

云端拥有固定公网域名和 HTTPS/WSS 证书。手机和 Mac 都只需要能访问互联网，不需要任何入站端口。

### 4.2 数据流

```text
iPhone App
  |
  | WSS terminal.input
  v
Cloud Relay
  |
  | WSS terminal.input
  v
macOS Agent
  |
  | PTY stdin/stdout
  v
User Shell
```

输出路径反向返回：

```text
PTY output -> Agent -> Cloud Relay -> iPhone App
```

### 4.3 为什么适合终端优先产品

终端流量很小，云中转成本低。即使每个用户长期连接，终端输入输出通常也是 KB/s 级别，不像桌面视频会产生 Mbps 级别流量。

因此 MVP 可以先用云中转把外网终端做稳，再考虑 P2P 和 Relay 成本优化。

## 5. 外网 MVP 架构

### 5.1 组件

- `Cloud API`：登录、设备列表、绑定关系、会话创建。
- `Cloud Relay`：WebSocket 长连接和终端消息转发。
- `Presence Store`：记录 Agent 在线状态。
- `Session Hub`：记录 `sessionId -> mobile socket -> agent socket`。
- `macOS Agent`：主动连接云端，持有 PTY。
- `Mobile App`：主动连接云端，发送命令和接收输出。

### 5.2 部署

最小部署：

```text
VPS / Cloud VM
  - Caddy 或 Nginx: TLS 终止
  - Node/Fastify: API + WebSocket
  - PostgreSQL: 用户、设备、绑定、会话元数据
  - Redis: 在线状态、短期会话、配对码
```

早期开发可简化：

- 先用单台 VPS。
- 先用内存在线状态。
- 先用 SQLite 或 PostgreSQL。
- 先只开放 `/health`、`/devices`、`/ws/agent`、`/ws/mobile`。

### 5.3 域名

建议使用：

```text
api.example.com
```

移动端：

```bash
EXPO_PUBLIC_REMOTE_WS_URL=wss://api.example.com/ws/mobile
```

Agent：

```bash
REMOTE_SERVER_URL=wss://api.example.com/ws/agent
```

## 6. 高级模式：家庭公网地址直连

家庭公网直连适合技术用户、自托管用户和内测排障，不适合默认大众路径。

### 6.1 直连条件

必须同时满足：

- 家里有真公网 IPv4 或稳定可达 IPv6。
- 路由器能配置端口映射或防火墙放行。
- 家里有域名或 DDNS。
- Mac 上运行的服务支持 TLS。
- 用户理解暴露端口的风险。

### 6.2 直连流程

```text
iPhone App
  |
  | wss://myhome.example.com:8787/ws/mobile
  v
Home Router
  |
  | Port Forward
  v
Mac Server
  |
  v
macOS Agent / local relay
```

### 6.3 配置步骤

1. 确认家里有公网 IP。
2. 配置 DDNS，例如 `myhome.example.com`。
3. 在路由器上配置端口映射。
4. 在 Mac 上启动 server。
5. 配置 TLS 证书。
6. 手机 App 使用 `wss://myhome.example.com/ws/mobile`。

### 6.4 风险

- 端口暴露后会被公网扫描。
- 如果鉴权有漏洞，远控入口会直接暴露。
- 家庭路由器端口映射容易配置错。
- 证书过期会导致连接失败。
- 宽带 IP 变化会导致 DDNS 同步延迟。

结论：这个模式只能作为高级功能，必须在 UI 中标注风险。

## 7. 折中方案：反向隧道

反向隧道可以把家里 Mac 的本地服务挂到公网，不需要路由器端口映射。

常见方式：

- 自建 `frp`。
- 自建 `rathole`。
- `cloudflared tunnel`。
- `ngrok`。

工作方式：

```text
Mac -> Tunnel Server -> Public URL
iPhone -> Public URL -> Tunnel Server -> Mac
```

这类方案适合开发测试和自托管用户，但不适合作为正式产品默认依赖，因为：

- 第三方免费额度不稳定。
- 域名和连接策略受第三方控制。
- 延迟和可用性不可控。
- 商业发布需要处理服务条款和成本。

产品内部可以借鉴反向隧道思想：Agent 主动连到我们自己的 Cloud Relay。

## 8. P2P 与 Relay 演进

当终端、文件、桌面都接入后，云中转成本会上升。此时增加 P2P：

1. Mobile 和 Agent 都连接 Cloud Signaling。
2. 双方交换候选地址。
3. 优先尝试 P2P。
4. P2P 成功后，终端/文件/桌面数据直连。
5. P2P 失败后走 Cloud Relay。

推荐顺序：

- MVP：终端云中转。
- V1：终端仍可中转，文件传输支持限速中转。
- V2：桌面和大文件优先 P2P，Relay 兜底。

## 9. 安全要求

外网接入必须先补安全边界：

- WebSocket 必须从 `ws://` 升级到 `wss://`。
- Mobile 和 Agent 握手都要带认证 token。
- 设备连接必须经过绑定关系校验。
- Agent 本地必须有终端能力开关。
- Server 不保存终端输入输出。
- 敏感日志不得记录命令内容。
- 公网 server 必须限流。
- 配对码短期有效、一次性使用。
- 会话 token 短期有效。

如果启用家庭公网直连，还必须：

- 强制 TLS。
- 禁止匿名连接。
- 默认不暴露 `0.0.0.0` 管理接口。
- 显示公网暴露风险提示。

## 10. 推荐落地路径

### 阶段 1：云中转外网开发版

目标：iPhone 使用蜂窝网络连接家里 Mac。

实现：

- 部署当前 `apps/server` 到一台 VPS。
- 配置域名和 TLS。
- Agent 连接 `wss://api.example.com/ws/agent`。
- Mobile 连接 `wss://api.example.com/ws/mobile`。
- 用固定开发 token 做最小鉴权。

验收：

- 手机关闭 Wi-Fi，使用 4G/5G。
- Mac 在家里 Wi-Fi。
- 手机执行 `pwd` 能返回 Mac 输出。

### 阶段 2：账号、绑定、会话 token

目标：公网可用但不裸奔。

实现：

- 登录。
- 设备绑定。
- Agent 本地确认。
- 短期 session token。
- 在线状态。

验收：

- 未绑定手机无法连接。
- token 过期后无法继续打开新会话。
- Agent 可撤销绑定。

### 阶段 3：P2P 和 Relay

目标：降低文件和桌面成本。

实现：

- 信令服务。
- ICE 候选交换。
- TURN/Relay 兜底。
- 通道优先级：Terminal > Control > File > Desktop。

验收：

- 同网络优先直连。
- 异网络失败时自动 Relay。
- Terminal 在弱网下仍优先可用。

## 11. 产品默认策略

面向普通用户：

- 默认只显示“云端安全连接”。
- 不要求用户知道公网 IP。
- 不要求用户登录路由器。
- 不要求用户配置 DDNS。
- 不要求用户开放端口。

面向高级用户：

- 可在设置中提供“自托管/家庭直连”。
- 明确标注需要公网 IP、DDNS、端口映射和 TLS。
- 默认关闭。

这样既能保证普通用户可用，又保留技术用户低成本自托管的空间。

## 12. 连接模式产品设计

### 12.1 默认模式：云端安全连接

普通用户只看到一个连接按钮：

```text
连接
```

用户不需要选择局域网、外网、DDNS、端口映射或 IPv6。App 内部根据设备在线状态和 server 返回的路由策略连接。

默认文案：

```text
云端安全连接
```

解释文案：

```text
手机和电脑都通过加密连接接入云端，不需要开放家庭路由器端口。
```

默认模式的实际链路：

```text
Mobile App -> Cloud Relay -> Agent
```

### 12.2 自动模式：局域网优先，云中转兜底

当手机和 Mac 在同一局域网时，后续可以优先使用局域网连接，失败后自动切到云中转。

推荐策略：

1. App 打开设备详情。
2. Cloud 返回设备的最近局域网地址摘要，例如 `192.168.1.23`，只用于同网探测。
3. Mobile 在 300-800ms 内尝试局域网连接。
4. 局域网失败立即走云中转。
5. UI 不让用户等待长时间探测。

MVP 阶段可以先不做局域网自动探测，直接使用云中转。原因是终端流量小，先保证外网稳定更重要。

### 12.3 高级模式：家庭直连

高级设置中提供：

```text
自托管 / 家庭直连
```

进入后显示风险提示：

```text
该模式需要公网 IP、DDNS、端口映射和 TLS。配置错误可能暴露家庭网络入口。仅建议了解网络配置的用户使用。
```

高级模式字段：

- `serverUrl`：例如 `wss://myhome.example.com/ws/mobile`。
- `deviceId`：目标设备 ID。
- `tlsRequired`：必须为 `true`。
- `allowInsecureLocal`：仅开发模式允许。

高级模式默认隐藏在设置页，不出现在首次连接流程。

### 12.4 高级模式：第三方反向隧道

第三方反向隧道不作为产品默认能力，但可以用于开发者排障。

UI 文案：

```text
第三方隧道由外部服务提供，稳定性、隐私和费用取决于服务商。正式远控建议使用云端安全连接。
```

配置字段与家庭直连相同，本质都是用户提供一个自定义 `serverUrl`。

## 13. 默认云中转的详细技术架构

### 13.1 连接分层

云端服务分为三层：

```text
API Layer
  - 登录
  - 设备列表
  - 绑定
  - 会话创建

Relay Layer
  - /ws/agent
  - /ws/mobile
  - terminal.input/output 转发

State Layer
  - PostgreSQL: 用户、设备、绑定、会话元数据
  - Redis: 在线状态、短期 token、socket 路由
```

早期可以把 API 和 Relay 放在同一个 Fastify 进程里。等连接数上来后，再拆成独立服务。

### 13.2 Agent 长连接

Agent 启动后主动建立：

```text
wss://api.example.com/ws/agent
```

握手参数：

- `deviceId`
- `agentVersion`
- `platform`
- `capabilities`
- `deviceToken`

Server 校验通过后记录：

```text
deviceId -> agentSocketId
deviceId -> online
deviceId -> lastSeenAt
deviceId -> capabilities
```

Agent 需要心跳：

```text
agent.ping
agent.pong
```

如果连续多次心跳失败，server 标记设备离线。

### 13.3 Mobile 会话连接

Mobile 登录后先走 HTTPS 创建会话：

```text
POST /sessions
```

请求：

```json
{
  "deviceId": "mac-dev",
  "capability": "terminal"
}
```

返回：

```json
{
  "sessionId": "session_123",
  "sessionToken": "short_lived_token",
  "route": {
    "mode": "cloud-relay",
    "wsUrl": "wss://api.example.com/ws/mobile"
  }
}
```

Mobile 再连接：

```text
wss://api.example.com/ws/mobile
```

并发送：

```json
{
  "type": "session.open",
  "sessionId": "session_123",
  "sessionToken": "short_lived_token",
  "deviceId": "mac-dev"
}
```

Server 校验 `sessionToken` 后，才把打开请求转给 Agent。

### 13.4 终端消息路由

路由表：

```text
sessionId -> deviceId
sessionId -> mobileSocketId
deviceId  -> agentSocketId
```

输入方向：

```text
Mobile terminal.input -> Relay -> Agent terminal.input -> PTY stdin
```

输出方向：

```text
PTY stdout/stderr -> Agent terminal.output -> Relay -> Mobile terminal.output
```

Server 不解析命令内容，只校验消息结构、会话归属和 socket 归属。

### 13.5 断线行为

Mobile 断开：

- Server 标记 mobile socket disconnected。
- Agent 保留 PTY 一段时间，例如 5 分钟。
- Mobile 重连后请求 `terminal.snapshot`。

Agent 断开：

- Server 标记设备离线。
- Server 通知相关 Mobile：`device.offline` 或 `session.error`。
- Mobile 展示“电脑离线，等待重连”。

Server 重启：

- Agent 自动重连。
- Mobile 自动重连。
- 已有 PTY 是否恢复取决于 Agent 是否仍存活。

## 14. “家里地址变外网地址”的产品解释

用户可能会问：“我家里 Mac 的地址是 `192.168.1.23`，为什么外面不能连？”

产品解释应简化为：

```text
家里的电脑地址只在家里 Wi-Fi 内有效。离开家后，手机无法直接访问这个地址。默认连接方式会让电脑主动连接云端，手机再通过云端找到电脑，不需要设置路由器。
```

高级解释：

```text
如果你有公网 IP，可以通过 DDNS 和端口映射让外网访问家里设备。但这会暴露家庭网络入口，需要自行配置 TLS 和安全策略。普通用户建议使用云端安全连接。
```

这段解释可以放在：

- 连接失败详情页。
- 高级网络设置页。
- 帮助文档。

不要在首次连接流程展示这些复杂概念。

## 15. 成本控制设计

### 15.1 终端免费策略

终端是核心功能，默认免费。原因：

- 流量低。
- 成本可控。
- 是产品差异化核心。

限制策略：

- 单用户同时在线设备数限制。
- 单设备同时终端会话数限制。
- 单会话空闲超时。
- 输出缓冲区大小限制。
- 高频输入限流，防止滥用。

### 15.2 文件和桌面成本策略

文件和桌面流量更高，后续可以限制：

- 单日中转流量。
- 文件上传下载速度。
- 桌面帧率和码率。
- 后台传输时长。

广告策略：

- 会话内不展示广告。
- 设备列表、连接前、断开后可展示广告。
- 激励广告只用于高成本资源，例如更高 Relay 流量、更长桌面会话。

### 15.3 Relay 资源隔离

Relay 服务需要隔离不同类型流量：

```text
terminal: 高优先级，低带宽
control: 高优先级，低带宽
file: 中优先级，可限速
desktop: 低优先级，高带宽，可降级
```

当系统压力大时：

1. 保终端输入输出。
2. 保控制心跳。
3. 限制文件传输。
4. 降低桌面码率或断开桌面。

## 16. 安全与隐私产品边界

默认云中转并不意味着云端可以随意读取用户内容。安全路线分两阶段。

### 16.1 外网 MVP 安全

MVP 必须做到：

- TLS/WSS。
- 登录鉴权。
- 设备绑定。
- Agent 本地确认。
- 短期 session token。
- Server 不落库命令内容。
- 日志脱敏。
- Agent 本地可关闭能力。

### 16.2 后续端到端加密

后续会话内容端到端加密：

```text
Mobile encrypt -> Cloud Relay forwards ciphertext -> Agent decrypt
Agent encrypt -> Cloud Relay forwards ciphertext -> Mobile decrypt
```

云端仍能看到：

- 用户 ID。
- 设备 ID。
- 会话开始/结束。
- 流量大小。
- 连接状态。

云端不能看到：

- 命令内容。
- 终端输出。
- 文件内容。
- 屏幕内容。

## 17. 连接失败诊断

外网连接失败必须给用户可行动的原因。

### 17.1 云端安全连接失败

常见原因：

- 手机无网络。
- 云服务不可达。
- 账号登录过期。
- 设备离线。
- Agent 未启动。
- 设备未绑定。
- 会话 token 过期。

用户文案：

```text
电脑离线。请确认 Mac 已开机，并且 Agent 正在运行。
```

```text
登录已过期，请重新登录。
```

```text
无法连接云服务，请检查手机网络。
```

### 17.2 家庭直连失败

常见原因：

- DDNS 没有更新。
- 端口映射错误。
- 没有公网 IP。
- TLS 证书无效。
- 路由器防火墙阻止。

用户文案：

```text
家庭直连不可达。请检查公网 IP、DDNS、端口映射和 TLS 证书。普通用户建议切换回云端安全连接。
```

### 17.3 诊断信息

App 的高级诊断页可以展示：

- 当前连接模式。
- 当前 server URL。
- 最近错误码。
- 设备在线状态。
- 最近 Agent 心跳时间。
- 是否使用云中转。
- 是否尝试过家庭直连。

不要展示命令内容。

## 18. 高级设置 IA

设置结构：

```text
设置
  网络
    连接模式
      自动，推荐
      云端安全连接
      家庭直连，高级
      自定义隧道，高级
    当前服务器
    连接诊断
  安全
    已绑定设备
    撤销绑定
    终端能力开关
  关于
    隐私说明
    网络连接说明
```

默认连接模式：

```text
自动，推荐
```

自动模式在 MVP 中等价于云端安全连接；后续加入局域网探测和 P2P 后，自动模式再变成智能路由。

## 19. 开发与生产环境

### 19.1 开发环境

局域网开发：

```bash
HOST=0.0.0.0 pnpm dev:server
REMOTE_SERVER_URL=ws://127.0.0.1:8787/ws/agent pnpm dev:agent
EXPO_PUBLIC_REMOTE_WS_URL=ws://<mac-lan-ip>:8787/ws/mobile pnpm dev:mobile
```

外网开发：

```bash
REMOTE_SERVER_URL=wss://dev-api.example.com/ws/agent pnpm dev:agent
EXPO_PUBLIC_REMOTE_WS_URL=wss://dev-api.example.com/ws/mobile pnpm dev:mobile
```

### 19.2 生产环境

生产环境必须：

- 禁止 `ws://`。
- 禁止匿名 WebSocket。
- 禁止固定开发 token。
- 强制设备绑定。
- 强制 TLS。
- 开启限流。
- 开启结构化日志。
- 开启健康检查。

## 20. 决策表

| 方案 | 默认用户可用性 | 安全风险 | 成本 | 适用场景 | 产品定位 |
| --- | --- | --- | --- | --- | --- |
| 云端安全连接 | 高 | 中，可控 | 中 | 普通用户、MVP | 默认 |
| 家庭公网直连 | 低 | 高 | 低 | 技术用户、自托管 | 高级 |
| DDNS + 端口映射 | 低 | 高 | 低 | 有公网 IP 用户 | 高级 |
| IPv6 直连 | 中低 | 中高 | 低 | IPv6 环境稳定用户 | 高级 |
| 第三方反向隧道 | 中 | 中高 | 不稳定 | 开发测试 | 高级/排障 |
| P2P + Relay | 中高 | 中 | 中低 | 文件/桌面降成本 | 后续演进 |

产品默认选择云端安全连接。高级模式不进入首次使用路径，只在用户主动打开网络设置时出现。
