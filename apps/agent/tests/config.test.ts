import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAgentConfig } from "../src/config.js";

const originalEnv = process.env;

describe("loadAgentConfig", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses agent environment variables when they are set", () => {
    process.env.REMOTE_SERVER_URL = "ws://relay.example.test/ws/agent";
    process.env.REMOTE_DEVICE_ID = "mac-123";
    process.env.REMOTE_DEVICE_NAME = "Build Mac";
    process.env.REMOTE_DEV_TOKEN = "secret";
    process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES = "4096";
    process.env.REMOTE_ENABLE_TERMINAL = "0";
    process.env.SHELL = "/bin/bash";

    expect(loadAgentConfig()).toEqual({
      serverUrl: "ws://relay.example.test/ws/agent",
      deviceId: "mac-123",
      deviceName: "Build Mac",
      devToken: "secret",
      capabilities: [],
      terminalOutputChunkBytes: 4_096,
      shell: "/bin/bash"
    });
  });

  it("uses defaults when agent environment variables are absent", () => {
    delete process.env.REMOTE_SERVER_URL;
    delete process.env.REMOTE_DEVICE_ID;
    delete process.env.REMOTE_DEVICE_NAME;
    delete process.env.REMOTE_DEV_TOKEN;
    delete process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES;
    delete process.env.REMOTE_ENABLE_TERMINAL;
    delete process.env.SHELL;

    expect(
      loadAgentConfig({
        loadIdentity: () => ({
          version: 1,
          deviceId: "persistent-device-id",
          publicKey: "public-key",
          privateKey: "private-key",
          createdAt: "2026-05-03T00:00:00.000Z"
        })
      })
    ).toEqual({
      serverUrl: "ws://127.0.0.1:8787/ws/agent",
      deviceId: "persistent-device-id",
      deviceName: os.hostname(),
      devToken: null,
      capabilities: ["terminal"],
      terminalOutputChunkBytes: 16_384,
      shell: "/bin/zsh"
    });
  });

  it("rejects invalid terminal capability toggle values", () => {
    process.env.REMOTE_ENABLE_TERMINAL = "false";

    expect(() => loadAgentConfig()).toThrow("REMOTE_ENABLE_TERMINAL must be 1 or 0");
  });

  it("rejects invalid terminal output chunk bytes", () => {
    process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES = "0";
    expect(() => loadAgentConfig()).toThrow("REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES must be a positive integer");

    process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES = "abc";
    expect(() => loadAgentConfig()).toThrow("REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES must be a positive integer");
  });
});
