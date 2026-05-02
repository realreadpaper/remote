import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeyPairSync, randomUUID as defaultRandomUUID } from "node:crypto";

export interface DeviceIdentity {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export interface DeviceIdentityStore {
  load(): DeviceIdentity | null;
  save(identity: DeviceIdentity): void;
}

export interface LoadDeviceIdentityOptions {
  identityPath?: string;
  now?: () => Date;
  randomUUID?: () => string;
  store?: DeviceIdentityStore;
}

export function getDefaultIdentityPath(homeDir = os.homedir()): string {
  return path.join(homeDir, ".remote-terminal-agent", "identity.json");
}

export function loadOrCreateDeviceIdentity(options: LoadDeviceIdentityOptions = {}): DeviceIdentity {
  const store = options.store ?? new FileDeviceIdentityStore(options.identityPath ?? getDefaultIdentityPath());
  const existingIdentity = store.load();
  if (existingIdentity) {
    return existingIdentity;
  }

  const identity = createDeviceIdentity({
    now: options.now ?? (() => new Date()),
    randomUUID: options.randomUUID ?? defaultRandomUUID
  });
  store.save(identity);
  return identity;
}

class FileDeviceIdentityStore implements DeviceIdentityStore {
  constructor(private readonly identityPath: string) {}

  load(): DeviceIdentity | null {
    if (!existsSync(this.identityPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.identityPath, "utf8"));
      return parseDeviceIdentity(parsed);
    } catch (error) {
      throw new Error(`Agent identity file is invalid: ${this.identityPath}`, { cause: error });
    }
  }

  save(identity: DeviceIdentity): void {
    mkdirSync(path.dirname(this.identityPath), { recursive: true });
    writeFileSync(this.identityPath, `${JSON.stringify(identity, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
}

function createDeviceIdentity(options: { now: () => Date; randomUUID: () => string }): DeviceIdentity {
  const keyPair = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  return {
    version: 1,
    deviceId: options.randomUUID(),
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    createdAt: options.now().toISOString()
  };
}

function parseDeviceIdentity(input: unknown): DeviceIdentity {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Identity must be an object");
  }

  const keys = Object.keys(input).sort();
  const expectedKeys = ["createdAt", "deviceId", "privateKey", "publicKey", "version"];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Identity has invalid fields");
  }

  const identity = input as Record<string, unknown>;
  if (identity.version !== 1) {
    throw new Error("Identity version is invalid");
  }

  return {
    version: 1,
    deviceId: readNonEmptyString(identity.deviceId, "deviceId"),
    publicKey: readNonEmptyString(identity.publicKey, "publicKey"),
    privateKey: readNonEmptyString(identity.privateKey, "privateKey"),
    createdAt: readNonEmptyString(identity.createdAt, "createdAt")
  };
}

function readNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Identity ${fieldName} must be a non-empty string`);
  }

  return value;
}
