# Terminal-First Remote Control MVP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建第一条可运行垂直切片：iOS / Android App 通过云端连接 macOS Agent，打开远程终端并执行命令。

**Architecture:** 采用 TypeScript monorepo 先验证终端优先核心体验：`packages/protocol` 定义通道消息，`apps/server` 提供账号外的开发期设备注册和 WebSocket 中继，`apps/agent` 在 macOS 上启动本机 shell，`apps/mobile` 使用 Expo React Native 呈现终端 UI。该计划先走云端中继，P2P、端到端加密、桌面采集和广告在后续计划中实现，但消息结构为这些能力保留通道边界。

**Tech Stack:** pnpm workspaces, TypeScript, Vitest, Fastify, WebSocket, zod, node-pty, Expo React Native.

---

## Scope Boundary

本计划只交付 MVP Foundation：

- 创建仓库结构。
- 建立共享协议包。
- 建立开发期云端 WebSocket 中继。
- 建立 macOS Agent CLI，能注册设备并启动 shell。
- 建立移动端终端页面，能连接设备、输入命令、查看输出。
- 建立测试、格式化和本地运行脚本。

本计划不实现：

- P2P 打洞。
- 端到端加密。
- 桌面屏幕采集与输入注入。
- 文件上传下载。
- 广告 SDK。
- Windows Agent。
- App Store / Google Play 发布。

这些能力分别进入独立计划，避免第一轮实现跨度过大。

## File Structure

```text
.
├── apps
│   ├── agent
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── agentClient.ts
│   │   │   ├── config.ts
│   │   │   ├── index.ts
│   │   │   └── terminalSession.ts
│   │   ├── tests
│   │   │   └── terminalSession.test.ts
│   │   └── tsconfig.json
│   ├── mobile
│   │   ├── App.tsx
│   │   ├── app.json
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── components
│   │   │   │   └── TerminalScreen.tsx
│   │   │   ├── protocol
│   │   │   │   └── sessionClient.ts
│   │   │   └── state
│   │   │       └── terminalStore.ts
│   │   ├── tests
│   │   │   └── terminalStore.test.ts
│   │   └── tsconfig.json
│   └── server
│       ├── package.json
│       ├── src
│       │   ├── deviceRegistry.ts
│       │   ├── index.ts
│       │   ├── sessionHub.ts
│       │   └── ws.ts
│       ├── tests
│       │   ├── deviceRegistry.test.ts
│       │   └── sessionHub.test.ts
│       └── tsconfig.json
├── package.json
├── packages
│   └── protocol
│       ├── package.json
│       ├── src
│       │   ├── channels.ts
│       │   ├── index.ts
│       │   └── messages.ts
│       ├── tests
│       │   └── messages.test.ts
│       └── tsconfig.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.config.ts
```

Responsibility boundaries:

- `packages/protocol`: 唯一消息协议来源，App、Server、Agent 都依赖它。
- `apps/server`: 开发期设备注册、会话配对、WebSocket 中继。
- `apps/agent`: macOS 终端宿主，连接 server，接收 terminal input，返回 output。
- `apps/mobile`: 终端优先 UI，连接 server，发送命令，展示输出。

## Task 1: Repository Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [x] **Step 1: Initialize git repository**

Run:

```bash
git init
```

Expected: repository initialized in `/Users/hejianglong/Desktop/code/remote`.

- [x] **Step 2: Create root package manifest**

Create `package.json`:

```json
{
  "name": "terminal-first-remote-control",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "pnpm -r --if-present build",
    "test": "pnpm -r --if-present test",
    "typecheck": "pnpm -r --if-present typecheck",
    "dev:server": "pnpm --filter @remote/server dev",
    "dev:agent": "pnpm --filter @remote/agent dev",
    "dev:mobile": "pnpm --filter @remote/mobile start"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [x] **Step 3: Create pnpm workspace config**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [x] **Step 4: Create shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [x] **Step 5: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.ts"],
    globals: false
  }
});
```

- [x] **Step 6: Create gitignore**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.expo/
.env
.DS_Store
.superpowers/
coverage/
```

- [x] **Step 7: Install dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile created and install exits with code 0.

- [x] **Step 8: Commit scaffold**

Run:

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold terminal-first remote workspace"
```

Expected: one commit with root workspace files.

## Task 2: Shared Protocol Package

