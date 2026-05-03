import { afterEach, describe, expect, it, vi } from "vitest";
import { createOptionalHomeDeviceStatusClient } from "../src/state/homeDeviceStatus";

describe("home device status", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not crash the app home when release endpoint config is incomplete", () => {
    expect(createOptionalHomeDeviceStatusClient({ EXPO_PUBLIC_REMOTE_RELEASE: "1" })).toBeNull();
  });

  it("does not crash the app home when process is unavailable", () => {
    vi.stubGlobal("process", undefined);

    expect(() => createOptionalHomeDeviceStatusClient()).not.toThrow();
  });
});
