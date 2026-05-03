import { describe, expect, it } from "vitest";
import { DeviceRegistry, MemoryDevicePresenceStore, type DeviceCapability } from "../src/deviceRegistry.js";

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
      online: true,
      lastSeenAt: expect.any(String)
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

  it("updates lastSeenAt when a device heartbeats", () => {
    let now = new Date("2026-05-03T10:00:00.000Z");
    const registry = new DeviceRegistry({ now: () => now });
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    now = new Date("2026-05-03T10:00:30.000Z");
    registry.heartbeat("mac-1");

    expect(registry.get("mac-1")).toMatchObject({
      online: true,
      lastSeenAt: "2026-05-03T10:00:30.000Z"
    });
  });

  it("marks devices offline after presence ttl expires", () => {
    let now = new Date("2026-05-03T10:00:00.000Z");
    const registry = new DeviceRegistry({
      now: () => now,
      presenceTtlMs: 1_000
    });
    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });

    now = new Date("2026-05-03T10:00:01.001Z");

    expect(registry.get("mac-1")).toMatchObject({
      online: false,
      lastSeenAt: "2026-05-03T10:00:00.000Z"
    });
  });

  it("can use an injected memory presence store", () => {
    const presenceStore = new MemoryDevicePresenceStore({
      now: () => new Date("2026-05-03T10:00:00.000Z"),
      ttlMs: 60_000
    });
    const registry = new DeviceRegistry({ presenceStore });

    registry.register({
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    });
    registry.markOffline("mac-1");

    expect(registry.get("mac-1")).toMatchObject({
      online: false,
      lastSeenAt: "2026-05-03T10:00:00.000Z"
    });
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
      online: true,
      lastSeenAt: expect.any(String)
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
      online: true,
      lastSeenAt: expect.any(String)
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
      online: true,
      lastSeenAt: expect.any(String)
    });
  });
});
