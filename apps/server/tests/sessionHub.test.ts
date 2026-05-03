import { describe, expect, it, vi } from "vitest";
import { SessionHub } from "../src/sessionHub.js";

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

  it("does not retain a session when notifying the agent fails", () => {
    const hub = new SessionHub();
    const mobileSend = vi.fn();
    let openedSessionId: string | undefined;
    const agentSend = vi.fn((message: { type: string; sessionId: string }) => {
      openedSessionId = message.sessionId;
      throw new Error("agent send failed");
    });

    hub.attachAgent("mac-1", agentSend);

    expect(() => hub.openSession("mac-1", mobileSend)).toThrow("agent send failed");
    expect(openedSessionId).toBeDefined();
    expect(() =>
      hub.routeFromMobile(mobileSend, {
        type: "terminal.input",
        sessionId: openedSessionId!,
        data: "pwd\n"
      })
    ).toThrow(`Unknown session ${openedSessionId}`);
  });

  it("routes terminal input to the agent", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromMobile(mobileSend, {
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

  it("routes terminal resize to the agent", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromMobile(mobileSend, {
      type: "terminal.resize",
      sessionId: session.sessionId,
      cols: 120,
      rows: 40
    });

    expect(agentSend).toHaveBeenCalledWith({
      type: "terminal.resize",
      sessionId: session.sessionId,
      cols: 120,
      rows: 40
    });
  });

  it("routes terminal signal to the agent", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromMobile(mobileSend, {
      type: "terminal.signal",
      sessionId: session.sessionId,
      signal: "SIGINT"
    });

    expect(agentSend).toHaveBeenCalledWith({
      type: "terminal.signal",
      sessionId: session.sessionId,
      signal: "SIGINT"
    });
  });

  it("routes terminal output to the mobile client", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromAgent("mac-1", agentSend, {
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

  it("routes terminal snapshots to the mobile client", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromAgent("mac-1", agentSend, {
      type: "terminal.snapshot",
      sessionId: session.sessionId,
      deviceId: "mac-1",
      output: ["ready\n"],
      alive: true,
      exitCode: null,
      cols: 100,
      rows: 30
    });

    expect(mobileSend).toHaveBeenCalledWith({
      type: "terminal.snapshot",
      sessionId: session.sessionId,
      deviceId: "mac-1",
      output: ["ready\n"],
      alive: true,
      exitCode: null,
      cols: 100,
      rows: 30
    });
  });

  it("throws when routing mobile input for an unknown session", () => {
    const hub = new SessionHub();
    const mobileSend = vi.fn();

    expect(() =>
      hub.routeFromMobile(mobileSend, {
        type: "terminal.input",
        sessionId: "missing-session",
        data: "pwd\n"
      })
    ).toThrow("Unknown session missing-session");
  });

  it("throws when routing mobile input to a detached agent", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.detachAgent("mac-1", agentSend);
    agentSend.mockClear();

    expect(() =>
      hub.routeFromMobile(mobileSend, {
        type: "terminal.input",
        sessionId: session.sessionId,
        data: "pwd\n"
      })
    ).toThrow("Device mac-1 is not online");
    expect(agentSend).not.toHaveBeenCalled();
  });

  it("does not detach a newer agent connection when an old sender detaches", () => {
    const hub = new SessionHub();
    const oldAgentSend = vi.fn();
    const newAgentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", oldAgentSend);
    hub.attachAgent("mac-1", newAgentSend);
    hub.detachAgent("mac-1", oldAgentSend);

    const session = hub.openSession("mac-1", mobileSend);

    expect(oldAgentSend).not.toHaveBeenCalled();
    expect(newAgentSend).toHaveBeenCalledWith({
      type: "session.opened",
      sessionId: session.sessionId,
      deviceId: "mac-1"
    });
  });

  it("throws when the mobile client does not own the session", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();
    const otherMobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    agentSend.mockClear();

    expect(() =>
      hub.routeFromMobile(otherMobileSend, {
        type: "terminal.input",
        sessionId: session.sessionId,
        data: "pwd\n"
      })
    ).toThrow(`Mobile client does not own session ${session.sessionId}`);
    expect(agentSend).not.toHaveBeenCalled();
  });

  it("throws when the agent device does not own the session", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    hub.attachAgent("mac-2", vi.fn());
    const session = hub.openSession("mac-1", mobileSend);

    expect(() =>
      hub.routeFromAgent("mac-2", agentSend, {
        type: "terminal.output",
        sessionId: session.sessionId,
        stream: "stdout",
        data: "ok\n"
      })
    ).toThrow(`Unknown session ${session.sessionId} for device mac-2`);
    expect(mobileSend).not.toHaveBeenCalled();
  });

  it("routes terminal exit to the mobile client and removes the session", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromAgent("mac-1", agentSend, {
      type: "terminal.exit",
      sessionId: session.sessionId,
      exitCode: 0
    });

    expect(mobileSend).toHaveBeenCalledWith({
      type: "terminal.exit",
      sessionId: session.sessionId,
      exitCode: 0
    });
    expect(() =>
      hub.routeFromMobile(mobileSend, {
        type: "terminal.input",
        sessionId: session.sessionId,
        data: "pwd\n"
      })
    ).toThrow(`Unknown session ${session.sessionId}`);
  });

  it("throws when a stale same-device agent sender routes terminal output", () => {
    const hub = new SessionHub();
    const oldAgentSend = vi.fn();
    const newAgentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", oldAgentSend);
    hub.attachAgent("mac-1", newAgentSend);
    const session = hub.openSession("mac-1", mobileSend);

    expect(() =>
      hub.routeFromAgent("mac-1", oldAgentSend, {
        type: "terminal.output",
        sessionId: session.sessionId,
        stream: "stdout",
        data: "stale\n"
      })
    ).toThrow("Agent sender is not attached for device mac-1");
    expect(mobileSend).not.toHaveBeenCalled();
  });

  it("sends terminal.close for all sessions owned by a mobile sender", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    agentSend.mockClear();

    hub.closeMobile(mobileSend);

    expect(agentSend).not.toHaveBeenCalled();
    expect(() =>
      hub.routeFromAgent("mac-1", agentSend, {
        type: "terminal.output",
        sessionId: session.sessionId,
        stream: "stdout",
        data: "detached\n"
      })
    ).not.toThrow();
  });

  it("keeps mobile-owned sessions recoverable after closing the mobile socket", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();
    const restoredMobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    agentSend.mockClear();

    hub.closeMobile(mobileSend);

    const restored = hub.openSession("mac-1", restoredMobileSend, { resumeSessionId: session.sessionId });
    expect(restored).toEqual(session);
    expect(agentSend).not.toHaveBeenCalled();

    hub.routeFromAgent("mac-1", agentSend, {
      type: "terminal.output",
      sessionId: session.sessionId,
      stream: "stdout",
      data: "after restore\n"
    });
    expect(restoredMobileSend).toHaveBeenCalledWith({
      type: "terminal.output",
      sessionId: session.sessionId,
      stream: "stdout",
      data: "after restore\n"
    });
  });

  it("closes a detached session after the retention timeout", () => {
    vi.useFakeTimers();
    try {
      const hub = new SessionHub({ detachedSessionRetentionMs: 1_000 });
      const agentSend = vi.fn();
      const mobileSend = vi.fn();

      hub.attachAgent("mac-1", agentSend);
      const session = hub.openSession("mac-1", mobileSend);
      agentSend.mockClear();

      hub.closeMobile(mobileSend);
      vi.advanceTimersByTime(999);

      expect(agentSend).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(agentSend).toHaveBeenCalledWith({
        type: "terminal.close",
        sessionId: session.sessionId
      });
      expect(() =>
        hub.routeFromMobile(mobileSend, {
          type: "terminal.input",
          sessionId: session.sessionId,
          data: "pwd\n"
        })
      ).toThrow(`Unknown session ${session.sessionId}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels detached session retention timeout after resume", () => {
    vi.useFakeTimers();
    try {
      const hub = new SessionHub({ detachedSessionRetentionMs: 1_000 });
      const agentSend = vi.fn();
      const mobileSend = vi.fn();
      const restoredMobileSend = vi.fn();

      hub.attachAgent("mac-1", agentSend);
      const session = hub.openSession("mac-1", mobileSend);
      hub.closeMobile(mobileSend);
      hub.openSession("mac-1", restoredMobileSend, { resumeSessionId: session.sessionId });
      agentSend.mockClear();

      vi.advanceTimersByTime(1_000);

      expect(agentSend).not.toHaveBeenCalled();
      hub.routeFromMobile(restoredMobileSend, {
        type: "terminal.snapshot.request",
        sessionId: session.sessionId
      });
      expect(agentSend).toHaveBeenCalledWith({
        type: "terminal.snapshot.request",
        sessionId: session.sessionId
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when resuming a session for another device", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();
    const restoredMobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    hub.attachAgent("mac-2", vi.fn());
    const session = hub.openSession("mac-1", mobileSend);
    hub.closeMobile(mobileSend);

    expect(() => hub.openSession("mac-2", restoredMobileSend, { resumeSessionId: session.sessionId })).toThrow(
      `Session ${session.sessionId} is not for device mac-2`
    );
  });

  it("ignores missing agents while closing mobile-owned sessions", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.detachAgent("mac-1", agentSend);

    expect(hub.closeMobile(mobileSend)).toBe(1);
    expect(() =>
      hub.openSession("mac-1", mobileSend, { resumeSessionId: session.sessionId })
    ).toThrow("Device mac-1 is not online");
    expect(mobileSend).not.toHaveBeenCalled();
  });

  it("routes terminal snapshot requests from a restored mobile to the agent", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();
    const restoredMobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.closeMobile(mobileSend);
    hub.openSession("mac-1", restoredMobileSend, { resumeSessionId: session.sessionId });
    agentSend.mockClear();

    hub.routeFromMobile(restoredMobileSend, {
      type: "terminal.snapshot.request",
      sessionId: session.sessionId
    });

    expect(agentSend).toHaveBeenCalledWith({
      type: "terminal.snapshot.request",
      sessionId: session.sessionId
    });
  });
});
