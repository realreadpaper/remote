import { describe, expect, it } from "vitest";
import { loadMobileRuntimeConfig, shouldAutoConnectTerminal, tryLoadMobileRuntimeConfig } from "../src/config/runtimeConfig";

describe("mobile runtime config", () => {
  it("uses simulator-friendly defaults", () => {
    expect(loadMobileRuntimeConfig({})).toEqual({
      sessionUrl: "ws://127.0.0.1:8787/ws/mobile",
      displaySessionUrl: "ws://127.0.0.1:8787/ws/mobile",
      apiBaseUrl: "http://127.0.0.1:8787",
      displayApiBaseUrl: "http://127.0.0.1:8787",
      deviceId: "mac-dev",
      mobileClientId: "mobile-dev",
      mobileName: "iPhone",
      devToken: null,
      autoConnect: false,
      smokeCommand: null,
      autoPairingCode: null
    });
  });

  it("loads physical-device and smoke-test environment overrides", () => {
    expect(
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_WS_URL: "ws://192.168.1.20:8787/ws/mobile",
        EXPO_PUBLIC_REMOTE_API_URL: "http://192.168.1.20:8787",
        EXPO_PUBLIC_REMOTE_DEVICE_ID: "macbook",
        EXPO_PUBLIC_REMOTE_MOBILE_CLIENT_ID: "iphone-1",
        EXPO_PUBLIC_REMOTE_MOBILE_NAME: "Alice iPhone",
        EXPO_PUBLIC_REMOTE_AUTOCONNECT: "1",
        EXPO_PUBLIC_REMOTE_SMOKE_COMMAND: "printf hi",
        EXPO_PUBLIC_REMOTE_AUTO_PAIRING_CODE: "123456"
      })
    ).toEqual({
      sessionUrl: "ws://192.168.1.20:8787/ws/mobile",
      displaySessionUrl: "ws://192.168.1.20:8787/ws/mobile",
      apiBaseUrl: "http://192.168.1.20:8787",
      displayApiBaseUrl: "http://192.168.1.20:8787",
      deviceId: "macbook",
      mobileClientId: "iphone-1",
      mobileName: "Alice iPhone",
      devToken: null,
      autoConnect: true,
      smokeCommand: "printf hi",
      autoPairingCode: "123456"
    });
  });

  it("appends dev token to the session URL and redacts it for display", () => {
    expect(
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_WS_URL: "ws://relay.example.test/ws/mobile",
        EXPO_PUBLIC_REMOTE_DEV_TOKEN: "secret"
      })
    ).toEqual({
      sessionUrl: "ws://relay.example.test/ws/mobile?token=secret",
      displaySessionUrl: "ws://relay.example.test/ws/mobile?token=redacted",
      apiBaseUrl: "http://relay.example.test",
      displayApiBaseUrl: "http://relay.example.test",
      deviceId: "mac-dev",
      mobileClientId: "mobile-dev",
      mobileName: "iPhone",
      devToken: "secret",
      autoConnect: false,
      smokeCommand: null,
      autoPairingCode: null
    });
  });

  it("preserves existing query while appending and redacting dev token", () => {
    expect(
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_WS_URL: "ws://relay.example.test/ws/mobile?mode=dev",
        EXPO_PUBLIC_REMOTE_DEV_TOKEN: "secret"
      })
    ).toEqual({
      sessionUrl: "ws://relay.example.test/ws/mobile?mode=dev&token=secret",
      displaySessionUrl: "ws://relay.example.test/ws/mobile?mode=dev&token=redacted",
      apiBaseUrl: "http://relay.example.test",
      displayApiBaseUrl: "http://relay.example.test",
      deviceId: "mac-dev",
      mobileClientId: "mobile-dev",
      mobileName: "iPhone",
      devToken: "secret",
      autoConnect: false,
      smokeCommand: null,
      autoPairingCode: null
    });
  });

  it("derives HTTPS API URL from a secure WebSocket URL", () => {
    expect(
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_WS_URL: "wss://relay.example.test/ws/mobile"
      })
    ).toMatchObject({
      sessionUrl: "wss://relay.example.test/ws/mobile",
      apiBaseUrl: "https://relay.example.test"
    });
  });

  it("derives release URLs from a relay host", () => {
    expect(
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_RELAY_HOST: "relay.example.test"
      })
    ).toMatchObject({
      sessionUrl: "wss://relay.example.test/ws/mobile",
      apiBaseUrl: "https://relay.example.test"
    });
  });

  it("rejects placeholder release endpoints", () => {
    expect(() =>
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_RELEASE: "1",
        EXPO_PUBLIC_REMOTE_RELAY_HOST: "remote-terminal.example.invalid",
        EXPO_PUBLIC_REMOTE_DEV_TOKEN: "secret"
      })
    ).toThrow("Release mobile endpoint must not use placeholder host remote-terminal.example.invalid");
    expect(() =>
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_RELEASE: "1",
        EXPO_PUBLIC_REMOTE_WS_URL: "wss://api.example.com/ws/mobile",
        EXPO_PUBLIC_REMOTE_DEV_TOKEN: "secret"
      })
    ).toThrow("Release mobile endpoint must not use placeholder host api.example.com");
  });

  it("requires a non-placeholder dev token for release builds", () => {
    expect(() =>
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_RELEASE: "1",
        EXPO_PUBLIC_REMOTE_RELAY_HOST: "relay.example.test"
      })
    ).toThrow("EXPO_PUBLIC_REMOTE_DEV_TOKEN is required when EXPO_PUBLIC_REMOTE_RELEASE=1");
    expect(() =>
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_RELEASE: "1",
        EXPO_PUBLIC_REMOTE_RELAY_HOST: "relay.example.test",
        EXPO_PUBLIC_REMOTE_DEV_TOKEN: "replace-with-render-dev-token"
      })
    ).toThrow("Release mobile dev token must not be a placeholder");
  });

  it("returns a user-facing config error instead of throwing for screens", () => {
    expect(
      tryLoadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_RELEASE: "1",
        EXPO_PUBLIC_REMOTE_RELAY_HOST: "relay.example.test"
      })
    ).toEqual({
      ok: false,
      error: "EXPO_PUBLIC_REMOTE_DEV_TOKEN is required when EXPO_PUBLIC_REMOTE_RELEASE=1"
    });
  });

  it("auto connects with a restored token even when auto pairing is configured", () => {
    expect(
      shouldAutoConnectTerminal({
        autoConnect: true,
        autoPairingCode: "123456",
        autoConnectAttempted: false,
        sessionToken: "token-1"
      })
    ).toBe(true);
    expect(
      shouldAutoConnectTerminal({
        autoConnect: true,
        autoPairingCode: "123456",
        autoConnectAttempted: false,
        sessionToken: null
      })
    ).toBe(false);
  });
});