**Files:**
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/channels.ts`
- Create: `packages/protocol/src/messages.ts`
- Create: `packages/protocol/src/index.ts`
- Test: `packages/protocol/tests/messages.test.ts`

- [x] **Step 1: Create package manifest**

Create `packages/protocol/package.json`:

```json
{
  "name": "@remote/protocol",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run packages/protocol/tests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

- [x] **Step 2: Create package TypeScript config**

Create `packages/protocol/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [x] **Step 3: Write failing protocol tests**

Create `packages/protocol/tests/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseClientMessage, parseServerMessage } from "../src/messages";

describe("protocol messages", () => {
  it("parses terminal input from mobile", () => {
    const message = parseClientMessage({
      type: "terminal.input",
      sessionId: "session-1",
      data: "pwd\n"
    });

    expect(message.type).toBe("terminal.input");
    expect(message.data).toBe("pwd\n");
  });

  it("rejects unknown client messages", () => {
    expect(() =>
      parseClientMessage({
        type: "unknown.message",
        sessionId: "session-1"
      })
    ).toThrow();
  });

  it("parses terminal output from agent", () => {
    const message = parseServerMessage({
      type: "terminal.output",
      sessionId: "session-1",
      stream: "stdout",
      data: "/Users/me\n"
    });

    expect(message.type).toBe("terminal.output");
    expect(message.stream).toBe("stdout");
  });
});
```

- [x] **Step 4: Run protocol tests and verify failure**

Run:

```bash
pnpm --filter @remote/protocol test
```

Expected: FAIL because `../src/messages` does not exist.

- [x] **Step 5: Implement channel names**

Create `packages/protocol/src/channels.ts`:

```ts
export const Channel = {
  Control: "control",
  Terminal: "terminal",
  File: "file",
  Desktop: "desktop"
} as const;

export type ChannelName = (typeof Channel)[keyof typeof Channel];
```

- [x] **Step 6: Implement message schemas**

Create `packages/protocol/src/messages.ts`:

```ts
import { z } from "zod";

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("device.register"),
    deviceId: z.string().min(1),
    deviceName: z.string().min(1),
    capabilities: z.array(z.enum(["terminal", "file", "desktop"]))
  }),
  z.object({
    type: z.literal("session.open"),
    deviceId: z.string().min(1)
  }),
  z.object({
    type: z.literal("terminal.input"),
    sessionId: z.string().min(1),
    data: z.string()
  }),
  z.object({
    type: z.literal("terminal.resize"),
    sessionId: z.string().min(1),
    cols: z.number().int().positive(),
    rows: z.number().int().positive()
  })
]);

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("device.registered"),
    deviceId: z.string().min(1)
  }),
  z.object({
    type: z.literal("session.opened"),
    sessionId: z.string().min(1),
    deviceId: z.string().min(1)
  }),
  z.object({
    type: z.literal("session.error"),
    sessionId: z.string().optional(),
    code: z.string().min(1),
    message: z.string().min(1)
  }),
  z.object({
    type: z.literal("terminal.output"),
    sessionId: z.string().min(1),
    stream: z.enum(["stdout", "stderr"]),
    data: z.string()
  }),
  z.object({
    type: z.literal("terminal.exit"),
    sessionId: z.string().min(1),
    exitCode: z.number().int().nullable()
  })
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(input: unknown): ClientMessage {
  return ClientMessageSchema.parse(input);
}

export function parseServerMessage(input: unknown): ServerMessage {
  return ServerMessageSchema.parse(input);
}

export function encodeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}
```

- [x] **Step 7: Export protocol API**

Create `packages/protocol/src/index.ts`:

```ts
export * from "./channels.js";
export * from "./messages.js";
```

- [x] **Step 8: Run protocol tests and typecheck**

Run:

```bash
pnpm --filter @remote/protocol test
pnpm --filter @remote/protocol typecheck
```

Expected: tests pass and typecheck exits with code 0.

- [x] **Step 9: Commit protocol package**

Run:

```bash
git add packages/protocol
git commit -m "feat: add shared remote session protocol"
```

Expected: one commit containing protocol package and tests.

## Task 3: Server Device Registry

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/deviceRegistry.ts`
- Test: `apps/server/tests/deviceRegistry.test.ts`

- [x] **Step 1: Create server package manifest**

Create `apps/server/package.json`:

```json
{
  "name": "@remote/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "vitest run apps/server/tests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fastify/websocket": "^11.0.1",
    "@remote/protocol": "workspace:*",
    "fastify": "^5.2.1",
    "nanoid": "^5.0.9",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.13"
  }
}
```

- [x] **Step 2: Create server TypeScript config**

Create `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [x] **Step 3: Write failing registry tests**

Create `apps/server/tests/deviceRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DeviceRegistry } from "../src/deviceRegistry";

