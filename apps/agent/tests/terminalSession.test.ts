import { describe, expect, it, vi } from "vitest";
import { TerminalSession } from "../src/terminalSession.js";

const createAdapter = () => ({
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  onData: vi.fn(),
  onExit: vi.fn()
});

describe("TerminalSession", () => {
  it("writes input to the pty adapter", () => {
    const adapter = createAdapter();

    const session = new TerminalSession("session-1", adapter);
    session.write("pwd\n");

    expect(adapter.write).toHaveBeenCalledWith("pwd\n");
  });

  it("resizes the pty adapter", () => {
    const adapter = createAdapter();

    const session = new TerminalSession("session-1", adapter);
    session.resize(100, 30);

    expect(adapter.resize).toHaveBeenCalledWith(100, 30);
  });

  it("delegates output callbacks to the pty adapter", () => {
    const adapter = createAdapter();
    const callback = vi.fn((data: string) => data);

    const session = new TerminalSession("session-1", adapter);
    session.onOutput(callback);

    expect(adapter.onData).toHaveBeenCalledWith(callback);
  });

  it("delegates exit callbacks to the pty adapter", () => {
    const adapter = createAdapter();
    const callback = vi.fn((exitCode: number | null) => exitCode);

    const session = new TerminalSession("session-1", adapter);
    session.onExit(callback);

    expect(adapter.onExit).toHaveBeenCalledWith(callback);
  });

  it("closes the pty adapter", () => {
    const adapter = createAdapter();

    const session = new TerminalSession("session-1", adapter);
    session.close();

    expect(adapter.kill).toHaveBeenCalled();
  });
});
