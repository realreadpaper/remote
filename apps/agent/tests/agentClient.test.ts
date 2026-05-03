import { describe, expect, it, vi } from "vitest";
import {
  encodeMessage,
  parseClientMessage,
  parseServerMessage
} from "@remote/protocol";
import { AgentClient, type AgentSocket } from "../src/agentClient.js";
import type { AgentConfig } from "../src/config.js";
import type { TerminalSession } from "../src/terminalSession.js";

type SocketEvent = "open" | "message" | "close" | "error";

class FakeSocket implements AgentSocket {
  readonly sent: string[] = [];
  sendError?: Error;
  private readonly handlers = new Map<SocketEvent, Array<(...args: never[]) => void>>();

  send(data: string): void {
    if (this.sendError) {
      throw this.sendError;
    }

    this.sent.push(data);
  }

  on(event: SocketEvent, callback: (...args: never[]) => void): void {
    const callbacks = this.handlers.get(event) ?? [];
    callbacks.push(callback);
    this.handlers.set(event, callbacks);
  }

  emit(event: "open" | "close"): void;
  emit(event: "message", data: string): void;
  emit(event: "error", error: Error): void;
  emit(event: SocketEvent, ...args: never[]): void {
    for (const callback of this.handlers.get(event) ?? []) {
      callback(...args);
    }
  }
}

class FakeTerminalSession implements Pick<TerminalSession, "write" | "resize" | "sendSignal" | "onOutput" | "onExit" | "close"> {
  readonly writes: string[] = [];
  readonly resizes: Array<{ cols: number; rows: number }> = [];
  readonly signals: Array<"SIGINT" | "EOF"> = [];
  readonly close = vi.fn();
  private outputCallback?: (data: string) => void;
  private exitCallback?: (exitCode: number | null) => void;

  constructor(readonly sessionId: string) {}

  write(data: string): void {
    this.writes.push(data);
  }

  resize(cols: number, rows: number): void {
    this.resizes.push({ cols, rows });
  }

  sendSignal(signal: "SIGINT" | "EOF"): void {
    this.signals.push(signal);
  }

  onOutput(callback: (data: string) => void): void {
    this.outputCallback = callback;
  }

  onExit(callback: (exitCode: number | null) => void): void {
    this.exitCallback = callback;
  }

  emitOutput(data: string): void {
    this.outputCallback?.(data);
  }

  emitExit(exitCode: number | null): void {
    this.exitCallback?.(exitCode);
  }
}

const config: AgentConfig = {
  serverUrl: "ws://localhost:8787/ws/agent",
  deviceId: "device-1",
  deviceName: "Mac",
  devToken: null,
  shell: "/bin/zsh",
  terminalOutputChunkBytes: 16_384
};

const createHarness = (
  configOverride: Partial<AgentConfig> = {},
  dependencyOverride: Record<string, unknown> = {}
) => {
  const socket = new FakeSocket();
  const terminals = new Map<string, FakeTerminalSession>();
  const createSocket = vi.fn(() => socket);
  const createTerminal = vi.fn((sessionId: string) => {
    const terminal = new FakeTerminalSession(sessionId);
    terminals.set(sessionId, terminal);
    return terminal as unknown as TerminalSession;
  });
  const client = new AgentClient({ ...config, ...configOverride }, {
    createSocket,
    createTerminal,
    ...dependencyOverride
  });

  client.connect();

  return { client, createSocket, createTerminal, socket, terminals };
};

