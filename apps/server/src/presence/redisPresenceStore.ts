import type { DevicePresence } from "../deviceRegistry.js";

export interface RedisLike {
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  get(key: string): Promise<string | null>;
}

export interface RedisDevicePresenceStoreOptions {
  keyPrefix?: string;
  now?: () => Date;
  ttlSeconds?: number;
}

const DEFAULT_KEY_PREFIX = "presence:device:";
const DEFAULT_TTL_SECONDS = 60;

function iso(date: Date): string {
  return date.toISOString();
}

function presenceKey(prefix: string, deviceId: string): string {
  return `${prefix}${deviceId}`;
}

function isDevicePresence(value: unknown): value is DevicePresence {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DevicePresence>;
  return (
    typeof candidate.online === "boolean" &&
    typeof candidate.lastSeenAt === "string" &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === "string")
  );
}

export class RedisDevicePresenceStore {
  private readonly redis: RedisLike;
  private readonly keyPrefix: string;
  private readonly now: () => Date;
  private readonly ttlSeconds: number;

  constructor(redis: RedisLike, options: RedisDevicePresenceStoreOptions = {}) {
    this.redis = redis;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.now = options.now ?? (() => new Date());
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  async markOnline(deviceId: string, now = this.now()): Promise<void> {
    const presence: DevicePresence = {
      online: true,
      lastSeenAt: iso(now),
      expiresAt: iso(new Date(now.getTime() + this.ttlSeconds * 1_000))
    };

    await this.redis.set(presenceKey(this.keyPrefix, deviceId), JSON.stringify(presence), {
      EX: this.ttlSeconds
    });
  }

  async heartbeat(deviceId: string, now = this.now()): Promise<void> {
    await this.markOnline(deviceId, now);
  }

  async markOffline(deviceId: string, now = this.now()): Promise<void> {
    const presence: DevicePresence = {
      online: false,
      lastSeenAt: iso(now),
      expiresAt: null
    };

    await this.redis.set(presenceKey(this.keyPrefix, deviceId), JSON.stringify(presence));
  }

  async getPresence(deviceId: string, now = this.now()): Promise<DevicePresence | undefined> {
    const raw = await this.redis.get(presenceKey(this.keyPrefix, deviceId));
    if (!raw) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }

    if (!isDevicePresence(parsed)) {
      return undefined;
    }

    if (parsed.online && parsed.expiresAt && Date.parse(parsed.expiresAt) <= now.getTime()) {
      return {
        ...parsed,
        online: false
      };
    }

    return parsed;
  }
}
