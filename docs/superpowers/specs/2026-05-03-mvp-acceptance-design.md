# MVP Acceptance Checklist Design

## 1. 目标

本设计用于 Task 17：把 iOS + macOS installable MVP 的发布前验收固化为一份可执行清单。清单要让测试人员按固定顺序验证：安装、绑定、授权、终端命令、长命令中断、前后台恢复、Agent 身份持久化、server 重启持久化、能力关闭失败提示、广告边界。

## 2. 范围

本任务交付：

- `docs/runbooks/mvp-acceptance.md`
- 验收前置条件。
- 每个验收项的步骤、命令、预期结果、记录字段。
- 阻塞项和不可标记完成的条件。
- README 不做大改，当前 Product Documents 已有主计划入口。

本任务不交付：

- 自动化 E2E 测试框架。
- TestFlight 构建上传。
- 真实云端 smoke test 执行。
- App Store 审核材料。

## 3. 验收结构

清单按风险排序，而不是按代码模块排序：

1. 安装与首次绑定。
2. 未授权访问隔离。
3. 基础终端命令。
4. 长运行命令和 `Ctrl+C`。
5. iOS 前后台切换和重连。
6. Agent 重启后身份保持。
7. Server 重启后绑定不丢失。
8. Agent 关闭 terminal capability 后 Mobile 失败提示。
9. 会话页广告边界。
10. 结果汇总和发布判定。

## 4. 运行模式

清单同时支持两种环境：

- Local/LAN：开发机 server + macOS Agent + iOS simulator 或真机。
- Cloud：Render/VPS relay + home macOS Agent + iPhone cellular。

如果没有 TestFlight、真机或公网 relay，测试人员必须把对应项标记为 `blocked`，不能写成 `pass`。

## 5. 记录格式

每个验收项统一记录：

```text
Status: pass | fail | blocked
Environment:
Build:
Device:
Steps executed:
Actual result:
Evidence:
Notes:
```

## 6. 发布判定

MVP 发布前必须满足：

- 安装、绑定、授权隔离、基础命令、长命令中断、前后台恢复为 `pass`。
- Server 重启持久化在云端模式下为 `pass`，如果仍使用本地内存/JSON store，需要明确限定为开发版。
- 广告不能出现在终端会话页。
- 任何 `fail` 都阻止发布。
- 任何涉及真实用户远控路径的 `blocked` 都阻止 TestFlight 外部测试。

## 7. 已知风险

- 当前 Task 16 的真实云端 smoke test 尚未执行。
- Server runtime 尚未接入 PostgreSQL/Redis 配置，云端只能按单实例 relay 验收。
- 真机 TestFlight 验收依赖 Apple Developer、签名、构建号和设备权限。
