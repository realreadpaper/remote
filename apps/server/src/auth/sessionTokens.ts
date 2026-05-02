import { randomBytes } from "node:crypto";

export interface SessionTokenRecord {
  sessionToken: string;
  bindingId: string;
  deviceId: string;
  mobileClientId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface IssueSessionTokenInput {
  bindingId: string;
  deviceId: string;
  mobileClientId: string;
}

export interface VerifySessionTokenInput {
  sessionToken: string;
  deviceId: string;
  now?: Date;
}

export type SessionTokenVerificationResult =
  | { ok: true; record: SessionTokenRecord }
  | { ok: false; reason: string };

export interface MemorySessionTokenStoreOptions {
  now?: () => Date;
  generateToken?: () => string;
  tokenTtlMs?: number;
}

export class MemorySessionTokenStore {
  private readonly tokens = new Map<string, SessionTokenRecord>();
  private readonly now: () => Date;
  private readonly generateToken: () => string;
  private readonly tokenTtlMs: number;

  constructor(options: MemorySessionTokenStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.generateToken = options.generateToken ?? generateDefaultToken;
    this.tokenTtlMs = options.tokenTtlMs ?? 24 * 60 * 60_000;
  }

  issueSessionToken(input: IssueSessionTokenInput): SessionTokenRecord {
    const now = this.now();
    const record: SessionTokenRecord = {
      sessionToken: this.generateToken(),
      bindingId: input.bindingId,
      deviceId: input.deviceId,
      mobileClientId: input.mobileClientId,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.tokenTtlMs).toISOString()
    };

    this.tokens.set(record.sessionToken, cloneRecord(record));
    return cloneRecord(record);
  }

  verifySessionToken(input: VerifySessionTokenInput): SessionTokenVerificationResult {
    const record = this.tokens.get(input.sessionToken);
    if (!record) {
      return { ok: false, reason: "Invalid session token" };
    }

    if (record.deviceId !== input.deviceId) {
      return { ok: false, reason: `Session token is not valid for device ${input.deviceId}` };
    }

    const now = input.now ?? this.now();
    if (Date.parse(record.expiresAt) < now.getTime()) {
      return { ok: false, reason: "Session token expired" };
    }

    return { ok: true, record: cloneRecord(record) };
  }
}

function generateDefaultToken(): string {
  return randomBytes(32).toString("base64url");
}

function cloneRecord(record: SessionTokenRecord): SessionTokenRecord {
  return { ...record };
}
