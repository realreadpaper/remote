import { describe, expect, it, vi } from "vitest";
import type { AgentClientDependencies } from "@remote/agent/agentClient";
import type { AgentConfig } from "@remote/agent/config";
import { AgentDesktopRuntime } from "../src/agentDesktopRuntime.js";

const config: AgentConfig = {
  serverUrl: "ws://127.0.0.1:8787/ws/agent",
  deviceId: "mac-1",
  deviceName: "MacBook Pro",
  devToken: null,
  capabilities: ["terminal"],
  autoApprovePairing: false,
  shell: "/bin/zsh",
  terminalOutputChunkBytes: 16_384
};

const createRuntime = () => {
  const client = {
    connect: vi.fn(),
    close: vi.fn()
  };
  let agentDependencies: AgentClientDependencies | undefined;
  const onStateChange = vi.fn();
  const createAgentClient = vi.fn((dependencies: AgentClientDependencies) => {
    agentDependencies = dependencies;
    return client;
  });
  const createQrDataUrl = vi.fn(async (payload: string) => `qr:${payload}`);
  const runtime = new AgentDesktopRuntime(config, {
    createAgentClient,
    createQrDataUrl,
    onStateChange
  });

  return { runtime, client, createAgentClient, createQrDataUrl, onStateChange, getAgentDependencies: () => agentDependencies };
};

describe("AgentDesktopRuntime", () => {
  it("starts an AgentClient and connects it", () => {
    const { runtime, client, createAgentClient } = createRuntime();

    runtime.start();

    expect(createAgentClient).toHaveBeenCalledOnce();
    expect(client.connect).toHaveBeenCalledOnce();
    expect(runtime.getState()).toMatchObject({
      terminalEnabled: true,
      connectionStatus: "connecting"
    });
  });

  it("stops the AgentClient and disables terminal capability", () => {
    const { runtime, client } = createRuntime();

    runtime.start();
    runtime.stop();

    expect(client.close).toHaveBeenCalledOnce();
    expect(runtime.getState()).toMatchObject({
      terminalEnabled: false,
      connectionStatus: "stopped"
    });
  });

  it("starts and stops through setTerminalEnabled", () => {
    const { runtime, client } = createRuntime();

    runtime.setTerminalEnabled(true);
    expect(client.connect).toHaveBeenCalledOnce();

    runtime.setTerminalEnabled(false);
    expect(client.close).toHaveBeenCalledOnce();
    expect(runtime.getState().terminalEnabled).toBe(false);
  });

  it("updates state when pairing code is created", async () => {
    const { runtime, createQrDataUrl } = createRuntime();

    await runtime.handlePairingCreated({
      type: "pairing.created",
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      pairingCode: "123456",
      serverUrl: "http://127.0.0.1:8787",
      expiresAt: "2026-05-03T10:00:00.000Z"
    });

    expect(createQrDataUrl).toHaveBeenCalledWith(
      JSON.stringify({
        serverUrl: "http://127.0.0.1:8787",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        pairingCode: "123456",
        expiresAt: "2026-05-03T10:00:00.000Z"
      })
    );
    expect(runtime.getState()).toMatchObject({
      connectionStatus: "online",
      pairingCode: "123456",
      pairingQrDataUrl: "qr:{\"serverUrl\":\"http://127.0.0.1:8787\",\"deviceId\":\"mac-1\",\"deviceName\":\"MacBook Pro\",\"pairingCode\":\"123456\",\"expiresAt\":\"2026-05-03T10:00:00.000Z\"}"
    });
  });

  it("resolves pending pairing request as approved", async () => {
    const { runtime } = createRuntime();

    const decision = runtime.handlePairingRequested({
      type: "pairing.requested",
      pairingRequestId: "request-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      mobileName: "iPhone",
      requestedAt: "2026-05-03T10:01:00.000Z"
    });

    expect(runtime.getState().pendingPairingRequest).toMatchObject({
      pairingRequestId: "request-1",
      mobileName: "iPhone"
    });

    runtime.approvePairing();

    await expect(decision).resolves.toEqual({ approved: true });
    expect(runtime.getState().pendingPairingRequest).toBeNull();
  });

  it("resolves pending pairing request as rejected", async () => {
    const { runtime } = createRuntime();

    const decision = runtime.handlePairingRequested({
      type: "pairing.requested",
      pairingRequestId: "request-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      mobileName: "iPhone",
      requestedAt: "2026-05-03T10:01:00.000Z"
    });

    runtime.rejectPairing();

    await expect(decision).resolves.toEqual({
      approved: false,
      reason: "Pairing rejected in desktop agent"
    });
    expect(runtime.getState().pendingPairingRequest).toBeNull();
  });

  it("wires AgentClient pairing callbacks to runtime handlers", async () => {
    const { runtime, getAgentDependencies } = createRuntime();

    runtime.start();
    const dependencies = getAgentDependencies();
    expect(dependencies?.displayPairingCode).toBeDefined();
    expect(dependencies?.approvePairingRequest).toBeDefined();

    dependencies?.displayPairingCode?.({
      type: "pairing.created",
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      pairingCode: "123456",
      serverUrl: "http://127.0.0.1:8787",
      expiresAt: "2026-05-03T10:00:00.000Z"
    });
    await Promise.resolve();

    expect(runtime.getState().pairingCode).toBe("123456");
  });
});