describe("DeviceRegistry", () => {
  it("stores online device metadata", () => {
    const registry = new DeviceRegistry();
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    expect(registry.get("mac-1")).toEqual({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"],
      online: true
    });
  });

  it("marks devices offline", () => {
    const registry = new DeviceRegistry();
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    registry.markOffline("mac-1");

    expect(registry.get("mac-1")?.online).toBe(false);
  });
});
```

- [x] **Step 4: Run registry tests and verify failure**

Run:

```bash
pnpm --filter @remote/server test
```

Expected: FAIL because `../src/deviceRegistry` does not exist.

- [x] **Step 5: Implement device registry**

Create `apps/server/src/deviceRegistry.ts`:

```ts
export type DeviceCapability = "terminal" | "file" | "desktop";

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
  online: boolean;
}

export interface RegisterDeviceInput {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
}

export class DeviceRegistry {
  private readonly devices = new Map<string, RegisteredDevice>();

  register(input: RegisterDeviceInput): RegisteredDevice {
    const device: RegisteredDevice = {
      ...input,
      online: true
    };
    this.devices.set(input.deviceId, device);
    return device;
  }

  get(deviceId: string): RegisteredDevice | undefined {
    return this.devices.get(deviceId);
  }

  markOffline(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (!device) {
      return;
    }
    this.devices.set(deviceId, {
      ...device,
      online: false
    });
  }

  list(): RegisteredDevice[] {
    return [...this.devices.values()];
  }
}
```

- [x] **Step 6: Run registry tests**

Run:

```bash
pnpm --filter @remote/server test
pnpm --filter @remote/server typecheck
```

Expected: tests pass and typecheck exits with code 0.

- [x] **Step 7: Commit registry**

Run:

```bash
git add apps/server
git commit -m "feat: add in-memory device registry"
```

Expected: one commit containing server package and registry tests.

## Task 4: Server Session Hub

**Files:**
- Create: `apps/server/src/sessionHub.ts`
- Test: `apps/server/tests/sessionHub.test.ts`

- [x] **Step 1: Write failing session hub tests**

Create `apps/server/tests/sessionHub.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { SessionHub } from "../src/sessionHub";

describe("SessionHub", () => {
  it("opens a session for an online device", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);

    expect(session.deviceId).toBe("mac-1");
    expect(agentSend).toHaveBeenCalledWith({
      type: "session.opened",
      sessionId: session.sessionId,
      deviceId: "mac-1"
    });
  });

  it("routes terminal input to the agent", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromMobile({
      type: "terminal.input",
      sessionId: session.sessionId,
      data: "pwd\n"
    });

    expect(agentSend).toHaveBeenCalledWith({
      type: "terminal.input",
      sessionId: session.sessionId,
      data: "pwd\n"
    });
  });

  it("routes terminal output to the mobile client", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromAgent("mac-1", {
      type: "terminal.output",
      sessionId: session.sessionId,
      stream: "stdout",
      data: "ok\n"
    });

    expect(mobileSend).toHaveBeenCalledWith({
      type: "terminal.output",
      sessionId: session.sessionId,
      stream: "stdout",
      data: "ok\n"
    });
  });
});
```

- [x] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @remote/server test
```

Expected: FAIL because `../src/sessionHub` does not exist.

- [x] **Step 3: Implement session hub**

Create `apps/server/src/sessionHub.ts`:

```ts
import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage } from "@remote/protocol";

type SendJson = (message: ClientMessage | ServerMessage) => void;

export interface RemoteSession {
  sessionId: string;
  deviceId: string;
}

interface SessionRecord extends RemoteSession {
  mobileSend: SendJson;
}

export class SessionHub {
  private readonly agents = new Map<string, SendJson>();
  private readonly sessions = new Map<string, SessionRecord>();

  attachAgent(deviceId: string, send: SendJson): void {
    this.agents.set(deviceId, send);
  }

  detachAgent(deviceId: string): void {
    this.agents.delete(deviceId);
  }

  openSession(deviceId: string, mobileSend: SendJson): RemoteSession {
    const agentSend = this.agents.get(deviceId);
    if (!agentSend) {
      throw new Error(`Device ${deviceId} is not online`);
    }

    const session: SessionRecord = {
      sessionId: nanoid(),
      deviceId,
      mobileSend
    };
    this.sessions.set(session.sessionId, session);

    agentSend({
      type: "session.opened",
      sessionId: session.sessionId,
      deviceId
    });

    return {
      sessionId: session.sessionId,
      deviceId
    };
  }

  routeFromMobile(message: Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" }>): void {
    const session = this.sessions.get(message.sessionId);
    if (!session) {
      throw new Error(`Unknown session ${message.sessionId}`);
    }

    const agentSend = this.agents.get(session.deviceId);
    if (!agentSend) {
      throw new Error(`Device ${session.deviceId} is not online`);
    }

    agentSend(message);
  }

  routeFromAgent(deviceId: string, message: Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>): void {
    const session = this.sessions.get(message.sessionId);
    if (!session || session.deviceId !== deviceId) {
      throw new Error(`Unknown session ${message.sessionId} for device ${deviceId}`);
    }

    session.mobileSend(message);
  }
}
```