describe("AgentClient", () => {
  it("passes the configured server URL to the socket factory", () => {
    const { createSocket } = createHarness();

    expect(createSocket).toHaveBeenCalledWith("ws://localhost:8787/ws/agent");
  });

  it("appends configured dev token to the socket factory URL", () => {
    const { createSocket } = createHarness({
      ...config,
      devToken: "secret"
    });

    expect(createSocket).toHaveBeenCalledWith("ws://localhost:8787/ws/agent?token=secret");
  });

  it("preserves existing query when appending configured dev token", () => {
    const { createSocket } = createHarness({
      ...config,
      serverUrl: "ws://localhost:8787/ws/agent?mode=dev",
      devToken: "secret"
    });

    expect(createSocket).toHaveBeenCalledWith("ws://localhost:8787/ws/agent?mode=dev&token=secret");
  });

  it("sends device.register when the socket opens", () => {
    const { socket } = createHarness();

    socket.emit("open");

    const message = parseClientMessage(JSON.parse(socket.sent[0] ?? ""));
    expect(message).toEqual({
      type: "device.register",
      deviceId: "device-1",
      deviceName: "Mac",
      capabilities: ["terminal"]
    });
  });

  it("creates a pairing code after device registration succeeds", () => {
    const { socket } = createHarness();

    socket.emit("message", encodeMessage({ type: "device.registered", deviceId: "device-1" }));

    expect(parseClientMessage(JSON.parse(socket.sent[0] ?? ""))).toEqual({
      type: "pairing.create",
      deviceId: "device-1"
    });
  });

  it("displays the pairing code when the server creates one", () => {
    const displayPairingCode = vi.fn();
    const { socket } = createHarness(config, { displayPairingCode });
    const message = {
      type: "pairing.created" as const,
      deviceId: "device-1",
      pairingCode: "123456",
      expiresAt: "2026-05-03T10:00:00.000Z",
      serverUrl: "http://127.0.0.1:8787",
      deviceName: "Mac"
    };

    socket.emit("message", encodeMessage(message));

    expect(displayPairingCode).toHaveBeenCalledWith(message);
  });

  it("approves a pairing request when local approval accepts it", async () => {
    const approvePairingRequest = vi.fn(() => ({ approved: true }));
    const { socket } = createHarness(config, { approvePairingRequest });

    socket.emit(
      "message",
      encodeMessage({
        type: "pairing.requested",
        pairingRequestId: "request-1",
        deviceId: "device-1",
        mobileClientId: "mobile-1",
        mobileName: "iPhone",
        requestedAt: "2026-05-03T10:00:00.000Z"
      })
    );
    await Promise.resolve();

    expect(parseClientMessage(JSON.parse(socket.sent[0] ?? ""))).toEqual({
      type: "pairing.approved",
      pairingRequestId: "request-1",
      deviceId: "device-1"
    });
  });

  it("rejects a pairing request when local approval rejects it", async () => {
    const approvePairingRequest = vi.fn(() => ({ approved: false, reason: "denied locally" }));
    const { socket } = createHarness(config, { approvePairingRequest });

    socket.emit(
      "message",
      encodeMessage({
        type: "pairing.requested",
        pairingRequestId: "request-1",
        deviceId: "device-1",
        mobileClientId: "mobile-1",
        mobileName: "iPhone",
        requestedAt: "2026-05-03T10:00:00.000Z"
      })
    );
    await Promise.resolve();

    expect(parseClientMessage(JSON.parse(socket.sent[0] ?? ""))).toEqual({
      type: "pairing.rejected",
      pairingRequestId: "request-1",
      deviceId: "device-1",
      reason: "denied locally"
    });
  });

  it("creates a terminal session and attaches output and exit handlers on session.opened", () => {
    const { createTerminal, socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );

    expect(createTerminal).toHaveBeenCalledWith("session-1", config);
    const terminal = terminals.get("session-1");
    expect(terminal).toBeDefined();

    terminal?.emitOutput("hello");
    terminal?.emitExit(0);

    expect(parseServerMessage(JSON.parse(socket.sent[0] ?? ""))).toEqual({
      type: "terminal.output",
      sessionId: "session-1",
      stream: "stdout",
      data: "hello"
    });
    expect(parseServerMessage(JSON.parse(socket.sent[1] ?? ""))).toEqual({
      type: "terminal.exit",
      sessionId: "session-1",
      exitCode: 0
    });
  });

  it("routes terminal.input to the matching session", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.emit(
      "message",
      encodeMessage({ type: "terminal.input", sessionId: "session-1", data: "pwd\n" })
    );

    expect(terminals.get("session-1")?.writes).toEqual(["pwd\n"]);
  });

  it("routes terminal.resize to the matching session", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.emit(
      "message",
      encodeMessage({ type: "terminal.resize", sessionId: "session-1", cols: 120, rows: 40 })
    );

    expect(terminals.get("session-1")?.resizes).toEqual([{ cols: 120, rows: 40 }]);
  });

  it("routes terminal.signal to the matching session", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.emit(
      "message",
      encodeMessage({ type: "terminal.signal", sessionId: "session-1", signal: "SIGINT" })
    );

    expect(terminals.get("session-1")?.signals).toEqual(["SIGINT"]);
  });

  it("closes and removes a session when receiving terminal.close", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.emit("message", encodeMessage({ type: "terminal.close", sessionId: "session-1" }));

    expect(terminals.get("session-1")?.close).toHaveBeenCalledOnce();
    socket.emit(
      "message",
      encodeMessage({ type: "terminal.input", sessionId: "session-1", data: "ignored" })
    );
    expect(terminals.get("session-1")?.writes).toEqual([]);
  });

  it("does not send terminal.exit when terminal.close closes the session", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    const terminal = terminals.get("session-1");
    socket.emit("message", encodeMessage({ type: "terminal.close", sessionId: "session-1" }));
    terminal?.emitExit(0);

    expect(socket.sent).toEqual([]);
  });

  it("sends terminal.output when a terminal emits output", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    terminals.get("session-1")?.emitOutput("ready");

    expect(parseServerMessage(JSON.parse(socket.sent[0] ?? ""))).toEqual({
      type: "terminal.output",
      sessionId: "session-1",
      stream: "stdout",
      data: "ready"
    });
  });

  it("splits large terminal output into configured byte chunks", () => {
    const { socket, terminals } = createHarness({ terminalOutputChunkBytes: 4 });

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    terminals.get("session-1")?.emitOutput("abcdef");

    expect(socket.sent.map((message) => parseServerMessage(JSON.parse(message)))).toEqual([
      {
        type: "terminal.output",
        sessionId: "session-1",
        stream: "stdout",
        data: "abcd"
      },
      {
        type: "terminal.output",
        sessionId: "session-1",
        stream: "stdout",
        data: "ef"
      }
    ]);
  });

  it("splits terminal output by UTF-8 bytes without breaking characters", () => {
    const { socket, terminals } = createHarness({ terminalOutputChunkBytes: 4 });

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    terminals.get("session-1")?.emitOutput("你好");

    expect(socket.sent.map((message) => parseServerMessage(JSON.parse(message)))).toEqual([
      {
        type: "terminal.output",
        sessionId: "session-1",
        stream: "stdout",
        data: "你"
      },
      {
        type: "terminal.output",
        sessionId: "session-1",
        stream: "stdout",
        data: "好"
      }
    ]);
  });

  it("sends terminal.exit and removes the session when a terminal exits", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    const terminal = terminals.get("session-1");
    terminal?.emitExit(12);
    socket.emit(
      "message",
      encodeMessage({ type: "terminal.input", sessionId: "session-1", data: "ignored" })
    );

    expect(parseServerMessage(JSON.parse(socket.sent[0] ?? ""))).toEqual({
      type: "terminal.exit",
      sessionId: "session-1",
      exitCode: 12
    });
    expect(terminal?.writes).toEqual([]);
  });

  it("closes active terminal sessions when the socket closes", () => {
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-2", deviceId: "device-1" })
    );
    socket.emit("close");

    expect(terminals.get("session-1")?.close).toHaveBeenCalledOnce();
    expect(terminals.get("session-2")?.close).toHaveBeenCalledOnce();
  });

  it("closes and removes active terminal sessions when the socket errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.emit("error", new Error("connection failed"));
    socket.emit(
      "message",
      encodeMessage({ type: "terminal.input", sessionId: "session-1", data: "ignored" })
    );

    expect(terminals.get("session-1")?.close).toHaveBeenCalledOnce();
    expect(terminals.get("session-1")?.writes).toEqual([]);
    errorSpy.mockRestore();
  });

  it("does not throw and closes sessions when sending terminal output fails", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.sendError = new Error("send failed");

    expect(() => terminals.get("session-1")?.emitOutput("ready")).not.toThrow();
    expect(terminals.get("session-1")?.close).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("does not throw and closes sessions when sending terminal exit fails", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket, terminals } = createHarness();

    socket.emit(
      "message",
      encodeMessage({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.sendError = new Error("send failed");

    expect(() => terminals.get("session-1")?.emitExit(1)).not.toThrow();
    expect(terminals.get("session-1")?.close).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("does not throw from the message handler on invalid JSON or invalid schema", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket } = createHarness();

    expect(() => socket.emit("message", "{")).not.toThrow();
    expect(() => socket.emit("message", JSON.stringify({ type: "terminal.input" }))).not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
