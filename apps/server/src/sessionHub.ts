import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage } from "@remote/protocol";

type SendJson = (message: ClientMessage | ServerMessage) => void;

export interface RemoteSession {
  sessionId: string;
  deviceId: string;
}

interface SessionRecord extends RemoteSession {
  mobileSend: SendJson;
}

export class SessionHub {
  private readonly agents = new Map<string, SendJson>();
  private readonly sessions = new Map<string, SessionRecord>();

  attachAgent(deviceId: string, send: SendJson): void {
    this.agents.set(deviceId, send);
  }

  detachAgent(deviceId: string): void {
    this.agents.delete(deviceId);
  }

  openSession(deviceId: string, mobileSend: SendJson): RemoteSession {
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

    agentSend({
      type: "session.opened",
      sessionId: session.sessionId,
      deviceId
    });

    return {
      sessionId: session.sessionId,
      deviceId
    };
  }

  routeFromMobile(message: Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" }>): void {
    const session = this.sessions.get(message.sessionId);
    if (!session) {
      throw new Error(`Unknown session ${message.sessionId}`);
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
  }
}
