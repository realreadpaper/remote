# Mobile Forget Device 实现方案

## 1. 背景

Mobile 现在会把配对 token 保存到 SecureStore，并在 App 启动时恢复。这个能力让用户不必每次重新配对，但也带来一个缺口：用户无法主动清除本机绑定。

当用户换 Mac、Server 重置、token 失效、或者想重新配对时，需要一个简单可靠的 “Forget device” 操作。

## 2. 目标

- Mobile 在已恢复或新批准配对后，显示当前 paired device 状态。
- Mobile 提供 `Forget` 按钮。
- 用户点击 `Forget` 后：
  - 清除 SecureStore 中保存的 token。
  - 清除组件内存里的 `sessionToken`。
  - 如果当前有连接，关闭当前 `SessionClient`。
  - UI 回到可重新输入配对码的状态。
- 不改变现有配对、连接、终端输入协议。

## 3. 非目标

- 不做多设备列表。
- 不做确认弹窗。
- 不做 Server revoke。
- 不做账号退出。

## 4. 技术设计

`TerminalScreen` 已经有：

- `sessionToken`
- `pairingStatus`
- `pairingTokenStorage`
- `closeCurrentClient()`

新增状态：

```ts
const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
```

恢复 token 或配对成功时设置 `pairedDeviceId`。

新增 handler：

```ts
const handleForgetPairing = async () => {
  await clearPairingToken(pairingTokenStorage);
  closeCurrentClient();
  setSessionToken(null);
  setPairedDeviceId(null);
  setPairingStatus("not paired");
  terminalState.setConnected(false);
  refreshSnapshot();
};
```

UI：

- pairing panel 中有 `pairedDeviceId` 时显示一行 `Paired <deviceId>`。
- 同一行右侧显示 `Forget` 按钮。
- 保持当前紧凑运维工具风格，不新增页面。

## 5. 测试方案

- `pairingTokenStore.test.ts` 已覆盖 `clearPairingToken()` 删除存储 key。
- 本轮补充 `clearPairingToken()` 多次调用仍稳定的测试。
- `TerminalScreen` 当前无组件测试 harness，本轮通过 TypeScript typecheck 覆盖 UI 接入。

## 6. 验收标准

- Mobile 测试通过。
- Mobile typecheck 通过。
- 点击 Forget 后不再携带旧 `sessionToken`。
- Forget 后用户可以重新输入配对码配对。

## 7. 风险与后续

- Forget 只清除本机 token，不会通知 Server revoke。
- Server 端 token 在过期前仍存在；后续 revoke API 解决。
- 多设备列表阶段需要把单个 `pairedDeviceId` 扩展为数组。
