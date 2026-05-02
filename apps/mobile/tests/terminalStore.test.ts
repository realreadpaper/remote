import { describe, expect, it } from "vitest";
import { createTerminalState } from "../src/state/terminalStore";

describe("terminal store", () => {
  it("appends output chunks in order", () => {
    const state = createTerminalState();
    state.appendOutput("hello");
    state.appendOutput(" world");

    expect(state.getSnapshot().output).toBe("hello world");
  });

  it("tracks current input", () => {
    const state = createTerminalState();
    state.setInput("git status");

    expect(state.getSnapshot().input).toBe("git status");
  });

  it("clears input after submit", () => {
    const state = createTerminalState();
    state.setInput("pwd");
    const command = state.submitInput();

    expect(command).toBe("pwd\n");
    expect(state.getSnapshot().input).toBe("");
  });
});
