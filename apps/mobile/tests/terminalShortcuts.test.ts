import { describe, expect, it } from "vitest";
import { terminalShortcutPayloads } from "../src/components/terminalShortcuts";

describe("terminal shortcuts", () => {
  it("maps mobile shortcut buttons to PTY control payloads", () => {
    expect(terminalShortcutPayloads).toEqual([
      { label: "Tab", payload: "\t" },
      { label: "Esc", payload: "\x1b" },
      { label: "Ctrl+C", payload: "\x03" },
      { label: "↑", payload: "\x1b[A" },
      { label: "↓", payload: "\x1b[B" },
      { label: "←", payload: "\x1b[D" },
      { label: "→", payload: "\x1b[C" }
    ]);
  });
});
