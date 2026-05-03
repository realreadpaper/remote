import { describe, expect, it } from "vitest";
import { terminalShortcutPayloads } from "../src/components/terminalShortcuts";

describe("terminal shortcuts", () => {
  it("maps mobile shortcut buttons to terminal actions", () => {
    expect(terminalShortcutPayloads).toEqual([
      { label: "Tab", type: "input", payload: "\t" },
      { label: "Esc", type: "input", payload: "\x1b" },
      { label: "Ctrl+C", type: "signal", signal: "SIGINT" },
      { label: "↑", type: "input", payload: "\x1b[A" },
      { label: "↓", type: "input", payload: "\x1b[B" },
      { label: "←", type: "input", payload: "\x1b[D" },
      { label: "→", type: "input", payload: "\x1b[C" }
    ]);
  });
});
