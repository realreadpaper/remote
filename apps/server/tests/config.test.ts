import { describe, expect, it } from "vitest";
import { loadServerConfig } from "../src/config.js";

describe("loadServerConfig", () => {
  it("uses local development defaults", () => {
    expect(loadServerConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8787,
      requireDevToken: false,
      devToken: null,
      publicBaseUrl: null,
      dataDir: null,
      databaseUrl: null,
      redisUrl: null,
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 120,
      wsMessageRateLimitWindowMs: 10_000,
      wsMessageRateLimitMaxRequests: 200,
      terminalInputMaxBytes: 16_384,
      wsRawMessageMaxBytes: 65_536,
      agentOutputRateLimitWindowMs: 10_000,
      agentOutputRateLimitMaxMessages: 1000,
      agentOutputByteRateLimitWindowMs: 10_000,
      agentOutputByteRateLimitMaxBytes: 1_048_576,
      mobileInputByteRateLimitWindowMs: 10_000,
      mobileInputByteRateLimitMaxBytes: 262_144
    });
  });

  it("loads explicit cloud relay environment values", () => {
    expect(
      loadServerConfig({
        HOST: "0.0.0.0",
        PORT: "9443",
        REMOTE_REQUIRE_DEV_TOKEN: "1",
        REMOTE_DEV_TOKEN: "secret",
        REMOTE_PUBLIC_BASE_URL: "https://dev-api.example.com",
        REMOTE_DATA_DIR: "/var/lib/remote",
        DATABASE_URL: "postgres://remote:secret@postgres.internal:5432/remote",
        REDIS_URL: "redis://redis.internal:6379",
        REMOTE_HTTP_RATE_LIMIT_WINDOW_MS: "30000",
        REMOTE_HTTP_RATE_LIMIT_MAX: "30",
        REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS: "5000",
        REMOTE_WS_MESSAGE_RATE_LIMIT_MAX: "50",
        REMOTE_TERMINAL_INPUT_MAX_BYTES: "4096",
        REMOTE_WS_RAW_MESSAGE_MAX_BYTES: "8192",
        REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS: "5000",
        REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX: "50",
        REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS: "5000",
        REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX: "4096",
        REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS: "5000",
        REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX: "4096"
      })
    ).toEqual({
      host: "0.0.0.0",
      port: 9443,
      requireDevToken: true,
      devToken: "secret",
      publicBaseUrl: "https://dev-api.example.com",
      dataDir: "/var/lib/remote",
      databaseUrl: "postgres://remote:secret@postgres.internal:5432/remote",
      redisUrl: "redis://redis.internal:6379",
      rateLimitWindowMs: 30_000,
      rateLimitMaxRequests: 30,
      wsMessageRateLimitWindowMs: 5_000,
      wsMessageRateLimitMaxRequests: 50,
      terminalInputMaxBytes: 4_096,
      wsRawMessageMaxBytes: 8_192,
      agentOutputRateLimitWindowMs: 5_000,
      agentOutputRateLimitMaxMessages: 50,
      agentOutputByteRateLimitWindowMs: 5_000,
      agentOutputByteRateLimitMaxBytes: 4_096,
      mobileInputByteRateLimitWindowMs: 5_000,
      mobileInputByteRateLimitMaxBytes: 4_096
    });
  });

  it("derives public base URL from relay host", () => {
    expect(loadServerConfig({ REMOTE_RELAY_HOST: "relay.example.test" })).toMatchObject({
      publicBaseUrl: "https://relay.example.test"
    });
  });

  it("rejects placeholder release public URLs", () => {
    expect(() =>
      loadServerConfig({
        REMOTE_RELEASE: "1",
        REMOTE_RELAY_HOST: "remote-terminal.example.invalid",
        REMOTE_REQUIRE_DEV_TOKEN: "1",
        REMOTE_DEV_TOKEN: "secret"
      })
    ).toThrow("Release server endpoint must not use placeholder host remote-terminal.example.invalid");
    expect(() =>
      loadServerConfig({
        REMOTE_RELEASE: "1",
        REMOTE_PUBLIC_BASE_URL: "https://api.example.com",
        REMOTE_REQUIRE_DEV_TOKEN: "1",
        REMOTE_DEV_TOKEN: "secret"
      })
    ).toThrow("Release server endpoint must not use placeholder host api.example.com");
  });

  it("requires dev token guard for release server mode", () => {
    expect(() =>
      loadServerConfig({
        REMOTE_RELEASE: "1",
        REMOTE_RELAY_HOST: "relay.example.test",
        REMOTE_DEV_TOKEN: "secret"
      })
    ).toThrow("REMOTE_REQUIRE_DEV_TOKEN=1 is required when REMOTE_RELEASE=1");
  });

  it("rejects an invalid port", () => {
    expect(() => loadServerConfig({ PORT: "not-a-number" })).toThrow("PORT must be a valid TCP port");
    expect(() => loadServerConfig({ PORT: "70000" })).toThrow("PORT must be a valid TCP port");
  });

  it("requires REMOTE_DEV_TOKEN when dev token guard is enabled", () => {
    expect(() => loadServerConfig({ REMOTE_REQUIRE_DEV_TOKEN: "1" })).toThrow(
      "REMOTE_DEV_TOKEN is required when REMOTE_REQUIRE_DEV_TOKEN=1"
    );
  });

  it("rejects invalid datastore URLs", () => {
    expect(() => loadServerConfig({ DATABASE_URL: "not a url" })).toThrow("DATABASE_URL must be a valid URL");
    expect(() => loadServerConfig({ REDIS_URL: "not a url" })).toThrow("REDIS_URL must be a valid URL");
  });

  it("rejects invalid HTTP rate limit config", () => {
    expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
      "REMOTE_HTTP_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
      "REMOTE_HTTP_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_MAX: "0" })).toThrow(
      "REMOTE_HTTP_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_HTTP_RATE_LIMIT_MAX: "abc" })).toThrow(
      "REMOTE_HTTP_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
      "REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
      "REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_MAX: "0" })).toThrow(
      "REMOTE_WS_MESSAGE_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_WS_MESSAGE_RATE_LIMIT_MAX: "abc" })).toThrow(
      "REMOTE_WS_MESSAGE_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_TERMINAL_INPUT_MAX_BYTES: "0" })).toThrow(
      "REMOTE_TERMINAL_INPUT_MAX_BYTES must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_TERMINAL_INPUT_MAX_BYTES: "abc" })).toThrow(
      "REMOTE_TERMINAL_INPUT_MAX_BYTES must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_WS_RAW_MESSAGE_MAX_BYTES: "0" })).toThrow(
      "REMOTE_WS_RAW_MESSAGE_MAX_BYTES must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_WS_RAW_MESSAGE_MAX_BYTES: "abc" })).toThrow(
      "REMOTE_WS_RAW_MESSAGE_MAX_BYTES must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
      "REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
      "REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX: "0" })).toThrow(
      "REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX: "abc" })).toThrow(
      "REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
      "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
      "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX: "0" })).toThrow(
      "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX: "abc" })).toThrow(
      "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS: "999" })).toThrow(
      "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS: "abc" })).toThrow(
      "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS must be an integer greater than or equal to 1000"
    );
    expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX: "0" })).toThrow(
      "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
    );
    expect(() => loadServerConfig({ REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX: "abc" })).toThrow(
      "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX must be a positive integer"
    );
  });
});
