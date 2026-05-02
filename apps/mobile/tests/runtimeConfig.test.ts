import { describe, expect, it } from "vitest";
import { loadMobileRuntimeConfig } from "../src/config/runtimeConfig";

describe("mobile runtime config", () => {
  it("uses simulator-friendly defaults", () => {
    expect(loadMobileRuntimeConfig({})).toEqual({
      sessionUrl: "ws://127.0.0.1:8787/ws/mobile",
      displaySessionUrl: "ws://127.0.0.1:8787/ws/mobile",
      deviceId: "mac-dev",
      devToken: null,
      autoConnect: false,
      smokeCommand: null
    });
  });

  it("loads physical-device and smoke-test environment overrides", () => {
    expect(
      loadMobileRuntimeConfig({
        EXPO_PUBLIC_REMOTE_WS_URL: "ws://192.168.1.20:8787/ws/mobile",
        EXPO_PUBLIC_REMOTE_DEVICE_ID: "macbook",
        EXPO_PUBLIC_REMOTE_AUTOCONNECT: "1",
        EXPO_PUBLIC_REMOTE_SMOKE_COMMAND: "printf hi"
      })
    ).toEqual({
      sessionUrl: "ws://192.168.1.20:8787/ws/mobile",
      displaySessionUrl: "ws://192.168.1.20:8787/ws/mobile",
      deviceId: "macbook",
      devToken: null,
      autoConnect: true,
      smokeCommand: "printf hi"
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
      deviceId: "mac-dev",
      devToken: "secret",
      autoConnect: false,
      smokeCommand: null
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
      deviceId: "mac-dev",
      devToken: "secret",
      autoConnect: false,
      smokeCommand: null
    });
  });
});
