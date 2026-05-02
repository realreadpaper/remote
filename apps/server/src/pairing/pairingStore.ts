import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type PairingRequestStatus = "pending" | "approved" | "rejected";

export interface PairingCodeRecord {
  codeHash: string;
  deviceId: string;
  deviceName: string;
  serverUrl: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface PairingRequestRecord {
  pairingRequestId: string;
  codeHash: string;
  deviceId: string;
  mobileClientId: string;
  mobileName: string;
  requestedAt: string;
  status: PairingRequestStatus;
  decidedAt: string | null;
  reason: string | null;
}

export interface DeviceBindingRecord {
  bindingId: string;
  deviceId: string;
  mobileClientId: string;
  mobileName: string;
  approvedAt: string;
}

export interface PairingStore {
  saveCode(record: PairingCodeRecord): void;
  getCode(codeHash: string): PairingCodeRecord | undefined;
  markCodeUsed(codeHash: string, usedAt: string): void;
  saveRequest(record: PairingRequestRecord): void;
  getRequest(pairingRequestId: string): PairingRequestRecord | undefined;
  saveBinding(record: DeviceBindingRecord): void;
  listBindings(): DeviceBindingRecord[];
}

interface PairingStoreSnapshot {
  codes: PairingCodeRecord[];
  requests: PairingRequestRecord[];
  bindings: DeviceBindingRecord[];
}

export class MemoryPairingStore implements PairingStore {
  private readonly codes = new Map<string, PairingCodeRecord>();
  private readonly requests = new Map<string, PairingRequestRecord>();
  private readonly bindings = new Map<string, DeviceBindingRecord>();

  constructor(snapshot: PairingStoreSnapshot = emptySnapshot()) {
    for (const code of snapshot.codes) {
      this.codes.set(code.codeHash, cloneCode(code));
    }
    for (const request of snapshot.requests) {
      this.requests.set(request.pairingRequestId, cloneRequest(request));
    }
    for (const binding of snapshot.bindings) {
      this.bindings.set(binding.bindingId, cloneBinding(binding));
    }
  }

  saveCode(record: PairingCodeRecord): void {
    this.codes.set(record.codeHash, cloneCode(record));
  }

  getCode(codeHash: string): PairingCodeRecord | undefined {
    const record = this.codes.get(codeHash);
    return record ? cloneCode(record) : undefined;
  }

  markCodeUsed(codeHash: string, usedAt: string): void {
    const record = this.codes.get(codeHash);
    if (!record) {
      return;
    }

    this.codes.set(codeHash, {
      ...record,
      usedAt
    });
  }

  saveRequest(record: PairingRequestRecord): void {
    this.requests.set(record.pairingRequestId, cloneRequest(record));
  }

  getRequest(pairingRequestId: string): PairingRequestRecord | undefined {
    const record = this.requests.get(pairingRequestId);
    return record ? cloneRequest(record) : undefined;
  }

  saveBinding(record: DeviceBindingRecord): void {
    this.bindings.set(record.bindingId, cloneBinding(record));
  }

  listBindings(): DeviceBindingRecord[] {
    return [...this.bindings.values()].map((binding) => cloneBinding(binding));
  }

  snapshot(): PairingStoreSnapshot {
    return {
      codes: [...this.codes.values()].map((code) => cloneCode(code)),
      requests: [...this.requests.values()].map((request) => cloneRequest(request)),
      bindings: [...this.bindings.values()].map((binding) => cloneBinding(binding))
    };
  }
}

export class JsonFilePairingStore implements PairingStore {
  private readonly memory: MemoryPairingStore;

  constructor(private readonly filePath: string) {
    this.memory = new MemoryPairingStore(readSnapshot(filePath));
  }

  saveCode(record: PairingCodeRecord): void {
    this.memory.saveCode(record);
    this.persist();
  }

  getCode(codeHash: string): PairingCodeRecord | undefined {
    return this.memory.getCode(codeHash);
  }

  markCodeUsed(codeHash: string, usedAt: string): void {
    this.memory.markCodeUsed(codeHash, usedAt);
    this.persist();
  }

  saveRequest(record: PairingRequestRecord): void {
    this.memory.saveRequest(record);
    this.persist();
  }

  getRequest(pairingRequestId: string): PairingRequestRecord | undefined {
    return this.memory.getRequest(pairingRequestId);
  }

  saveBinding(record: DeviceBindingRecord): void {
    this.memory.saveBinding(record);
    this.persist();
  }

  listBindings(): DeviceBindingRecord[] {
    return this.memory.listBindings();
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.memory.snapshot(), null, 2)}\n`, "utf8");
  }
}

function cloneCode(record: PairingCodeRecord): PairingCodeRecord {
  return { ...record };
}

function cloneRequest(record: PairingRequestRecord): PairingRequestRecord {
  return { ...record };
}

function cloneBinding(record: DeviceBindingRecord): DeviceBindingRecord {
  return { ...record };
}

function emptySnapshot(): PairingStoreSnapshot {
  return {
    codes: [],
    requests: [],
    bindings: []
  };
}

function readSnapshot(filePath: string): PairingStoreSnapshot {
  if (!existsSync(filePath)) {
    return emptySnapshot();
  }

  try {
    return parseSnapshot(JSON.parse(readFileSync(filePath, "utf8")));
  } catch (error) {
    throw new Error(`Pairing store file is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseSnapshot(input: unknown): PairingStoreSnapshot {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("snapshot must be an object");
  }

  const snapshot = input as Record<string, unknown>;
  if (!Array.isArray(snapshot.codes) || !Array.isArray(snapshot.requests) || !Array.isArray(snapshot.bindings)) {
    throw new Error("snapshot arrays are required");
  }

  return {
    codes: snapshot.codes.map(parseCode),
    requests: snapshot.requests.map(parseRequest),
    bindings: snapshot.bindings.map(parseBinding)
  };
}

function parseCode(input: unknown): PairingCodeRecord {
  const record = readObject(input);
  return {
    codeHash: readString(record, "codeHash"),
    deviceId: readString(record, "deviceId"),
    deviceName: readString(record, "deviceName"),
    serverUrl: readString(record, "serverUrl"),
    createdAt: readString(record, "createdAt"),
    expiresAt: readString(record, "expiresAt"),
    usedAt: readNullableString(record, "usedAt")
  };
}

function parseRequest(input: unknown): PairingRequestRecord {
  const record = readObject(input);
  const status = readString(record, "status");
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    throw new Error("request status is invalid");
  }

  return {
    pairingRequestId: readString(record, "pairingRequestId"),
    codeHash: readString(record, "codeHash"),
    deviceId: readString(record, "deviceId"),
    mobileClientId: readString(record, "mobileClientId"),
    mobileName: readString(record, "mobileName"),
    requestedAt: readString(record, "requestedAt"),
    status,
    decidedAt: readNullableString(record, "decidedAt"),
    reason: readNullableString(record, "reason")
  };
}

function parseBinding(input: unknown): DeviceBindingRecord {
  const record = readObject(input);
  return {
    bindingId: readString(record, "bindingId"),
    deviceId: readString(record, "deviceId"),
    mobileClientId: readString(record, "mobileClientId"),
    mobileName: readString(record, "mobileName"),
    approvedAt: readString(record, "approvedAt")
  };
}

function readObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("record must be an object");
  }

  return input as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, fieldName: string): string {
  const value = record[fieldName];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function readNullableString(record: Record<string, unknown>, fieldName: string): string | null {
  const value = record[fieldName];
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a string or null`);
  }

  return value;
}
