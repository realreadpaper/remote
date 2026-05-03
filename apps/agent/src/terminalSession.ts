import type { ServerMessage } from "@remote/protocol";

export interface PtyAdapter {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(callback: (data: string) => void): void;
  onExit(callback: (exitCode: number | null) => void): void;
}

export interface TerminalSessionOptions {
  maxSnapshotChunks?: number;
  cols?: number;
  rows?: number;
}

type TerminalSnapshot = Extract<ServerMessage, { type: "terminal.snapshot" }>;

export class TerminalSession {
  private readonly maxSnapshotChunks: number;
  private readonly output: string[] = [];
  private cols: number;
  private rows: number;
  private alive = true;
  private exitCode: number | null = null;

  constructor(
    readonly sessionId: string,
    private readonly pty: PtyAdapter,
    options: TerminalSessionOptions = {}
  ) {
    this.maxSnapshotChunks = options.maxSnapshotChunks ?? 200;
    this.cols = options.cols ?? 100;
    this.rows = options.rows ?? 30;
  }

  write(data: string): void {
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.pty.resize(cols, rows);
  }

  sendSignal(signal: "SIGINT" | "EOF"): void {
    this.pty.write(signal === "SIGINT" ? "\x03" : "\x04");
  }

  onOutput(callback: (data: string) => void): void {
    this.pty.onData((data) => {
      this.output.push(data);
      if (this.output.length > this.maxSnapshotChunks) {
        this.output.splice(0, this.output.length - this.maxSnapshotChunks);
      }

      callback(data);
    });
  }

  onExit(callback: (exitCode: number | null) => void): void {
    this.pty.onExit((exitCode) => {
      this.alive = false;
      this.exitCode = exitCode;
      callback(exitCode);
    });
  }

  snapshot(deviceId: string): TerminalSnapshot {
    return {
      type: "terminal.snapshot",
      sessionId: this.sessionId,
      deviceId,
      output: [...this.output],
      alive: this.alive,
      exitCode: this.exitCode,
      cols: this.cols,
      rows: this.rows
    };
  }

  close(): void {
    this.pty.kill();
  }
}
