import { describe, expect, it } from "vitest";
import { loadMobileRuntimeConfig } from "../src/config/runtimeConfig";

describe("mobile runtime config", () => {
  it("uses simulator-friendly defaults", () => {
    expect(loadMobileRuntimeConfig({})).toEqual({
      sessionUrl: "ws://127.0.0.1:8787/ws/mobile",
      deviceId: "mac-dev",
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
      deviceId: "macbook",
      autoConnect: true,
      smokeCommand: "printf hi"
    });
  });
});
