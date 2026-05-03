export interface TerminalShortcut {
  label: string;
}

export type TerminalShortcutAction =
  | (TerminalShortcut & { type: "input"; payload: string })
  | (TerminalShortcut & { type: "signal"; signal: "SIGINT" | "EOF" });

export const terminalShortcutPayloads: readonly TerminalShortcutAction[] = [
  { label: "Tab", type: "input", payload: "\t" },
  { label: "Esc", type: "input", payload: "\x1b" },
  { label: "Ctrl+C", type: "signal", signal: "SIGINT" },
  { label: "↑", type: "input", payload: "\x1b[A" },
  { label: "↓", type: "input", payload: "\x1b[B" },
  { label: "←", type: "input", payload: "\x1b[D" },
  { label: "→", type: "input", payload: "\x1b[C" }
];
