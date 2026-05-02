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
  private readonly handlers = new Map<SocketEvent, Array<(...args: never[]) => void>>();

  send(data: string): void {
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

class FakeTerminalSession implements Pick<TerminalSession, "write" | "resize" | "onOutput" | "onExit" | "close"> {
  readonly writes: string[] = [];
  readonly resizes: Array<{ cols: number; rows: number }> = [];
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
  shell: "/bin/zsh"
};

const createHarness = () => {
  const socket = new FakeSocket();
  const terminals = new Map<string, FakeTerminalSession>();
  const createTerminal = vi.fn((sessionId: string) => {
    const terminal = new FakeTerminalSession(sessionId);
    terminals.set(sessionId, terminal);
    return terminal as unknown as TerminalSession;
  });
  const client = new AgentClient(config, {
    createSocket: () => socket,
    createTerminal
  });

  client.connect();

  return { client, createTerminal, socket, terminals };
};

describe("AgentClient", () => {
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

  it("does not throw from the message handler on invalid JSON or invalid schema", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { socket } = createHarness();

    expect(() => socket.emit("message", "{")).not.toThrow();
    expect(() => socket.emit("message", JSON.stringify({ type: "terminal.input" }))).not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
