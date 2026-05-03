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

  it("rejects extra fields on known client messages", () => {
    expect(() =>
      parseClientMessage({
        type: "terminal.input",
        sessionId: "session-1",
        data: "pwd\n",
        unexpected: true
      })
    ).toThrow();
  });

  it("parses terminal close from server to agent", () => {
    const message = parseClientMessage({
      type: "terminal.close",
      sessionId: "session-1"
    });

    expect(message).toEqual({
      type: "terminal.close",
      sessionId: "session-1"
    });
  });

  it("parses session.open with an optional session token", () => {
    const message = parseClientMessage({
      type: "session.open",
      deviceId: "device-1",
      sessionToken: "session-token-1"
    });

    expect(message).toEqual({
      type: "session.open",
      deviceId: "device-1",
      sessionToken: "session-token-1"
    });
  });

  it("parses session.open with an optional resume session id", () => {
    const message = parseClientMessage({
      type: "session.open",
      deviceId: "device-1",
      sessionToken: "session-token-1",
      resumeSessionId: "session-1"
    });

    expect(message).toEqual({
      type: "session.open",
      deviceId: "device-1",
      sessionToken: "session-token-1",
      resumeSessionId: "session-1"
    });
  });

  it("parses agent pairing create request", () => {
    const message = parseClientMessage({
      type: "pairing.create",
      deviceId: "device-1"
    });

    expect(message).toEqual({
      type: "pairing.create",
      deviceId: "device-1"
    });
  });

  it("parses agent pairing approval and rejection", () => {
    expect(
      parseClientMessage({
        type: "pairing.approved",
        pairingRequestId: "request-1",
        deviceId: "device-1"
      })
    ).toEqual({
      type: "pairing.approved",
      pairingRequestId: "request-1",
      deviceId: "device-1"
    });

    expect(
      parseClientMessage({
        type: "pairing.rejected",
        pairingRequestId: "request-2",
        deviceId: "device-1",
        reason: "User denied"
      })
    ).toEqual({
      type: "pairing.rejected",
      pairingRequestId: "request-2",
      deviceId: "device-1",
      reason: "User denied"
    });
  });

  it("parses terminal snapshot request", () => {
    const message = parseClientMessage({
      type: "terminal.snapshot.request",
      sessionId: "session-1"
    });

    expect(message).toEqual({
      type: "terminal.snapshot.request",
      sessionId: "session-1"
    });
  });

  it("parses terminal signal messages", () => {
    expect(parseClientMessage({ type: "terminal.signal", sessionId: "session-1", signal: "SIGINT" })).toEqual({
      type: "terminal.signal",
      sessionId: "session-1",
      signal: "SIGINT"
    });
    expect(parseClientMessage({ type: "terminal.signal", sessionId: "session-1", signal: "EOF" })).toEqual({
      type: "terminal.signal",
      sessionId: "session-1",
      signal: "EOF"
    });
  });

  it("rejects invalid terminal signal messages", () => {
    expect(() => parseClientMessage({ type: "terminal.signal", sessionId: "session-1" })).toThrow();
    expect(() => parseClientMessage({ type: "terminal.signal", sessionId: "session-1", signal: "SIGKILL" })).toThrow();
  });

  it("rejects extra fields on terminal close", () => {
    expect(() =>
      parseClientMessage({
        type: "terminal.close",
        sessionId: "session-1",
        unexpected: true
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

  it("parses server pairing created response", () => {
    const message = parseServerMessage({
      type: "pairing.created",
      deviceId: "device-1",
      pairingCode: "123456",
      expiresAt: "2026-05-03T00:30:00.000Z",
      serverUrl: "wss://relay.example.test",
      deviceName: "MacBook Pro"
    });

    expect(message).toEqual({
      type: "pairing.created",
      deviceId: "device-1",
      pairingCode: "123456",
      expiresAt: "2026-05-03T00:30:00.000Z",
      serverUrl: "wss://relay.example.test",
      deviceName: "MacBook Pro"
    });
  });

  it("parses server pairing requested notification", () => {
    const message = parseServerMessage({
      type: "pairing.requested",
      pairingRequestId: "request-1",
      deviceId: "device-1",
      mobileClientId: "mobile-1",
      mobileName: "Alice iPhone",
      requestedAt: "2026-05-03T00:31:00.000Z"
    });

    expect(message).toEqual({
      type: "pairing.requested",
      pairingRequestId: "request-1",
      deviceId: "device-1",
      mobileClientId: "mobile-1",
      mobileName: "Alice iPhone",
      requestedAt: "2026-05-03T00:31:00.000Z"
    });
  });

  it("parses auth session token", () => {
    const message = parseServerMessage({
      type: "auth.sessionToken",
      sessionId: "session-1",
      deviceId: "device-1",
      sessionToken: "session-token-1",
      expiresAt: "2026-05-03T00:32:00.000Z"
    });

    expect(message).toEqual({
      type: "auth.sessionToken",
      sessionId: "session-1",
      deviceId: "device-1",
      sessionToken: "session-token-1",
      expiresAt: "2026-05-03T00:32:00.000Z"
    });
  });

  it("parses device status", () => {
    const message = parseServerMessage({
      type: "device.status",
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      platform: "macos",
      capabilities: ["terminal"],
      online: true,
      lastSeenAt: "2026-05-03T00:33:00.000Z"
    });

    expect(message).toEqual({
      type: "device.status",
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      platform: "macos",
      capabilities: ["terminal"],
      online: true,
      lastSeenAt: "2026-05-03T00:33:00.000Z"
    });
  });

  it("parses terminal snapshot response", () => {
    const message = parseServerMessage({
      type: "terminal.snapshot",
      sessionId: "session-1",
      deviceId: "device-1",
      output: ["pwd\r\n", "/Users/me\r\n"],
      alive: true,
      exitCode: null,
      cols: 100,
      rows: 30
    });

    expect(message).toEqual({
      type: "terminal.snapshot",
      sessionId: "session-1",
      deviceId: "device-1",
      output: ["pwd\r\n", "/Users/me\r\n"],
      alive: true,
      exitCode: null,
      cols: 100,
      rows: 30
    });
  });

  it("rejects extra fields on known server messages", () => {
    expect(() =>
      parseServerMessage({
        type: "terminal.output",
        sessionId: "session-1",
        stream: "stdout",
        data: "/Users/me\n",
        unexpected: true
      })
    ).toThrow();
  });

  it("rejects pairing messages missing required fields", () => {
    expect(() => parseClientMessage({ type: "pairing.create" })).toThrow();
    expect(() =>
      parseClientMessage({
        type: "pairing.approved",
        deviceId: "device-1"
      })
    ).toThrow();
    expect(() =>
      parseServerMessage({
        type: "pairing.created",
        deviceId: "device-1",
        expiresAt: "2026-05-03T00:30:00.000Z",
        serverUrl: "wss://relay.example.test",
        deviceName: "MacBook Pro"
      })
    ).toThrow();
    expect(() =>
      parseServerMessage({
        type: "auth.sessionToken",
        sessionId: "session-1",
        deviceId: "device-1",
        expiresAt: "2026-05-03T00:32:00.000Z"
      })
    ).toThrow();
    expect(() =>
      parseClientMessage({
        type: "terminal.snapshot.request"
      })
    ).toThrow();
  });
});
