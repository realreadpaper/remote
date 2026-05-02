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
    process.env.SHELL = "/bin/bash";

    expect(loadAgentConfig()).toEqual({
      serverUrl: "ws://relay.example.test/ws/agent",
      deviceId: "mac-123",
      deviceName: "Build Mac",
      devToken: "secret",
      shell: "/bin/bash"
    });
  });

  it("uses defaults when agent environment variables are absent", () => {
    delete process.env.REMOTE_SERVER_URL;
    delete process.env.REMOTE_DEVICE_ID;
    delete process.env.REMOTE_DEVICE_NAME;
    delete process.env.REMOTE_DEV_TOKEN;
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
      shell: "/bin/zsh"
    });
  });
});