- [x] **Step 4: Run session hub tests**

Run:

```bash
pnpm --filter @remote/server test
pnpm --filter @remote/server typecheck
```

Expected: tests pass and typecheck exits with code 0.

- [x] **Step 5: Commit session hub**

Run:

```bash
git add apps/server/src/sessionHub.ts apps/server/tests/sessionHub.test.ts
git commit -m "feat: add terminal session routing hub"
```

Expected: one commit containing session routing.

## Task 5: Server WebSocket API

**Files:**
- Create: `apps/server/src/ws.ts`
- Create: `apps/server/src/index.ts`

- [x] **Step 1: Implement WebSocket routes**

Create `apps/server/src/ws.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { encodeMessage, parseClientMessage } from "@remote/protocol";
import { DeviceRegistry } from "./deviceRegistry";
import { SessionHub } from "./sessionHub";

function sendJson(socket: WebSocket, message: unknown): void {
  socket.send(JSON.stringify(message));
}

export function registerWsRoutes(app: FastifyInstance): void {
  const registry = new DeviceRegistry();
  const hub = new SessionHub();

  app.get("/health", async () => ({ ok: true }));

  app.get("/devices", async () => ({
    devices: registry.list()
  }));

  app.get("/ws/agent", { websocket: true }, (socket) => {
    let attachedDeviceId: string | undefined;

    socket.on("message", (raw) => {
      const message = parseClientMessage(JSON.parse(raw.toString()));

      if (message.type === "device.register") {
        registry.register(message);
        attachedDeviceId = message.deviceId;
        hub.attachAgent(message.deviceId, (outgoing) => sendJson(socket, outgoing));
        sendJson(socket, {
          type: "device.registered",
          deviceId: message.deviceId
        });
        return;
      }

      if ((message.type === "terminal.input" || message.type === "terminal.resize") && attachedDeviceId) {
        throw new Error("Agent sockets must send terminal output, not terminal input");
      }
    });

    socket.on("close", () => {
      if (attachedDeviceId) {
        registry.markOffline(attachedDeviceId);
        hub.detachAgent(attachedDeviceId);
      }
    });
  });

  app.get("/ws/mobile", { websocket: true }, (socket) => {
    socket.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString());

      if (parsed.type === "session.open") {
        const session = hub.openSession(parsed.deviceId, (outgoing) => sendJson(socket, outgoing));
        sendJson(socket, {
          type: "session.opened",
          sessionId: session.sessionId,
          deviceId: session.deviceId
        });
        return;
      }

      const message = parseClientMessage(parsed);
      if (message.type === "terminal.input" || message.type === "terminal.resize") {
        hub.routeFromMobile(message);
      }
    });
  });

  app.post("/internal/agent/:deviceId/output", async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const message = request.body as {
      type: "terminal.output" | "terminal.exit";
      sessionId: string;
      stream?: "stdout" | "stderr";
      data?: string;
      exitCode?: number | null;
    };

    if (message.type === "terminal.output") {
      hub.routeFromAgent(deviceId, {
        type: "terminal.output",
        sessionId: message.sessionId,
        stream: message.stream ?? "stdout",
        data: message.data ?? ""
      });
    }

    if (message.type === "terminal.exit") {
      hub.routeFromAgent(deviceId, {
        type: "terminal.exit",
        sessionId: message.sessionId,
        exitCode: message.exitCode ?? null
      });
    }

    return reply.send({ ok: true });
  });
}
```

- [x] **Step 2: Implement server entrypoint**

Create `apps/server/src/index.ts`:

```ts
import websocket from "@fastify/websocket";
import fastify from "fastify";
import { registerWsRoutes } from "./ws";

const app = fastify({ logger: true });
await app.register(websocket);
registerWsRoutes(app);

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });
```

