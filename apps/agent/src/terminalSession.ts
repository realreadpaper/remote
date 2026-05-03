export interface PtyAdapter {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(callback: (data: string) => void): void;
  onExit(callback: (exitCode: number | null) => void): void;
}

export class TerminalSession {
  constructor(
    readonly sessionId: string,
    private readonly pty: PtyAdapter
  ) {}

  write(data: string): void {
    this.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    this.pty.resize(cols, rows);
  }

  sendSignal(signal: "SIGINT" | "EOF"): void {
    this.pty.write(signal === "SIGINT" ? "\x03" : "\x04");
  }

  onOutput(callback: (data: string) => void): void {
    this.pty.onData(callback);
  }

  onExit(callback: (exitCode: number | null) => void): void {
    this.pty.onExit(callback);
  }

  close(): void {
    this.pty.kill();
  }
}
