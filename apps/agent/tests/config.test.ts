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
    process.env.SHELL = "/bin/bash";

    expect(loadAgentConfig()).toEqual({
      serverUrl: "ws://relay.example.test/ws/agent",
      deviceId: "mac-123",
      deviceName: "Build Mac",
      shell: "/bin/bash"
    });
  });

  it("uses defaults when agent environment variables are absent", () => {
    delete process.env.REMOTE_SERVER_URL;
    delete process.env.REMOTE_DEVICE_ID;
    delete process.env.REMOTE_DEVICE_NAME;
    delete process.env.SHELL;

    expect(loadAgentConfig()).toEqual({
      serverUrl: "ws://127.0.0.1:8787/ws/agent",
      deviceId: `${os.hostname()}-dev`,
      deviceName: os.hostname(),
      shell: "/bin/zsh"
    });
  });
});
