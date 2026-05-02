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

export class MemoryPairingStore {
  private readonly codes = new Map<string, PairingCodeRecord>();
  private readonly requests = new Map<string, PairingRequestRecord>();
  private readonly bindings = new Map<string, DeviceBindingRecord>();

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
