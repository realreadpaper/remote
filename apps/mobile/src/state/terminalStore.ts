export interface TerminalSnapshot {
  output: string;
  input: string;
  connected: boolean;
  connectionError: string | null;
}

export function createTerminalState() {
  let snapshot: TerminalSnapshot = {
    output: "",
    input: "",
    connected: false,
    connectionError: null
  };

  return {
    appendOutput(data: string): void {
      snapshot = {
        ...snapshot,
        output: snapshot.output + data
      };
    },
    setInput(input: string): void {
      snapshot = {
        ...snapshot,
        input
      };
    },
    setConnected(connected: boolean): void {
      snapshot = {
        ...snapshot,
        connected,
        connectionError: connected ? null : snapshot.connectionError
      };
    },
    setConnectionError(connectionError: string | null): void {
      snapshot = {
        ...snapshot,
        connectionError
      };
    },
    submitInput(): string {
      const command = snapshot.input.endsWith("\n") ? snapshot.input : `${snapshot.input}\n`;
      snapshot = {
        ...snapshot,
        input: ""
      };
      return command;
    },
    getSnapshot(): Readonly<TerminalSnapshot> {
      return { ...snapshot };
    }
  };
}
