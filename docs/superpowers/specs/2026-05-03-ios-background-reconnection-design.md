# iOS Background Reconnection Design

## 背景

Mobile 已支持 `SessionClient` 在 WebSocket close/error 后保留 `sessionId`，并在下一次 `connect()` 时发送 `resumeSessionId`。但 UI 层 `TerminalScreen` 目前在 `onDisconnect` 中调用 `closeCurrentClient()`，而 `SessionClient.close()` 会清空 session id，导致异常断线后无法恢复旧 session。

Task 13 要把 iOS 前后台切换和断线恢复行为固化到客户端：后台时暂停输入，回前台检查连接状态，socket 断开后自动重连一次，失败后展示手动重连按钮。

## 目标

- App 进入后台时暂停主动输入，保持 `SessionClient` 和 `sessionId`。
- App 回前台时检查当前 client/socket 状态。
- socket 异常断开后自动重连一次。
- 自动重连失败后展示手动重连按钮。
- 重连成功后沿用已有 `SessionClient`，由 `session.opened` 触发 `terminal.snapshot.request`。
- 用户主动 forget pairing 或组件卸载时仍调用 `close()` 清理 session。

## 非目标

- 不实现后台长期保活。
- 不实现 iOS push 唤醒。
- 不实现多次指数退避重连。
- 不改变 Server/Agent recovery 协议。
- 不新增完整 React Native UI 测试框架。

## 设计

### SessionClient

增加轻量状态 API：

```ts
isSocketOpen(): boolean
hasRetainedSession(): boolean
```

语义：

- `isSocketOpen()`：当前 socket 存在且 readyState 是 OPEN。
- `hasRetainedSession()`：当前 client 持有 session id，可用于下一次 `connect()` 发送 `resumeSessionId`。

已有行为保留：

- socket close/error 不清空 session id。
- explicit `close()` 清空 session id。
- `connect()` 如果已有 session id，发送 `resumeSessionId`。
- `session.opened` 后发送 `terminal.snapshot.request`。

### TerminalScreen

新增状态：

```ts
const [appActive, setAppActive] = useState(true);
const [manualReconnectVisible, setManualReconnectVisible] = useState(false);
const autoReconnectAttemptedRef = useRef(false);
```

新增行为：

- 监听 React Native `AppState`。
- App 进入 background/inactive：
  - `appActive = false`。
  - 不关闭 client。
  - 输入和快捷键按钮只提示 paused。
- App 回到 active：
  - `appActive = true`。
  - 如果已有 client、未 connected、未 connecting、且 client 有 retained session，则调用 `client.connect()`。
- socket disconnect：
  - 不调用 `client.close()`。
  - 不清空 `clientRef`。
  - 第一次断线自动调用同一个 client 的 `connect()`。
  - 第二次失败后显示手动重连按钮。
- 手动重连按钮：
  - 调用同一个 client 的 `connect()`。
  - 保留 session id，触发 resume。

### UI

保持现有终端优先界面，只在连接错误附近加一个简洁按钮：

```text
Reconnect
```

不增加复杂说明，不影响会话内无广告要求。

## 测试策略

### SessionClient tests

- `isSocketOpen()` 在 socket open/close 后返回正确状态。
- `hasRetainedSession()` 在 opened 后为 true，socket close 后仍为 true，explicit close 后为 false。
- reconnect 后仍发送 `resumeSessionId`。

### Terminal behavior tests

当前没有 React Native test renderer。为避免引入大测试栈，本任务通过 `SessionClient` 单元测试覆盖关键恢复机制；UI 层变更通过 TypeScript build 和手动流程验证记录。

手动/模拟流程：

1. 连接成功。
2. 模拟 socket close。
3. UI 自动调用同一 `SessionClient.connect()` 一次。
4. Server 返回 `session.opened` 后，Mobile 发送 `terminal.snapshot.request`。
5. 再次失败后显示 Reconnect。

## 验收标准

- 异常断线后不调用 `SessionClient.close()`，session id 保留。
- 第一次异常断线自动重连一次。
- 手动 Reconnect 使用 retained session。
- App 后台时不发送输入。
- App 回前台时恢复 retained session。
- `pnpm --filter @remote/mobile test`、`pnpm typecheck`、`pnpm build` 通过。

## 已知风险

- iOS 后台 WebSocket 是否被系统挂起取决于系统策略，App 不能保证后台持续在线。
- 自动重连只做一次，避免弱网下无限重连。
- UI 层没有完整 RN 组件测试，后续可引入 `@testing-library/react-native`。

## 自检

- Placeholder scan: 没有 TBD/TODO。
- Scope check: 聚焦 iOS foreground/background 和 reconnect，不改协议。
- Consistency: 使用现有 `resumeSessionId` 和 `terminal.snapshot.request` 机制。
