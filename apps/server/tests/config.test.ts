import { describe, expect, it } from "vitest";
import { loadServerConfig } from "../src/config.js";

describe("loadServerConfig", () => {
  it("uses local development defaults", () => {
    expect(loadServerConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8787,
      requireDevToken: false,
      devToken: null,
      publicBaseUrl: null
    });
  });

  it("loads explicit cloud relay environment values", () => {
    expect(
      loadServerConfig({
        HOST: "0.0.0.0",
        PORT: "9443",
        REMOTE_REQUIRE_DEV_TOKEN: "1",
        REMOTE_DEV_TOKEN: "secret",
        REMOTE_PUBLIC_BASE_URL: "https://dev-api.example.com"
      })
    ).toEqual({
      host: "0.0.0.0",
      port: 9443,
      requireDevToken: true,
      devToken: "secret",
      publicBaseUrl: "https://dev-api.example.com"
    });
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
});
