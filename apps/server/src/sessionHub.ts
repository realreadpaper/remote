import { nanoid } from "nanoid";
import type { ClientMessage, ServerMessage } from "@remote/protocol";

type AgentSend = (
  message:
    | Extract<ServerMessage, { type: "session.opened" }>
    | Extract<
        ClientMessage,
        { type: "terminal.input" | "terminal.resize" | "terminal.signal" | "terminal.snapshot.request" | "terminal.close" }
      >
) => void;
type MobileTerminalMessage = Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" | "terminal.snapshot" }>;
type MobileSend = (message: MobileTerminalMessage) => void;
type RetentionTimer = ReturnType<typeof setTimeout>;

export interface RemoteSession {
  sessionId: string;
  deviceId: string;
}

interface SessionRecord extends RemoteSession {
  mobileSend: MobileSend | null;
  detachedRetentionTimer?: RetentionTimer;
}

interface OpenSessionOptions {
  resumeSessionId?: string;
}

interface SessionHubOptions {
  detachedSessionRetentionMs?: number;
}

export class SessionHub {
  private readonly detachedSessionRetentionMs: number;
  private readonly agents = new Map<string, AgentSend>();
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(options: SessionHubOptions = {}) {
    this.detachedSessionRetentionMs = options.detachedSessionRetentionMs ?? 5 * 60 * 1_000;
  }

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

  openSession(deviceId: string, mobileSend: MobileSend, options: OpenSessionOptions = {}): RemoteSession {
    if (options.resumeSessionId) {
      return this.resumeSession(deviceId, mobileSend, options.resumeSessionId);
    }

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
    message: Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" | "terminal.signal" | "terminal.snapshot.request" }>
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

  routeFromAgent(deviceId: string, agentSend: AgentSend, message: MobileTerminalMessage): void {
    const session = this.sessions.get(message.sessionId);
    if (!session || session.deviceId !== deviceId) {
      throw new Error(`Unknown session ${message.sessionId} for device ${deviceId}`);
    }
    if (this.agents.get(deviceId) !== agentSend) {
      throw new Error(`Agent sender is not attached for device ${deviceId}`);
    }

    if (session.mobileSend) {
      try {
        session.mobileSend(message);
      } catch {
        session.mobileSend = null;
      }
    }
    if (message.type === "terminal.exit") {
      this.deleteSession(message.sessionId);
    }
  }

  closeMobile(mobileSend: MobileSend): number {
    let closedSessions = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.mobileSend !== mobileSend) {
        continue;
      }

      session.mobileSend = null;
      this.scheduleDetachedSessionClose(sessionId);
      closedSessions++;
    }

    return closedSessions;
  }

  private resumeSession(deviceId: string, mobileSend: MobileSend, sessionId: string): RemoteSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session ${sessionId}`);
    }
    if (session.deviceId !== deviceId) {
      throw new Error(`Session ${sessionId} is not for device ${deviceId}`);
    }
    if (!this.agents.get(deviceId)) {
      throw new Error(`Device ${deviceId} is not online`);
    }

    session.mobileSend = mobileSend;
    this.clearDetachedSessionTimer(session);
    return {
      sessionId: session.sessionId,
      deviceId: session.deviceId
    };
  }

  private scheduleDetachedSessionClose(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.clearDetachedSessionTimer(session);
    session.detachedRetentionTimer = setTimeout(() => {
      const current = this.sessions.get(sessionId);
      if (!current || current.mobileSend) {
        return;
      }

      const agentSend = this.agents.get(current.deviceId);
      if (agentSend) {
        try {
          agentSend({
            type: "terminal.close",
            sessionId
          });
        } catch {
          // The session is already detached from Mobile; timeout cleanup should continue even if Agent send fails.
        }
      }

      this.deleteSession(sessionId);
    }, this.detachedSessionRetentionMs);
  }

  private deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.clearDetachedSessionTimer(session);
    }
    this.sessions.delete(sessionId);
  }

  private clearDetachedSessionTimer(session: SessionRecord): void {
    if (!session.detachedRetentionTimer) {
      return;
    }

    clearTimeout(session.detachedRetentionTimer);
    session.detachedRetentionTimer = undefined;
  }
}
