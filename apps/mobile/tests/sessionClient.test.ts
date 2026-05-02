import { describe, expect, it, vi } from "vitest";
import { encodeMessage, type ServerMessage } from "@remote/protocol";
import { SessionClient, type ConnectionIssue, type WebSocketLike } from "../src/protocol/sessionClient";

class FakeSocket implements WebSocketLike {
  static readonly OPEN = 1;

  readonly OPEN = 1;
  readonly CLOSED = 3;
  readyState = FakeSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event?: { reason?: string }) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  sent: string[] = [];
  closeCalls = 0;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = this.CLOSED;
    this.onclose?.({ reason: "closed" });
  }

  open(): void {
    this.onopen?.();
  }

  receive(data: unknown): void {
    this.onmessage?.({ data });
  }

  error(event: unknown = new Error("socket failed")): void {
    this.onerror?.(event);
  }
}

function createClient(socket = new FakeSocket()) {
  const onMessage = vi.fn<(message: ServerMessage) => void>();
  const onDisconnect = vi.fn<(reason: string) => void>();
  const onConnectionIssue = vi.fn<(issue: ConnectionIssue) => void>();
  const client = new SessionClient({
    url: "ws://localhost:3000",
    deviceId: "device-1",
    createSocket: () => socket,
    onMessage,
    onDisconnect,
    onConnectionIssue
  });

  return { client, socket, onMessage, onDisconnect, onConnectionIssue };
}

describe("SessionClient", () => {
  it("sends session.open with the deviceId when the socket opens", () => {
    const { client, socket } = createClient();

    client.connect();
    socket.open();

    expect(socket.sent).toEqual([encodeMessage({ type: "session.open", deviceId: "device-1" })]);
  });

  it("stores the sessionId and calls onMessage when session.opened is received", () => {
    const { client, socket, onMessage } = createClient();
    const opened = { type: "session.opened", sessionId: "session-1", deviceId: "device-1" } as const;

    client.connect();
    socket.receive(JSON.stringify(opened));

    expect(onMessage).toHaveBeenCalledWith(opened);

    client.sendTerminalInput("pwd\n");
    expect(socket.sent.at(-1)).toBe(
      encodeMessage({ type: "terminal.input", sessionId: "session-1", data: "pwd\n" })
    );
  });

  it("sends terminal.input after the session opens", () => {
    const { client, socket } = createClient();

    client.connect();
    socket.receive(
      JSON.stringify({ type: "session.opened", sessionId: "session-2", deviceId: "device-1" })
    );
    client.sendTerminalInput("ls\n");

    expect(socket.sent.at(-1)).toBe(
      encodeMessage({ type: "terminal.input", sessionId: "session-2", data: "ls\n" })
    );
  });

  it("throws when sending terminal input before the session opens", () => {
    const { client } = createClient();

    client.connect();

    expect(() => client.sendTerminalInput("pwd\n")).toThrow("terminal session is not open");
  });

  it("closes the socket and reports a protocol error when a server message is invalid", () => {
    const { client, socket, onMessage, onDisconnect, onConnectionIssue } = createClient();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    client.connect();

    expect(() => socket.receive("{bad json")).not.toThrow();
    expect(onMessage).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalledWith("Protocol error: invalid server message.");
    expect(onConnectionIssue).toHaveBeenCalledWith({
      kind: "protocol-error",
      message: "Protocol error: invalid server message."
    });
    expect(socket.closeCalls).toBe(1);

    errorSpy.mockRestore();
  });

  it("closes a previous socket before creating a new one", () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const client = new SessionClient({
      url: "ws://localhost:3000",
      deviceId: "device-1",
      createSocket: vi.fn().mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket),
      onMessage: vi.fn()
    });

    client.connect();
    client.connect();

    expect(firstSocket.closeCalls).toBe(1);
    expect(firstSocket.onopen).toBeNull();
    expect(firstSocket.onmessage).toBeNull();
    expect(firstSocket.onclose).toBeNull();
    expect(firstSocket.onerror).toBeNull();
  });

  it("ignores stale session.opened messages after reconnect", () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const onMessage = vi.fn<(message: ServerMessage) => void>();
    const client = new SessionClient({
      url: "ws://localhost:3000",
      deviceId: "device-1",
      createSocket: vi.fn().mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket),
      onMessage
    });

    client.connect();
    client.connect();

    firstSocket.receive(
      JSON.stringify({ type: "session.opened", sessionId: "stale-session", deviceId: "device-1" })
    );
    secondSocket.receive(
      JSON.stringify({ type: "session.opened", sessionId: "current-session", deviceId: "device-1" })
    );
    client.sendTerminalInput("pwd\n");

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(secondSocket.sent.at(-1)).toBe(
      encodeMessage({ type: "terminal.input", sessionId: "current-session", data: "pwd\n" })
    );
    expect(firstSocket.sent).toEqual([]);
  });

  it("clears the session and calls onDisconnect when the socket closes", () => {
    const { client, socket, onDisconnect } = createClient();

    client.connect();
    socket.receive(
      JSON.stringify({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.close();

    expect(onDisconnect).toHaveBeenCalledWith("closed");
    expect(() => client.sendTerminalInput("pwd\n")).toThrow("terminal session is not open");
    expect(socket.sent).toEqual([]);
  });

  it("clears the session and calls onDisconnect when the socket errors", () => {
    const { client, socket, onDisconnect } = createClient();

    client.connect();
    socket.receive(
      JSON.stringify({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.error(new Error("network down"));

    expect(onDisconnect).toHaveBeenCalledWith("network down");
    expect(() => client.sendTerminalInput("pwd\n")).toThrow("terminal session is not open");
  });

  it("classifies socket errors before a session opens as server unreachable", () => {
    const { client, socket, onDisconnect, onConnectionIssue } = createClient();

    client.connect();
    socket.error(new Error("connect ECONNREFUSED"));

    expect(onDisconnect).toHaveBeenCalledWith("Server unreachable: connect ECONNREFUSED");
    expect(onConnectionIssue).toHaveBeenCalledWith({
      kind: "server-unreachable",
      message: "Server unreachable: connect ECONNREFUSED"
    });
  });

  it("classifies session errors for offline devices", () => {
    const { client, socket, onMessage, onConnectionIssue } = createClient();
    const error = {
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Device mac-dev is not online"
    } as const;

    client.connect();
    socket.receive(JSON.stringify(error));

    expect(onMessage).toHaveBeenCalledWith(error);
    expect(onConnectionIssue).toHaveBeenCalledWith({
      kind: "device-offline",
      message: "Device mac-dev is not online"
    });
  });

  it("throws before sending terminal input after close", () => {
    const { client, socket } = createClient();

    client.connect();
    socket.receive(
      JSON.stringify({ type: "session.opened", sessionId: "session-1", deviceId: "device-1" })
    );
    socket.close();

    expect(() => client.sendTerminalInput("whoami\n")).toThrow("terminal session is not open");
    expect(socket.sent).toEqual([]);
  });
});
