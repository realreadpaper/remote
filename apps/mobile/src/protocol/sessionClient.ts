import { encodeMessage, parseServerMessage } from "@remote/protocol";
import type { ServerMessage } from "@remote/protocol";

export interface WebSocketLike {
  readonly OPEN?: number;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event?: { reason?: string }) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface SessionClientOptions {
  url: string;
  deviceId: string;
  onMessage(message: ServerMessage): void;
  onDisconnect?(reason: string): void;
  createSocket?: (url: string) => WebSocketLike;
}

export class SessionClient {
  private readonly options: SessionClientOptions;
  private socket: WebSocketLike | null = null;
  private sessionId: string | null = null;

  constructor(options: SessionClientOptions) {
    this.options = options;
  }

  connect(): void {
    this.closeCurrentSocket();
    this.sessionId = null;
    const socket = this.createSocket();
    this.socket = socket;

    socket.onopen = () => {
      if (!this.isCurrentSocket(socket)) {
        return;
      }

      try {
        socket.send(encodeMessage({ type: "session.open", deviceId: this.options.deviceId }));
      } catch (error) {
        console.error("Failed to open remote terminal session.", error);
        this.handleDisconnect(socket, this.reasonFromError(error, "Failed to open remote terminal session."));
      }
    };

    socket.onmessage = (event) => {
      if (!this.isCurrentSocket(socket)) {
        return;
      }

      this.handleMessage(socket, event.data);
    };

    socket.onclose = (event) => {
      this.handleDisconnect(socket, event?.reason || "Socket closed.");
    };

    socket.onerror = (event) => {
      this.handleDisconnect(socket, this.reasonFromError(event, "Socket error."));
    };
  }

  close(): void {
    this.sessionId = null;
    this.closeCurrentSocket();
  }

  sendTerminalInput(data: string): void {
    if (!this.sessionId) {
      throw new Error("Cannot send terminal input: terminal session is not open.");
    }

    const socket = this.socket;
    if (!socket) {
      throw new Error("Cannot send terminal input: WebSocket is not connected.");
    }

    if (socket.readyState !== this.openReadyState(socket)) {
      throw new Error("Cannot send terminal input: WebSocket is not open.");
    }

    try {
      socket.send(encodeMessage({ type: "terminal.input", sessionId: this.sessionId, data }));
    } catch (error) {
      throw new Error(
        `Cannot send terminal input: ${error instanceof Error ? error.message : "WebSocket send failed."}`
      );
    }
  }

  private createSocket(): WebSocketLike {
    if (this.options.createSocket) {
      return this.options.createSocket(this.options.url);
    }

    const WebSocketConstructor = (globalThis as { WebSocket?: new (url: string) => unknown }).WebSocket;
    if (!WebSocketConstructor) {
      throw new Error("Cannot connect: WebSocket is not available in this environment.");
    }

    return new WebSocketConstructor(this.options.url) as WebSocketLike;
  }

  private handleMessage(socket: WebSocketLike, data: unknown): void {
    try {
      const message = parseServerMessage(typeof data === "string" ? JSON.parse(data) : data);

      if (!this.isCurrentSocket(socket)) {
        return;
      }

      if (message.type === "session.opened") {
        this.sessionId = message.sessionId;
      }

      this.options.onMessage(message);
    } catch (error) {
      console.error("Invalid server message ignored.", error);
    }
  }

  private openReadyState(socket: WebSocketLike): number {
    return socket.OPEN ?? 1;
  }

  private handleDisconnect(socket: WebSocketLike, reason: string): void {
    if (!this.isCurrentSocket(socket)) {
      return;
    }

    this.sessionId = null;
    this.detachSocket(socket);
    this.socket = null;
    this.options.onDisconnect?.(reason);
  }

  private closeCurrentSocket(): void {
    const socket = this.socket;
    if (!socket) {
      return;
    }

    this.detachSocket(socket);
    this.socket = null;
    try {
      socket.close();
    } catch (error) {
      console.error("Failed to close remote terminal socket.", error);
    }
  }

  private detachSocket(socket: WebSocketLike): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
  }

  private isCurrentSocket(socket: WebSocketLike): boolean {
    return this.socket === socket;
  }

  private reasonFromError(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
