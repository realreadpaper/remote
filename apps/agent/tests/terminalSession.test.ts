import { describe, expect, it, vi } from "vitest";
import { TerminalSession } from "../src/terminalSession.js";

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
