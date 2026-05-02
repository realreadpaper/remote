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
});
