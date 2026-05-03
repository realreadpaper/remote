import { describe, expect, it } from "vitest";
import type { AgentConfig } from "@remote/agent/config";
import {
  createInitialDesktopState,
  withConnectionStatus,
  withPairingCreated,
  withPairingDecision,
  withPairingRequest,
  withTerminalEnabled
} from "../src/desktopState.js";

const config: AgentConfig = {
  serverUrl: "ws://127.0.0.1:8787/ws/agent",
  deviceId: "mac-1",
  deviceName: "MacBook Pro",
  devToken: null,
  capabilities: ["terminal"],
  shell: "/bin/zsh",
  terminalOutputChunkBytes: 16_384
};

describe("desktopState", () => {
  it("creates initial state from agent config", () => {
    expect(createInitialDesktopState(config)).toMatchObject({
      deviceName: "MacBook Pro",
      deviceId: "mac-1",
      serverUrl: "ws://127.0.0.1:8787/ws/agent",
      shell: "/bin/zsh",
      terminalEnabled: true,
      connectionStatus: "stopped",
      statusMessage: "Agent is stopped.",
      pairingCode: null,
      pairingQrDataUrl: null,
      pairingExpiresAt: null,
      pendingPairingRequest: null
    });
  });

  it("updates connection status and message", () => {
    const state = createInitialDesktopState(config);

    expect(withConnectionStatus(state, "online", "Connected to relay.")).toMatchObject({
      connectionStatus: "online",
      statusMessage: "Connected to relay."
    });
  });

  it("stores pairing code and QR data URL", () => {
    const state = createInitialDesktopState(config);

    expect(
      withPairingCreated(state, {
        type: "pairing.created",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        pairingCode: "123456",
        serverUrl: "http://127.0.0.1:8787",
        expiresAt: "2026-05-03T10:00:00.000Z"
      }, "data:image/png;base64,abc")
    ).toMatchObject({
      pairingCode: "123456",
      pairingQrDataUrl: "data:image/png;base64,abc",
      pairingExpiresAt: "2026-05-03T10:00:00.000Z"
    });
  });

  it("stores pending pairing requests", () => {
    const state = createInitialDesktopState(config);

    expect(
      withPairingRequest(state, {
        type: "pairing.requested",
        pairingRequestId: "request-1",
        deviceId: "mac-1",
        mobileClientId: "mobile-1",
        mobileName: "iPhone",
        requestedAt: "2026-05-03T10:01:00.000Z"
      }).pendingPairingRequest
    ).toEqual({
      pairingRequestId: "request-1",
      mobileClientId: "mobile-1",
      mobileName: "iPhone",
      requestedAt: "2026-05-03T10:01:00.000Z"
    });
  });

  it("clears pending pairing request after a decision", () => {
    const state = withPairingRequest(createInitialDesktopState(config), {
      type: "pairing.requested",
      pairingRequestId: "request-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      mobileName: "iPhone",
      requestedAt: "2026-05-03T10:01:00.000Z"
    });

    expect(withPairingDecision(state).pendingPairingRequest).toBeNull();
  });

  it("updates terminal enabled state", () => {
    const state = createInitialDesktopState(config);

    expect(withTerminalEnabled(state, false)).toMatchObject({
      terminalEnabled: false
    });
  });
});
