import { describe, expect, it } from "vitest";
import { createOptionalHomeDeviceStatusClient } from "../src/state/homeDeviceStatus";

describe("home device status", () => {
  it("does not crash the app home when release endpoint config is incomplete", () => {
    expect(createOptionalHomeDeviceStatusClient({ EXPO_PUBLIC_REMOTE_RELEASE: "1" })).toBeNull();
  });
});
