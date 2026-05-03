import { describe, expect, it } from "vitest";
import { BindingRepository } from "../../src/persistence/bindingRepository.js";
import { DeviceRepository } from "../../src/persistence/deviceRepository.js";
import { createRepositoryTestDb } from "./repositoryTestDb.js";

describe("Postgres repositories", () => {
  it("upserts registered devices", async () => {
    const db = await createRepositoryTestDb();
    const devices = new DeviceRepository(db);

    await devices.upsertUser({
      userId: "user-1",
      email: "user@example.com",
      createdAt: "2026-05-03T10:00:00.000Z"
    });
    await devices.upsertDevice({
      deviceId: "mac-1",
      ownerUserId: "user-1",
      name: "MacBook Pro",
      platform: "macos",
      capabilities: ["terminal"],
      lastSeenAt: "2026-05-03T10:00:00.000Z"
    });
    const updated = await devices.upsertDevice({
      deviceId: "mac-1",
      ownerUserId: "user-1",
      name: "Mac Studio",
      platform: "macos",
      capabilities: ["terminal", "file"],
      lastSeenAt: "2026-05-03T10:05:00.000Z"
    });

    expect(updated).toEqual({
      deviceId: "mac-1",
      ownerUserId: "user-1",
      name: "Mac Studio",
      platform: "macos",
      capabilities: ["terminal", "file"],
      lastSeenAt: "2026-05-03T10:05:00.000Z",
      revokedAt: null
    });
    await expect(devices.getDevice("mac-1")).resolves.toEqual(updated);
  });

  it("creates and revokes device bindings", async () => {
    const db = await createRepositoryTestDb();
    const devices = new DeviceRepository(db);
    const bindings = new BindingRepository(db);

    await devices.upsertUser({
      userId: "user-1",
      email: null,
      createdAt: "2026-05-03T10:00:00.000Z"
    });
    await devices.upsertDevice({
      deviceId: "mac-1",
      ownerUserId: "user-1",
      name: "MacBook Pro",
      platform: "macos",
      capabilities: ["terminal"],
      lastSeenAt: "2026-05-03T10:00:00.000Z"
    });
    await bindings.upsertMobileClient({
      mobileClientId: "mobile-1",
      userId: "user-1",
      name: "iPhone",
      platform: "ios",
      lastSeenAt: "2026-05-03T10:01:00.000Z"
    });
    const binding = await bindings.createBinding({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      userId: "user-1",
      approvedAt: "2026-05-03T10:02:00.000Z"
    });

    expect(binding).toEqual({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      userId: "user-1",
      approvedAt: "2026-05-03T10:02:00.000Z",
      revokedAt: null
    });
    expect(await bindings.listActiveBindingsForUser("user-1")).toEqual([binding]);

    await expect(bindings.revokeBinding("binding-1", "2026-05-03T10:03:00.000Z")).resolves.toBe(true);
    await expect(bindings.listActiveBindingsForUser("user-1")).resolves.toEqual([]);
  });

  it("lists active bound devices for a user", async () => {
    const db = await createRepositoryTestDb();
    const devices = new DeviceRepository(db);
    const bindings = new BindingRepository(db);

    await devices.upsertUser({ userId: "user-1", email: null, createdAt: "2026-05-03T10:00:00.000Z" });
    await devices.upsertUser({ userId: "user-2", email: null, createdAt: "2026-05-03T10:00:00.000Z" });
    await devices.upsertDevice({
      deviceId: "mac-1",
      ownerUserId: "user-1",
      name: "MacBook Pro",
      platform: "macos",
      capabilities: ["terminal"],
      lastSeenAt: "2026-05-03T10:00:00.000Z"
    });
    await devices.upsertDevice({
      deviceId: "mac-2",
      ownerUserId: "user-2",
      name: "Mac Mini",
      platform: "macos",
      capabilities: ["terminal"],
      lastSeenAt: "2026-05-03T10:00:00.000Z"
    });
    await bindings.upsertMobileClient({
      mobileClientId: "mobile-1",
      userId: "user-1",
      name: "iPhone",
      platform: "ios",
      lastSeenAt: "2026-05-03T10:01:00.000Z"
    });
    await bindings.createBinding({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      userId: "user-1",
      approvedAt: "2026-05-03T10:02:00.000Z"
    });

    expect(await devices.listDevicesForUser("user-1")).toEqual([
      {
        deviceId: "mac-1",
        ownerUserId: "user-1",
        name: "MacBook Pro",
        platform: "macos",
        capabilities: ["terminal"],
        lastSeenAt: "2026-05-03T10:00:00.000Z",
        revokedAt: null
      }
    ]);
    await expect(devices.listDevicesForUser("user-2")).resolves.toEqual([]);
  });
});
