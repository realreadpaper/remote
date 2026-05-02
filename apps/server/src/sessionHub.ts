import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage } from "@remote/protocol";

type AgentSend = (
  message:
    | Extract<ServerMessage, { type: "session.opened" }>
    | Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" }>
) => void;
type MobileSend = (message: Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>) => void;

export interface RemoteSession {
  sessionId: string;
  deviceId: string;
}

interface SessionRecord extends RemoteSession {
  mobileSend: MobileSend;
}

export class SessionHub {
  private readonly agents = new Map<string, AgentSend>();
  private readonly sessions = new Map<string, SessionRecord>();

  attachAgent(deviceId: string, send: AgentSend): void {
    this.agents.set(deviceId, send);
  }

  detachAgent(deviceId: string, send: AgentSend): boolean {
    if (this.agents.get(deviceId) !== send) {
      return false;
    }

    this.agents.delete(deviceId);
    return true;
  }

  openSession(deviceId: string, mobileSend: MobileSend): RemoteSession {
    const agentSend = this.agents.get(deviceId);
    if (!agentSend) {
      throw new Error(`Device ${deviceId} is not online`);
    }

    const session: SessionRecord = {
      sessionId: nanoid(),
      deviceId,
      mobileSend
    };
    this.sessions.set(session.sessionId, session);

    try {
      agentSend({
        type: "session.opened",
        sessionId: session.sessionId,
        deviceId
      });
    } catch (error) {
      this.sessions.delete(session.sessionId);
      throw error;
    }

    return {
      sessionId: session.sessionId,
      deviceId
    };
  }

  routeFromMobile(
    mobileSend: MobileSend,
    message: Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" }>
  ): void {
    const session = this.sessions.get(message.sessionId);
    if (!session) {
      throw new Error(`Unknown session ${message.sessionId}`);
    }
    if (session.mobileSend !== mobileSend) {
      throw new Error(`Mobile client does not own session ${message.sessionId}`);
    }

    const agentSend = this.agents.get(session.deviceId);
    if (!agentSend) {
      throw new Error(`Device ${session.deviceId} is not online`);
    }

    agentSend(message);
  }

  routeFromAgent(deviceId: string, message: Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>): void {
    const session = this.sessions.get(message.sessionId);
    if (!session || session.deviceId !== deviceId) {
      throw new Error(`Unknown session ${message.sessionId} for device ${deviceId}`);
    }

    session.mobileSend(message);
    if (message.type === "terminal.exit") {
      this.sessions.delete(message.sessionId);
    }
  }

  closeMobile(mobileSend: MobileSend): number {
    let closedSessions = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.mobileSend !== mobileSend) {
        continue;
      }

      this.sessions.delete(sessionId);
      closedSessions++;
    }

    return closedSessions;
  }
}
