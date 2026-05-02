import { describe, expect, it } from "vitest";
import { DeviceRegistry } from "../src/deviceRegistry";

describe("DeviceRegistry", () => {
  it("stores online device metadata", () => {
    const registry = new DeviceRegistry();
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    expect(registry.get("mac-1")).toEqual({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"],
      online: true
    });
  });

  it("marks devices offline", () => {
    const registry = new DeviceRegistry();
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    registry.markOffline("mac-1");

    expect(registry.get("mac-1")?.online).toBe(false);
  });
});
