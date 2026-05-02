import { describe, expect, it, vi } from "vitest";
import { encodeMessage, type ServerMessage } from "@remote/protocol";
import { SessionClient, type WebSocketLike } from "../src/protocol/sessionClient";

class FakeSocket implements WebSocketLike {
  static readonly OPEN = 1;

  readonly OPEN = 1;
  readyState = FakeSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.onopen?.();
  }

  receive(data: unknown): void {
    this.onmessage?.({ data });
  }
}

function createClient() {
  const socket = new FakeSocket();
  const onMessage = vi.fn<(message: ServerMessage) => void>();
  const client = new SessionClient({
    url: "ws://localhost:3000",
    deviceId: "device-1",
    createSocket: () => socket,
    onMessage
  });

  return { client, socket, onMessage };
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

  it("logs and continues when a server message is invalid", () => {
    const { client, socket, onMessage } = createClient();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    client.connect();

    expect(() => socket.receive("{bad json")).not.toThrow();
    expect(onMessage).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
