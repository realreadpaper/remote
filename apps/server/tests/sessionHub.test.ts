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

  it("routes terminal output to the mobile client", () => {
    const hub = new SessionHub();
    const agentSend = vi.fn();
    const mobileSend = vi.fn();

    hub.attachAgent("mac-1", agentSend);
    const session = hub.openSession("mac-1", mobileSend);
    hub.routeFromAgent("mac-1", {
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
    hub.detachAgent("mac-1");
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
      hub.routeFromAgent("mac-2", {
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
    hub.routeFromAgent("mac-1", {
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
});
