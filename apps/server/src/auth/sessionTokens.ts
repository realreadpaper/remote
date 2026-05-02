import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

export interface FindTokenForBindingInput {
  deviceId: string;
  mobileClientId: string;
  now?: Date;
}

export interface SessionTokenStore {
  issueSessionToken(input: IssueSessionTokenInput): SessionTokenRecord;
  verifySessionToken(input: VerifySessionTokenInput): SessionTokenVerificationResult;
  findTokenForBinding(input: FindTokenForBindingInput): SessionTokenRecord | undefined;
}

export interface MemorySessionTokenStoreOptions {
  now?: () => Date;
  generateToken?: () => string;
  tokenTtlMs?: number;
}

export class MemorySessionTokenStore implements SessionTokenStore {
  private readonly tokens = new Map<string, SessionTokenRecord>();
  private readonly now: () => Date;
  private readonly generateToken: () => string;
  private readonly tokenTtlMs: number;

  constructor(
    options: MemorySessionTokenStoreOptions = {},
    records: SessionTokenRecord[] = []
  ) {
    this.now = options.now ?? (() => new Date());
    this.generateToken = options.generateToken ?? generateDefaultToken;
    this.tokenTtlMs = options.tokenTtlMs ?? 24 * 60 * 60_000;
    for (const record of records) {
      this.tokens.set(record.sessionToken, cloneRecord(record));
    }
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

  findTokenForBinding(input: FindTokenForBindingInput): SessionTokenRecord | undefined {
    const now = input.now ?? this.now();
    const candidates = [...this.tokens.values()]
      .filter((record) => record.deviceId === input.deviceId && record.mobileClientId === input.mobileClientId)
      .filter((record) => Date.parse(record.expiresAt) >= now.getTime())
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));

    return candidates[0] ? cloneRecord(candidates[0]) : undefined;
  }

  snapshot(): SessionTokenRecord[] {
    return [...this.tokens.values()].map((record) => cloneRecord(record));
  }
}

export class JsonFileSessionTokenStore implements SessionTokenStore {
  private readonly memory: MemorySessionTokenStore;

  constructor(
    private readonly filePath: string,
    options: MemorySessionTokenStoreOptions = {}
  ) {
    this.memory = new MemorySessionTokenStore(options, readTokenRecords(filePath));
  }

  issueSessionToken(input: IssueSessionTokenInput): SessionTokenRecord {
    const record = this.memory.issueSessionToken(input);
    this.persist();
    return record;
  }

  verifySessionToken(input: VerifySessionTokenInput): SessionTokenVerificationResult {
    return this.memory.verifySessionToken(input);
  }

  findTokenForBinding(input: FindTokenForBindingInput): SessionTokenRecord | undefined {
    return this.memory.findTokenForBinding(input);
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify({ tokens: this.memory.snapshot() }, null, 2)}\n`, "utf8");
  }
}

function generateDefaultToken(): string {
  return randomBytes(32).toString("base64url");
}

function cloneRecord(record: SessionTokenRecord): SessionTokenRecord {
  return { ...record };
}

function readTokenRecords(filePath: string): SessionTokenRecord[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const input = JSON.parse(readFileSync(filePath, "utf8"));
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("snapshot must be an object");
    }

    const tokens = (input as Record<string, unknown>).tokens;
    if (!Array.isArray(tokens)) {
      throw new Error("tokens array is required");
    }

    return tokens.map(parseRecord);
  } catch (error) {
    throw new Error(`Session token store file is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseRecord(input: unknown): SessionTokenRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("token record must be an object");
  }

  const record = input as Record<string, unknown>;
  return {
    sessionToken: readString(record, "sessionToken"),
    bindingId: readString(record, "bindingId"),
    deviceId: readString(record, "deviceId"),
    mobileClientId: readString(record, "mobileClientId"),
    issuedAt: readString(record, "issuedAt"),
    expiresAt: readString(record, "expiresAt")
  };
}

function readString(record: Record<string, unknown>, fieldName: string): string {
  const value = record[fieldName];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}
