import { describe, expect, it } from "vitest";
import { createTerminalState, type TerminalSnapshot } from "../src/state/terminalStore";

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

  it("keeps store state unchanged when a returned snapshot is mutated", () => {
    const state = createTerminalState();
    state.appendOutput("hello");

    const snapshot = state.getSnapshot() as TerminalSnapshot;
    snapshot.output = "tampered";

    expect(state.getSnapshot().output).toBe("hello");
  });

  it("tracks connected state", () => {
    const state = createTerminalState();
    state.setConnected(true);

    expect(state.getSnapshot().connected).toBe(true);
  });

  it("tracks the latest connection error and clears it after reconnecting", () => {
    const state = createTerminalState();

    state.setConnectionError("Server unreachable: connect ECONNREFUSED");
    expect(state.getSnapshot().connectionError).toBe("Server unreachable: connect ECONNREFUSED");

    state.setConnected(true);
    expect(state.getSnapshot().connectionError).toBeNull();
  });

  it("does not append another newline when submitted input already ends with one", () => {
    const state = createTerminalState();
    state.setInput("pwd\n");

    expect(state.submitInput()).toBe("pwd\n");
  });

  it("returns a newline when submitting again after input is cleared", () => {
    const state = createTerminalState();
    state.setInput("pwd");
    state.submitInput();

    expect(state.submitInput()).toBe("\n");
  });
});
