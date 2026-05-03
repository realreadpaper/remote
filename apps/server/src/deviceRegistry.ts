export type DeviceCapability = "terminal" | "file" | "desktop";

export interface RegisteredDevice {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
  online: boolean;
  lastSeenAt: string;
}

export interface RegisterDeviceInput {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
}

export interface DevicePresence {
  online: boolean;
  lastSeenAt: string;
  expiresAt: string | null;
}

export interface DevicePresenceStore {
  markOnline(deviceId: string, now?: Date): void;
  heartbeat(deviceId: string, now?: Date): void;
  markOffline(deviceId: string, now?: Date): void;
  getPresence(deviceId: string, now?: Date): DevicePresence | undefined;
}

export interface MemoryDevicePresenceStoreOptions {
  now?: () => Date;
  ttlMs?: number;
}

export interface DeviceRegistryOptions {
  presenceStore?: DevicePresenceStore;
  now?: () => Date;
  presenceTtlMs?: number;
}

interface DeviceMetadata {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
}

const DEFAULT_PRESENCE_TTL_MS = 60_000;

function iso(date: Date): string {
  return date.toISOString();
}

function expiresAt(now: Date, ttlMs: number): string {
  return new Date(now.getTime() + ttlMs).toISOString();
}

function cloneDevice(device: DeviceMetadata, presence: DevicePresence): RegisteredDevice {
  return {
    ...device,
    online: presence.online,
    lastSeenAt: presence.lastSeenAt,
    capabilities: [...device.capabilities]
  };
}

export class MemoryDevicePresenceStore implements DevicePresenceStore {
  private readonly records = new Map<string, DevicePresence>();
  private readonly now: () => Date;
  private readonly ttlMs: number;

  constructor(options: MemoryDevicePresenceStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.ttlMs = options.ttlMs ?? DEFAULT_PRESENCE_TTL_MS;
  }

  markOnline(deviceId: string, now = this.now()): void {
    this.records.set(deviceId, {
      online: true,
      lastSeenAt: iso(now),
      expiresAt: expiresAt(now, this.ttlMs)
    });
  }

  heartbeat(deviceId: string, now = this.now()): void {
    this.markOnline(deviceId, now);
  }

  markOffline(deviceId: string, now = this.now()): void {
    this.records.set(deviceId, {
      online: false,
      lastSeenAt: iso(now),
      expiresAt: null
    });
  }

  getPresence(deviceId: string, now = this.now()): DevicePresence | undefined {
    const presence = this.records.get(deviceId);
    if (!presence) {
      return undefined;
    }
    if (presence.online && presence.expiresAt && Date.parse(presence.expiresAt) <= now.getTime()) {
      return {
        ...presence,
        online: false
      };
    }
    return { ...presence };
  }
}

export class DeviceRegistry {
  private readonly devices = new Map<string, DeviceMetadata>();
  private readonly presenceStore: DevicePresenceStore;
  private readonly now?: () => Date;

  constructor(options: DeviceRegistryOptions = {}) {
    this.now = options.now;
    this.presenceStore =
      options.presenceStore ??
      new MemoryDevicePresenceStore({
        now: options.now,
        ttlMs: options.presenceTtlMs
      });
  }

  register(input: RegisterDeviceInput): RegisteredDevice {
    const device: DeviceMetadata = {
      ...input,
      capabilities: [...input.capabilities]
    };
    this.devices.set(input.deviceId, device);
    this.presenceStore.markOnline(input.deviceId, this.now?.());
    return cloneDevice(device, this.getDevicePresence(input.deviceId));
  }

  get(deviceId: string): RegisteredDevice | undefined {
    const device = this.devices.get(deviceId);
    return device ? cloneDevice(device, this.getDevicePresence(deviceId)) : undefined;
  }

  heartbeat(deviceId: string): void {
    if (!this.devices.has(deviceId)) {
      return;
    }
    this.presenceStore.heartbeat(deviceId, this.now?.());
  }

  markOffline(deviceId: string): void {
    if (!this.devices.has(deviceId)) {
      return;
    }
    this.presenceStore.markOffline(deviceId, this.now?.());
  }

  list(): RegisteredDevice[] {
    return [...this.devices.values()].map((device) => cloneDevice(device, this.getDevicePresence(device.deviceId)));
  }

  private getDevicePresence(deviceId: string): DevicePresence {
    return (
      this.presenceStore.getPresence(deviceId, this.now?.()) ?? {
        online: false,
        lastSeenAt: iso(this.now?.() ?? new Date(0)),
        expiresAt: null
      }
    );
  }
}
