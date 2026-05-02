import { Buffer } from "node:buffer";
import * as pty from "node-pty";
import WebSocket from "ws";
import {
  encodeMessage,
  parseClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage
} from "@remote/protocol";
import type { AgentConfig } from "./config.js";
import { TerminalSession, type PtyAdapter } from "./terminalSession.js";

export interface AgentSocket {
  readonly readyState?: number;
  send(data: string): void;
  on(event: "open", callback: () => void): void;
  on(event: "message", callback: (data: unknown) => void): void;
  on(event: "close", callback: () => void): void;
  on(event: "error", callback: (error: Error) => void): void;
}

interface AgentClientDependencies {
  createSocket?: (url: string) => AgentSocket;
  createTerminal?: (sessionId: string, config: AgentConfig) => TerminalSession;
}

type AgentOutboundMessage = Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>;

function createDefaultSocket(url: string): AgentSocket {
  return new WebSocket(url) as AgentSocket;
}

function createDefaultTerminal(sessionId: string, config: AgentConfig): TerminalSession {
  const terminal = pty.spawn(config.shell, [], {
    cols: 100,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  const adapter: PtyAdapter = {
    write: (data) => terminal.write(data),
    resize: (cols, rows) => terminal.resize(cols, rows),
    kill: () => terminal.kill(),
    onData: (callback) => {
      terminal.onData(callback);
    },
    onExit: (callback) => {
      terminal.onExit(({ exitCode }) => callback(exitCode));
    }
  };

  return new TerminalSession(sessionId, adapter);
}

function parseJson(data: unknown): unknown {
  if (typeof data === "string") {
    return JSON.parse(data);
  }

  if (Buffer.isBuffer(data)) {
    return JSON.parse(data.toString());
  }

  if (data instanceof ArrayBuffer) {
    return JSON.parse(Buffer.from(data).toString());
  }

  if (Array.isArray(data) && data.every(Buffer.isBuffer)) {
    return JSON.parse(Buffer.concat(data).toString());
  }

  return JSON.parse(String(data));
}

function messageType(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    return undefined;
  }

  const type = (payload as { type: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

export class AgentClient {
  private socket?: AgentSocket;
  private readonly sessions = new Map<string, TerminalSession>();
  private readonly createSocket: (url: string) => AgentSocket;
  private readonly createTerminal: (sessionId: string, config: AgentConfig) => TerminalSession;

  constructor(
    private readonly config: AgentConfig,
    dependencies: AgentClientDependencies = {}
  ) {
    this.createSocket = dependencies.createSocket ?? createDefaultSocket;
    this.createTerminal = dependencies.createTerminal ?? createDefaultTerminal;
  }

  connect(): void {
    const socket = this.createSocket(this.config.serverUrl);
    this.socket = socket;

    socket.on("open", () => {
      this.sendMessage({
        type: "device.register",
        deviceId: this.config.deviceId,
        deviceName: this.config.deviceName,
        capabilities: ["terminal"]
      });
    });

    socket.on("message", (data) => {
      this.handleMessage(data);
    });

    socket.on("close", () => {
      this.closeSessions();
    });

    socket.on("error", (error) => {
      console.error("Agent socket error", error);
      this.closeSessions();
    });
  }

  private handleMessage(data: unknown): void {
    try {
      const payload = parseJson(data);

      switch (messageType(payload)) {
        case "session.opened":
          this.handleSessionOpened(parseServerMessage(payload));
          return;
        case "terminal.input":
          this.handleTerminalInput(parseClientMessage(payload));
          return;
        case "terminal.resize":
          this.handleTerminalResize(parseClientMessage(payload));
          return;
        case "terminal.close":
          this.handleTerminalClose(parseClientMessage(payload));
          return;
        case "device.registered":
          parseServerMessage(payload);
          return;
        case "session.error":
          console.error("Agent session error", parseServerMessage(payload));
          return;
        default:
          parseServerMessage(payload);
      }
    } catch (error) {
      console.error("Invalid agent server message", error);
    }
  }

  private handleSessionOpened(message: ServerMessage): void {
    if (message.type !== "session.opened") {
      return;
    }

    const existingSession = this.sessions.get(message.sessionId);
    if (existingSession) {
      this.sessions.delete(message.sessionId);
      existingSession.close();
    }

    const session = this.createTerminal(message.sessionId, this.config);
    session.onOutput((data) => {
      if (this.sessions.get(message.sessionId) !== session) {
        return;
      }

      this.sendMessage({
        type: "terminal.output",
        sessionId: message.sessionId,
        stream: "stdout",
        data
      });
    });
    session.onExit((exitCode) => {
      if (this.sessions.get(message.sessionId) !== session) {
        return;
      }

      this.sendMessage({
        type: "terminal.exit",
        sessionId: message.sessionId,
        exitCode
      });
      this.sessions.delete(message.sessionId);
    });

    this.sessions.set(message.sessionId, session);
  }

  private handleTerminalInput(message: ClientMessage): void {
    if (message.type !== "terminal.input") {
      return;
    }

    this.sessions.get(message.sessionId)?.write(message.data);
  }

  private handleTerminalResize(message: ClientMessage): void {
    if (message.type !== "terminal.resize") {
      return;
    }

    this.sessions.get(message.sessionId)?.resize(message.cols, message.rows);
  }

  private handleTerminalClose(message: ClientMessage): void {
    if (message.type !== "terminal.close") {
      return;
    }

    const session = this.sessions.get(message.sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(message.sessionId);
    try {
      session.close();
    } catch (error) {
      console.error("Failed to close terminal session", error);
    }
  }

  private sendMessage(message: ClientMessage | AgentOutboundMessage): void {
    const socket = this.socket;
    if (!socket) {
      return;
    }

    if (typeof socket.readyState === "number" && socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socket.send(encodeMessage(message));
    } catch (error) {
      console.error("Agent socket send failed", error);
      this.closeSessions();
    }
  }

  private closeSessions(): void {
    const sessions = Array.from(this.sessions.values());
    this.sessions.clear();

    for (const session of sessions) {
      try {
        session.close();
      } catch (error) {
        console.error("Failed to close terminal session", error);
      }
    }
  }
}
