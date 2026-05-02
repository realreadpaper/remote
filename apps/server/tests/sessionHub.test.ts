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
    hub.routeFromMobile({
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
});
