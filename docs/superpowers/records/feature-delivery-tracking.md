# 功能交付追踪规则

## 1. 目的

从现在开始，每个功能都必须留下可追踪记录，避免后续无法判断“为什么这么做、做到哪里、验证过什么、还剩什么”。该规则适用于 iOS 客户端、服务端、macOS Agent、协议包、部署脚本和产品文档。

## 2. 强制流程

每个功能按以下顺序推进：

1. **实现前方案**
   - 写入 `docs/superpowers/specs/`。
   - 说明目标、范围、非目标、用户流程、技术原理、接口变化、数据变化、安全风险、测试方案、验收标准。
   - 没有方案，不写业务代码。

2. **实现计划**
   - 写入 `docs/superpowers/plans/`。
   - 拆成可执行任务。
   - 每个任务必须说明涉及文件、测试命令、提交点。

3. **代码实现**
   - 按计划执行。
   - 需要测试先行，至少覆盖关键行为。
   - 每个小功能单独提交，提交信息明确。

4. **完成记录**
   - 写入 `docs/superpowers/records/feature-log.md`。
   - 记录提交 SHA、变更文件、验证命令、结果、已知风险、后续事项。

5. **回归验证**
   - 至少运行相关 package 测试。
   - 影响协议、server、mobile、agent 任意两个以上模块时，运行：

     ```bash
     pnpm test
     pnpm typecheck
     pnpm build
     ```

## 3. 实现前方案模板

```markdown
# <功能名> 实现方案

## 1. 背景

说明为什么要做。

## 2. 目标

- 目标 1
- 目标 2

## 3. 非目标

- 本阶段不做什么。

## 4. 用户流程

1. 用户做什么。
2. 系统响应什么。

## 5. 技术设计

### 5.1 组件变化

### 5.2 协议变化

### 5.3 数据变化

### 5.4 错误处理

### 5.5 安全边界

## 6. 测试方案

## 7. 验收标准

## 8. 风险与后续
```

## 4. 完成记录模板

```markdown
## <日期> <功能名>

**状态：** completed / partial / blocked

**提交：**
- `<sha>` `<commit message>`

**实现内容：**
- 内容 1
- 内容 2

**涉及文件：**
- `path/to/file`

**验证：**
- `pnpm test`: pass / fail / not run
- `pnpm typecheck`: pass / fail / not run
- `pnpm build`: pass / fail / not run
- 端到端验证：说明命令和输出

**已知风险：**
- 风险 1

**后续：**
- 后续 1
```

## 5. 状态定义

- `planned`：方案已写，未实现。
- `in_progress`：正在实现。
- `completed`：代码、测试、文档、记录都完成。
- `partial`：部分完成，有明确剩余项。
- `blocked`：遇到外部阻塞。

## 6. 当前优先级队列

1. 服务端最小外网安全边界：server config、dev token、WSS 部署准备。
2. Agent/Mobile 云端 token 配置和 URL 脱敏。
3. 设备绑定和短期 session token。
4. iOS TestFlight 配置。
5. 会话断线恢复和输出缓冲限制。
6. ANSI 终端渲染。
