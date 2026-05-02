import { createHash, randomInt, randomUUID } from "node:crypto";
import type { ServerMessage } from "@remote/protocol";
import {
  type DeviceBindingRecord,
  MemoryPairingStore,
  type PairingRequestRecord
} from "./pairingStore.js";

type PairingCreatedMessage = Extract<ServerMessage, { type: "pairing.created" }>;
type PairingRequestedMessage = Extract<ServerMessage, { type: "pairing.requested" }>;

export interface PairingServiceOptions {
  now?: () => Date;
  generatePairingCode?: () => string;
  generateId?: () => string;
  pairingTtlMs?: number;
}

export interface CreatePairingCodeInput {
  deviceId: string;
  deviceName: string;
  serverUrl: string;
}

export interface RequestPairingInput {
  pairingCode: string;
  mobileClientId: string;
  mobileName: string;
}

export interface DecidePairingRequestInput {
  pairingRequestId: string;
  deviceId: string;
}

export interface RejectPairingRequestInput extends DecidePairingRequestInput {
  reason: string;
}

export class PairingService {
  private readonly now: () => Date;
  private readonly generatePairingCode: () => string;
  private readonly generateId: () => string;
  private readonly pairingTtlMs: number;

  constructor(
    private readonly store: MemoryPairingStore,
    options: PairingServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.generatePairingCode = options.generatePairingCode ?? generateDefaultPairingCode;
    this.generateId = options.generateId ?? randomUUID;
    this.pairingTtlMs = options.pairingTtlMs ?? 5 * 60_000;
  }

  createPairingCode(input: CreatePairingCodeInput): PairingCreatedMessage {
    const now = this.now();
    const pairingCode = this.generatePairingCode();
    const expiresAt = new Date(now.getTime() + this.pairingTtlMs).toISOString();

    this.store.saveCode({
      codeHash: hashPairingCode(pairingCode),
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      serverUrl: input.serverUrl,
      createdAt: now.toISOString(),
      expiresAt,
      usedAt: null
    });

    return {
      type: "pairing.created",
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      serverUrl: input.serverUrl,
      pairingCode,
      expiresAt
    };
  }

  requestPairing(input: RequestPairingInput): PairingRequestedMessage {
    const codeHash = hashPairingCode(input.pairingCode);
    const code = this.store.getCode(codeHash);
    if (!code) {
      throw new Error("Pairing code not found");
    }

    if (code.usedAt) {
      throw new Error("Pairing code already used");
    }

    const now = this.now();
    if (Date.parse(code.expiresAt) < now.getTime()) {
      throw new Error("Pairing code expired");
    }

    const requestedAt = now.toISOString();
    this.store.markCodeUsed(codeHash, requestedAt);

    const request: PairingRequestRecord = {
      pairingRequestId: this.generateId(),
      codeHash,
      deviceId: code.deviceId,
      mobileClientId: input.mobileClientId,
      mobileName: input.mobileName,
      requestedAt,
      status: "pending",
      decidedAt: null,
      reason: null
    };
    this.store.saveRequest(request);

    return {
      type: "pairing.requested",
      pairingRequestId: request.pairingRequestId,
      deviceId: request.deviceId,
      mobileClientId: request.mobileClientId,
      mobileName: request.mobileName,
      requestedAt: request.requestedAt
    };
  }

  approvePairingRequest(input: DecidePairingRequestInput): DeviceBindingRecord {
    const request = this.getPendingRequestForDevice(input.pairingRequestId, input.deviceId);
    const approvedAt = this.now().toISOString();
    const approvedRequest: PairingRequestRecord = {
      ...request,
      status: "approved",
      decidedAt: approvedAt
    };
    this.store.saveRequest(approvedRequest);

    const binding: DeviceBindingRecord = {
      bindingId: this.generateId(),
      deviceId: request.deviceId,
      mobileClientId: request.mobileClientId,
      mobileName: request.mobileName,
      approvedAt
    };
    this.store.saveBinding(binding);
    return binding;
  }

  rejectPairingRequest(input: RejectPairingRequestInput): PairingRequestRecord {
    const request = this.getPendingRequestForDevice(input.pairingRequestId, input.deviceId);
    const rejectedRequest: PairingRequestRecord = {
      ...request,
      status: "rejected",
      decidedAt: this.now().toISOString(),
      reason: input.reason
    };
    this.store.saveRequest(rejectedRequest);
    return rejectedRequest;
  }

  listBindings(): DeviceBindingRecord[] {
    return this.store.listBindings();
  }

  private getPendingRequestForDevice(pairingRequestId: string, deviceId: string): PairingRequestRecord {
    const request = this.store.getRequest(pairingRequestId);
    if (!request || request.deviceId !== deviceId || request.status !== "pending") {
      throw new Error(`Pairing request ${pairingRequestId} is not pending for device ${deviceId}`);
    }

    return request;
  }
}

function generateDefaultPairingCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashPairingCode(pairingCode: string): string {
  return createHash("sha256").update(pairingCode).digest("hex");
}