- [x] **Step 3: Run server typecheck**

Run:

```bash
pnpm --filter @remote/server typecheck
```

Expected: typecheck exits with code 0.

- [x] **Step 4: Run server locally**

Run:

```bash
pnpm dev:server
```

Expected: Fastify logs show server listening on `127.0.0.1:8787`.

- [x] **Step 5: Verify health endpoint**

In another terminal, run:

```bash
curl http://127.0.0.1:8787/health
```

Expected:

```json
{"ok":true}
```

- [x] **Step 6: Commit WebSocket API**

Run:

```bash
git add apps/server/src/ws.ts apps/server/src/index.ts
git commit -m "feat: add development websocket relay"
```

Expected: one commit containing server WebSocket API.

## Task 6: Agent Terminal Session

**Files:**
- Create: `apps/agent/package.json`
- Create: `apps/agent/tsconfig.json`
- Create: `apps/agent/src/terminalSession.ts`
- Test: `apps/agent/tests/terminalSession.test.ts`

- [x] **Step 1: Create agent package manifest**

Create `apps/agent/package.json`:

```json
{
  "name": "@remote/agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/index.ts",
    "test": "vitest run apps/agent/tests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@remote/protocol": "workspace:*",
    "node-pty": "^1.0.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.13"
  }
}
```

- [x] **Step 2: Create agent TypeScript config**

Create `apps/agent/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [x] **Step 3: Write failing terminal session tests**

Create `apps/agent/tests/terminalSession.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { TerminalSession } from "../src/terminalSession";

describe("TerminalSession", () => {
  it("writes input to the pty adapter", () => {
    const adapter = {
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn(),
      onExit: vi.fn()
    };

    const session = new TerminalSession("session-1", adapter);
    session.write("pwd\n");

    expect(adapter.write).toHaveBeenCalledWith("pwd\n");
  });

  it("resizes the pty adapter", () => {
    const adapter = {
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn(),
      onExit: vi.fn()
    };

    const session = new TerminalSession("session-1", adapter);
    session.resize(100, 30);

    expect(adapter.resize).toHaveBeenCalledWith(100, 30);
  });
});
```

- [x] **Step 4: Run tests and verify failure**

Run:

```bash
pnpm --filter @remote/agent test
```

Expected: FAIL because `../src/terminalSession` does not exist.

- [x] **Step 5: Implement terminal session wrapper**

Create `apps/agent/src/terminalSession.ts`:

```ts
export interface PtyAdapter {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(callback: (data: string) => void): void;
  onExit(callback: (exitCode: number | null) => void): void;
}

export class TerminalSession {
  constructor(
    readonly sessionId: string,
    private readonly pty: PtyAdapter
  ) {}

  write(data: string): void {
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
  }

  onOutput(callback: (data: string) => void): void {
    this.pty.onData(callback);
  }

  onExit(callback: (exitCode: number | null) => void): void {
    this.pty.onExit(callback);
  }

  close(): void {
    this.pty.kill();
  }
}
```

- [x] **Step 6: Run agent tests**

Run:

```bash
pnpm --filter @remote/agent test
pnpm --filter @remote/agent typecheck
```

Expected: tests pass and typecheck exits with code 0.

- [x] **Step 7: Commit terminal session wrapper**

Run:

```bash
git add apps/agent
git commit -m "feat: add agent terminal session wrapper"
```

Expected: one commit containing agent package and terminal tests.

## Task 7: Agent Server Client

**Files:**
- Create: `apps/agent/src/config.ts`
- Create: `apps/agent/src/agentClient.ts`
- Create: `apps/agent/src/index.ts`

- [x] **Step 1: Implement agent config**

Create `apps/agent/src/config.ts`:

```ts
import os from "node:os";

export interface AgentConfig {
  serverUrl: string;
  deviceId: string;
  deviceName: string;
  shell: string;
}

export function loadAgentConfig(): AgentConfig {
  return {
    serverUrl: process.env.REMOTE_SERVER_URL ?? "ws://127.0.0.1:8787/ws/agent",
    deviceId: process.env.REMOTE_DEVICE_ID ?? `${os.hostname()}-dev`,
    deviceName: process.env.REMOTE_DEVICE_NAME ?? os.hostname(),
    shell: process.env.SHELL ?? "/bin/zsh"
  };
}
```

- [x] **Step 2: Implement agent WebSocket client**

Create `apps/agent/src/agentClient.ts`:

```ts
import pty from "node-pty";
import WebSocket from "ws";
import { encodeMessage, parseClientMessage, parseServerMessage } from "@remote/protocol";
import type { AgentConfig } from "./config";
import { TerminalSession } from "./terminalSession";

