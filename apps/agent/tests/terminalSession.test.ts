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

  it("maps SIGINT to the PTY interrupt byte", () => {
    const adapter = createAdapter();

    const session = new TerminalSession("session-1", adapter);
    session.sendSignal("SIGINT");

    expect(adapter.write).toHaveBeenCalledWith("\x03");
  });

  it("maps EOF to the PTY EOF byte", () => {
    const adapter = createAdapter();

    const session = new TerminalSession("session-1", adapter);
    session.sendSignal("EOF");

    expect(adapter.write).toHaveBeenCalledWith("\x04");
  });

  it("invokes output callbacks from the pty adapter", () => {
    const adapter = createAdapter();
    const callback = vi.fn((data: string) => data);
    let onData: ((data: string) => void) | undefined;
    adapter.onData.mockImplementation((wrappedCallback: (data: string) => void) => {
      onData = wrappedCallback;
    });

    const session = new TerminalSession("session-1", adapter);
    session.onOutput(callback);
    onData?.("hello");

    expect(callback).toHaveBeenCalledWith("hello");
  });

  it("stores recent output in a bounded snapshot buffer", () => {
    const adapter = createAdapter();
    let onData: ((data: string) => void) | undefined;
    adapter.onData.mockImplementation((callback: (data: string) => void) => {
      onData = callback;
    });

    const session = new TerminalSession("session-1", adapter, { maxSnapshotChunks: 2 });
    session.onOutput(() => undefined);
    onData?.("one");
    onData?.("two");
    onData?.("three");

    expect(session.snapshot("mac-1")).toMatchObject({
      type: "terminal.snapshot",
      sessionId: "session-1",
      deviceId: "mac-1",
      output: ["two", "three"],
      alive: true,
      exitCode: null,
      cols: 100,
      rows: 30
    });
  });

  it("updates snapshot dimensions after resize", () => {
    const adapter = createAdapter();

    const session = new TerminalSession("session-1", adapter);
    session.resize(120, 40);

    expect(session.snapshot("mac-1")).toMatchObject({
      cols: 120,
      rows: 40
    });
  });

  it("invokes exit callbacks from the pty adapter", () => {
    const adapter = createAdapter();
    const callback = vi.fn((exitCode: number | null) => exitCode);
    let onExit: ((exitCode: number | null) => void) | undefined;
    adapter.onExit.mockImplementation((wrappedCallback: (exitCode: number | null) => void) => {
      onExit = wrappedCallback;
    });

    const session = new TerminalSession("session-1", adapter);
    session.onExit(callback);
    onExit?.(0);

    expect(callback).toHaveBeenCalledWith(0);
  });

  it("marks snapshot as not alive after exit", () => {
    const adapter = createAdapter();
    let onExit: ((exitCode: number | null) => void) | undefined;
    adapter.onExit.mockImplementation((callback: (exitCode: number | null) => void) => {
      onExit = callback;
    });

    const session = new TerminalSession("session-1", adapter);
    session.onExit(() => undefined);
    onExit?.(12);

    expect(session.snapshot("mac-1")).toMatchObject({
      alive: false,
      exitCode: 12
    });
  });

  it("closes the pty adapter", () => {
    const adapter = createAdapter();

    const session = new TerminalSession("session-1", adapter);
    session.close();

    expect(adapter.kill).toHaveBeenCalled();
  });
});
