# iOS Home Connection List Design

## 目标

iOS 客户端启动后先进入连接首页，而不是直接进入终端页。首页展示已配对设备列表，用户选择一台设备后进入终端；没有设备时，引导新建连接。

## 产品流程

```text
HomeScreen
  -> NewConnectionScreen
      -> pairing approved
      -> HomeScreen
  -> TerminalScreen(selected device)
      -> Back
      -> HomeScreen
```

## 首页

首页展示：

- 标题：`Remote`
- 已配对设备列表：设备 ID、状态、过期时间。
- 主要操作：`New Connection`。
- 空状态：说明当前没有已保存连接，并提供新建连接按钮。

第一阶段状态来源以本地 SecureStore 为准。Server 的 `/devices` 和 `/pairing/bindings` 已存在，但本阶段不强依赖云端列表，避免首页被网络状态阻塞。

## 新建连接

新建连接页负责输入配对码、提交配对请求、等待 Agent 审批。审批成功后保存设备 token，并回到首页。

## 终端页

终端页只负责选中的 `deviceId + sessionToken`：

- 不再承担首页职责。
- 不再使用默认 `runtimeConfig.deviceId` 作为唯一连接目标。
- 顶部提供返回首页按钮。
- 已选设备的 token 用于 `session.open`。

## 范围

- 升级本地配对 token 存储为多设备列表，并兼容旧的单 token 数据。
- 新增首页和新建连接视图。
- 保留现有终端会话、快捷键、重连逻辑。
- 不新增账号系统、不新增远程桌面、不改 Server 协议。

## 验收

- App 启动后默认显示首页。
- 已有配对设备时，首页显示列表。
- 点击设备进入终端页，并连接该设备。
- 新建连接成功后，设备回到首页列表。
- 忘记设备后回到首页，列表移除该设备。
- 移动端测试、类型检查、全仓测试和构建通过。