export class AgentClient {
  private socket?: WebSocket;
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(private readonly config: AgentConfig) {}

  connect(): void {
    this.socket = new WebSocket(this.config.serverUrl);

    this.socket.on("open", () => {
      this.send({
        type: "device.register",
        deviceId: this.config.deviceId,
        deviceName: this.config.deviceName,
        capabilities: ["terminal"]
      });
    });

    this.socket.on("message", (raw) => {
      const parsed = JSON.parse(raw.toString());

      if (parsed.type === "session.opened") {
        const message = parseServerMessage(parsed);
        this.openTerminal(message.sessionId);
        return;
      }

      const message = parseClientMessage(parsed);
      if (message.type === "terminal.input") {
        this.sessions.get(message.sessionId)?.write(message.data);
      }
      if (message.type === "terminal.resize") {
        this.sessions.get(message.sessionId)?.resize(message.cols, message.rows);
      }
    });
  }

  private openTerminal(sessionId: string): void {
    const child = pty.spawn(this.config.shell, [], {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env
    });

    const session = new TerminalSession(sessionId, {
      write: (data) => child.write(data),
      resize: (cols, rows) => child.resize(cols, rows),
      kill: () => child.kill(),
      onData: (callback) => child.onData(callback),
      onExit: (callback) => child.onExit(({ exitCode }) => callback(exitCode))
    });

    session.onOutput((data) => {
      this.send({
        type: "terminal.output",
        sessionId,
        stream: "stdout",
        data
      });
    });

    session.onExit((exitCode) => {
      this.send({
        type: "terminal.exit",
        sessionId,
        exitCode
      });
    });

    this.sessions.set(sessionId, session);
  }

  private send(message: Parameters<typeof encodeMessage>[0]): void {
    this.socket?.send(encodeMessage(message));
  }
}
```

- [x] **Step 3: Implement agent entrypoint**

Create `apps/agent/src/index.ts`:

```ts
import { AgentClient } from "./agentClient";
import { loadAgentConfig } from "./config";

const client = new AgentClient(loadAgentConfig());
client.connect();
```

- [x] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @remote/agent typecheck
```

Expected: typecheck exits with code 0.

- [x] **Step 5: Commit agent client**

Run:

```bash
git add apps/agent/src/config.ts apps/agent/src/agentClient.ts apps/agent/src/index.ts
git commit -m "feat: connect mac agent to relay server"
```

Expected: one commit containing Agent WebSocket client.

## Task 8: Mobile Terminal State

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/src/state/terminalStore.ts`
- Test: `apps/mobile/tests/terminalStore.test.ts`

- [x] **Step 1: Create mobile package manifest**

Create `apps/mobile/package.json`:

```json
{
  "name": "@remote/mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "expo start",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run apps/mobile/tests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@remote/protocol": "workspace:*",
    "expo": "^52.0.23",
    "react": "^18.3.1",
    "react-native": "^0.76.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.18"
  }
}
```

- [x] **Step 2: Create mobile TypeScript config**

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["App.tsx", "src/**/*.ts", "src/**/*.tsx"]
}
```

- [x] **Step 3: Create Expo app config**

Create `apps/mobile/app.json`:

```json
{
  "expo": {
    "name": "Remote Terminal",
    "slug": "remote-terminal",
    "version": "0.1.0",
    "orientation": "portrait",
    "platforms": ["ios", "android"]
  }
}
```

- [x] **Step 4: Write failing terminal store tests**

Create `apps/mobile/tests/terminalStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTerminalState } from "../src/state/terminalStore";

describe("terminal store", () => {
  it("appends output chunks in order", () => {
    const state = createTerminalState();
    state.appendOutput("hello");
    state.appendOutput(" world");

    expect(state.getSnapshot().output).toBe("hello world");
  });

  it("tracks current input", () => {
    const state = createTerminalState();
    state.setInput("git status");

    expect(state.getSnapshot().input).toBe("git status");
  });

  it("clears input after submit", () => {
    const state = createTerminalState();
    state.setInput("pwd");
    const command = state.submitInput();

    expect(command).toBe("pwd\n");
    expect(state.getSnapshot().input).toBe("");
  });
});
```

- [x] **Step 5: Run tests and verify failure**

Run:

```bash
pnpm --filter @remote/mobile test
```

Expected: FAIL because `../src/state/terminalStore` does not exist.

- [x] **Step 6: Implement terminal state**

