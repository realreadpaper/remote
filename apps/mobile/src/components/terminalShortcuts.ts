export interface TerminalShortcut {
  label: string;
  payload: string;
}

export const terminalShortcutPayloads: readonly TerminalShortcut[] = [
  { label: "Tab", payload: "\t" },
  { label: "Esc", payload: "\x1b" },
  { label: "Ctrl+C", payload: "\x03" },
  { label: "↑", payload: "\x1b[A" },
  { label: "↓", payload: "\x1b[B" },
  { label: "←", payload: "\x1b[D" },
  { label: "→", payload: "\x1b[C" }
];
