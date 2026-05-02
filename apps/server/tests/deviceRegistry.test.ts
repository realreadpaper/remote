import { describe, expect, it } from "vitest";
import { DeviceRegistry, type DeviceCapability } from "../src/deviceRegistry.js";

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

  it("isolates registered device state from input capabilities mutations", () => {
    const registry = new DeviceRegistry();
    const capabilities: DeviceCapability[] = ["terminal"];

    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities
    });
    capabilities.push("file");

    expect(registry.get("mac-1")?.capabilities).toEqual(["terminal"]);
  });

  it("isolates registered device state from mutations to the register result", () => {
    const registry = new DeviceRegistry();
    const device = registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    device.deviceName = "Changed";
    device.capabilities.push("file");
    device.online = false;

    expect(registry.get("mac-1")).toEqual({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"],
      online: true
    });
  });

  it("isolates registered device state from mutations to get results", () => {
    const registry = new DeviceRegistry();
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    const device = registry.get("mac-1");
    expect(device).toBeDefined();
    device!.deviceName = "Changed";
    device!.capabilities.push("file");
    device!.online = false;

    expect(registry.get("mac-1")).toEqual({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"],
      online: true
    });
  });

  it("isolates registered device state from mutations to list results", () => {
    const registry = new DeviceRegistry();
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    const devices = registry.list();
    expect(devices).toHaveLength(1);
    devices[0]!.deviceName = "Changed";
    devices[0]!.capabilities.push("file");
    devices[0]!.online = false;

    expect(registry.get("mac-1")).toEqual({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"],
      online: true
    });
  });
});