Create `apps/mobile/src/state/terminalStore.ts`:

```ts
export interface TerminalSnapshot {
  output: string;
  input: string;
  connected: boolean;
}

export function createTerminalState() {
  let snapshot: TerminalSnapshot = {
    output: "",
    input: "",
    connected: false
  };

  return {
    appendOutput(data: string): void {
      snapshot = {
        ...snapshot,
        output: snapshot.output + data
      };
    },
    setInput(input: string): void {
      snapshot = {
        ...snapshot,
        input
      };
    },
    setConnected(connected: boolean): void {
      snapshot = {
        ...snapshot,
        connected
      };
    },
    submitInput(): string {
      const command = snapshot.input.endsWith("\n") ? snapshot.input : `${snapshot.input}\n`;
      snapshot = {
        ...snapshot,
        input: ""
      };
      return command;
    },
    getSnapshot(): TerminalSnapshot {
      return snapshot;
    }
  };
}
```

- [x] **Step 7: Run mobile state tests**

Run:

```bash
pnpm --filter @remote/mobile test
pnpm --filter @remote/mobile typecheck
```

Expected: tests pass and typecheck exits with code 0.

- [x] **Step 8: Commit mobile state**

Run:

```bash
git add apps/mobile
git commit -m "feat: add mobile terminal state"
```

Expected: one commit containing mobile package and terminal state tests.

## Task 9: Mobile Session Client and Terminal UI

**Files:**
- Create: `apps/mobile/src/protocol/sessionClient.ts`
- Create: `apps/mobile/src/components/TerminalScreen.tsx`
- Create: `apps/mobile/App.tsx`

- [x] **Step 1: Implement mobile session client**

Create `apps/mobile/src/protocol/sessionClient.ts`:

```ts
import { encodeMessage, parseServerMessage } from "@remote/protocol";
import type { ServerMessage } from "@remote/protocol";

export interface SessionClientOptions {
  url: string;
  deviceId: string;
  onMessage(message: ServerMessage): void;
}

export class SessionClient {
  private socket?: WebSocket;
  private sessionId?: string;

  constructor(private readonly options: SessionClientOptions) {}

  connect(): void {
    this.socket = new WebSocket(this.options.url);

    this.socket.onopen = () => {
      this.socket?.send(
        JSON.stringify({
          type: "session.open",
          deviceId: this.options.deviceId
        })
      );
    };

    this.socket.onmessage = (event) => {
      const message = parseServerMessage(JSON.parse(String(event.data)));
      if (message.type === "session.opened") {
        this.sessionId = message.sessionId;
      }
      this.options.onMessage(message);
    };
  }

  sendTerminalInput(data: string): void {
    if (!this.sessionId) {
      throw new Error("Cannot send terminal input before session opens");
    }

    this.socket?.send(
      encodeMessage({
        type: "terminal.input",
        sessionId: this.sessionId,
        data
      })
    );
  }
}
```

- [x] **Step 2: Implement terminal screen**

Create `apps/mobile/src/components/TerminalScreen.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SessionClient } from "../protocol/sessionClient";
import { createTerminalState } from "../state/terminalStore";

const serverUrl = "ws://127.0.0.1:8787/ws/mobile";
const deviceId = "mac-dev";

export function TerminalScreen() {
  const store = useMemo(() => createTerminalState(), []);
  const [snapshot, setSnapshot] = useState(store.getSnapshot());
  const [client] = useState(
    () =>
      new SessionClient({
        url: serverUrl,
        deviceId,
        onMessage: (message) => {
          if (message.type === "session.opened") {
            store.setConnected(true);
          }
          if (message.type === "terminal.output") {
            store.appendOutput(message.data);
          }
          setSnapshot(store.getSnapshot());
        }
      })
  );

  function connect() {
    client.connect();
  }

  function send() {
    const command = store.submitInput();
    client.sendTerminalInput(command);
    setSnapshot(store.getSnapshot());
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Remote Terminal</Text>
        <Button title={snapshot.connected ? "Connected" : "Connect"} onPress={connect} />
      </View>
      <ScrollView style={styles.output}>
        <Text style={styles.outputText}>{snapshot.output || "Connect to mac-dev to start a terminal session."}</Text>
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={snapshot.input}
          onChangeText={(value) => {
            store.setInput(value);
            setSnapshot(store.getSnapshot());
          }}
          placeholder="输入命令，例如 pwd"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button title="发送" onPress={send} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0f14"
  },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: "#f4f7fb",
    fontSize: 20,
    fontWeight: "700"
  },
  output: {
    flex: 1,
    paddingHorizontal: 16
  },
  outputText: {
    color: "#c7d1df",
    fontFamily: "Menlo",
    fontSize: 14,
    lineHeight: 20
  },
  inputRow: {
    padding: 12,
    flexDirection: "row",
    gap: 8,
    borderTopColor: "#263241",
    borderTopWidth: 1
  },
  input: {
    flex: 1,
    color: "#f4f7fb",
    backgroundColor: "#121923",
    borderColor: "#2f3c4c",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  }
});
```

