import { describe, expect, it } from "vitest";
import { RedisDevicePresenceStore, type RedisLike } from "../../src/presence/redisPresenceStore.js";

class FakeRedis implements RedisLike {
  readonly values = new Map<string, string>();
  readonly ttls = new Map<string, number | undefined>();

  async set(key: string, value: string, options?: { EX?: number }): Promise<unknown> {
    this.values.set(key, value);
    this.ttls.set(key, options?.EX);
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
}

describe("RedisDevicePresenceStore", () => {
  it("writes online presence payload with ttl when marking online", async () => {
    const redis = new FakeRedis();
    const store = new RedisDevicePresenceStore(redis, { ttlSeconds: 60 });

    await store.markOnline("mac-1", new Date("2026-05-03T10:00:00.000Z"));

    expect(redis.ttls.get("presence:device:mac-1")).toBe(60);
    expect(JSON.parse(redis.values.get("presence:device:mac-1")!)).toEqual({
      online: true,
      lastSeenAt: "2026-05-03T10:00:00.000Z",
      expiresAt: "2026-05-03T10:01:00.000Z"
    });
  });

  it("refreshes lastSeenAt, expiresAt, and ttl when heartbeating", async () => {
    const redis = new FakeRedis();
    const store = new RedisDevicePresenceStore(redis, { ttlSeconds: 45 });

    await store.markOnline("mac-1", new Date("2026-05-03T10:00:00.000Z"));
    await store.heartbeat("mac-1", new Date("2026-05-03T10:00:30.000Z"));

    expect(redis.ttls.get("presence:device:mac-1")).toBe(45);
    await expect(store.getPresence("mac-1", new Date("2026-05-03T10:00:31.000Z"))).resolves.toEqual({
      online: true,
      lastSeenAt: "2026-05-03T10:00:30.000Z",
      expiresAt: "2026-05-03T10:01:15.000Z"
    });
  });

  it("writes offline presence payload without ttl when marking offline", async () => {
    const redis = new FakeRedis();
    const store = new RedisDevicePresenceStore(redis);

    await store.markOffline("mac-1", new Date("2026-05-03T10:02:00.000Z"));

    expect(redis.ttls.get("presence:device:mac-1")).toBeUndefined();
    await expect(store.getPresence("mac-1")).resolves.toEqual({
      online: false,
      lastSeenAt: "2026-05-03T10:02:00.000Z",
      expiresAt: null
    });
  });

  it("returns undefined for missing or invalid presence records", async () => {
    const redis = new FakeRedis();
    const store = new RedisDevicePresenceStore(redis);

    await expect(store.getPresence("missing")).resolves.toBeUndefined();

    redis.values.set("presence:device:mac-1", "not-json");

    await expect(store.getPresence("mac-1")).resolves.toBeUndefined();
  });
});