- [x] **Step 3: Implement mobile app entrypoint**

Create `apps/mobile/App.tsx`:

```tsx
import { TerminalScreen } from "./src/components/TerminalScreen";

export default function App() {
  return <TerminalScreen />;
}
```

- [x] **Step 4: Run mobile typecheck**

Run:

```bash
pnpm --filter @remote/mobile typecheck
```

Expected: typecheck exits with code 0.

- [x] **Step 5: Commit mobile terminal UI**

Run:

```bash
git add apps/mobile/src/protocol/sessionClient.ts apps/mobile/src/components/TerminalScreen.tsx apps/mobile/App.tsx
git commit -m "feat: add terminal-first mobile session UI"
```

Expected: one commit containing mobile session client and terminal screen.

## Task 10: Local Vertical Slice Verification

**Files:**
- Modify: `README.md`

- [x] **Step 1: Create local runbook**

Create `README.md`:

````md
# Terminal-First Remote Control

## Local MVP Foundation

Start the development server:

```bash
pnpm dev:server
```

Start the macOS Agent:

```bash
REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
```

Start the mobile app:

```bash
pnpm dev:mobile
```

In the mobile app, tap `Connect`, type `pwd`, and tap `发送`.

Expected result: terminal output from the macOS Agent appears in the mobile terminal output panel.
````

- [x] **Step 2: Run all tests**

Run:

```bash
pnpm test
```

Expected: all Vitest suites pass.

- [x] **Step 3: Run all typechecks**

Run:

```bash
pnpm typecheck
```

Expected: all packages typecheck with exit code 0.

- [x] **Step 4: Run local server**

Run:

```bash
pnpm dev:server
```

Expected: server listens on `127.0.0.1:8787`.

- [x] **Step 5: Run local Agent**

In a second terminal, run:

```bash
REMOTE_DEVICE_ID=mac-dev pnpm dev:agent
```

Expected: Agent connects to server and registers `mac-dev`.

- [x] **Step 6: Check device list**

In a third terminal, run:

```bash
curl http://127.0.0.1:8787/devices
```

Expected response includes:

```json
{
  "devices": [
    {
      "deviceId": "mac-dev",
      "deviceName": "your-hostname",
      "capabilities": ["terminal"],
      "online": true
    }
  ]
}
```

- [x] **Step 7: Run mobile app**

Run:

```bash
pnpm dev:mobile
```

Expected: Expo starts and shows `Remote Terminal`.

- [x] **Step 8: Verify command execution manually**

In the mobile app:

1. Tap `Connect`.
2. Type `pwd`.
3. Tap `发送`.

Expected: macOS working directory output appears in the terminal output panel.

- [x] **Step 9: Commit runbook**

Run:

```bash
git add README.md
git commit -m "docs: add local mvp foundation runbook"
```

Expected: one commit containing local run instructions.

## Self-Review Checklist

- Spec coverage:
  - Product requirement “终端优先”: Task 8 and Task 9 implement terminal-first mobile UI.
  - Technical requirement “Agent Shell”: Task 6 and Task 7 implement PTY-backed shell session.
  - Technical requirement “云端信令/中继”: Task 3, Task 4, and Task 5 implement development WebSocket relay.
  - Technical requirement “通道边界”: Task 2 defines `Control`, `Terminal`, `File`, and `Desktop` channel names and terminal messages.
  - MVP “macOS 优先”: Task 7 uses macOS shell defaults via `SHELL` and `node-pty`.
- Explicit gaps assigned to future plans:
  - P2P.
  - End-to-end encryption.
  - Desktop capture and input injection.
  - File transfer.
  - Ads.
  - Windows Agent.
- Type consistency:
  - `sessionId`, `deviceId`, `terminal.input`, and `terminal.output` names match across protocol, server, agent, and mobile.
  - `capabilities` uses `terminal`, `file`, `desktop` consistently.
- Verification:
  - Each code-producing task includes a test or typecheck command.
  - The final task includes full local vertical slice verification.
