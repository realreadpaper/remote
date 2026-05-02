import type { ServerMessage } from "@remote/protocol";

export interface PairingClientOptions {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface PairingRequestInput {
  pairingCode: string;
  mobileClientId: string;
  mobileName: string;
}

export interface PairingRequestResult {
  pairingRequestId: string;
  deviceId: string;
  status: "pending";
}

export type AuthSessionToken = Extract<ServerMessage, { type: "auth.sessionToken" }>;

export interface PendingPairingRequestResult {
  pairingRequestId: string;
  deviceId: string;
  status: "pending";
}

export interface ApprovedPairingRequestResult {
  pairingRequestId: string;
  deviceId: string;
  status: "approved";
  auth: AuthSessionToken;
}

export interface RejectedPairingRequestResult {
  pairingRequestId: string;
  deviceId: string;
  status: "rejected";
  reason: string;
}

export type PairingRequestStatusResult =
  | PendingPairingRequestResult
  | ApprovedPairingRequestResult
  | RejectedPairingRequestResult;

export interface WaitForApprovalOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export interface RevokeSessionTokenInput {
  deviceId: string;
  sessionToken: string;
}

export interface RevokeSessionTokenResult {
  revoked: boolean;
}

export class PairingClient {
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PairingClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async requestPairing(input: PairingRequestInput): Promise<PairingRequestResult> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/pairing/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(body, `Pairing request failed with status ${response.status}.`));
    }

    return parsePairingRequestResult(body);
  }

  async getPairingRequest(pairingRequestId: string): Promise<PairingRequestStatusResult> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/pairing/requests/${encodeURIComponent(pairingRequestId)}`
    );
    const body = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(body, `Pairing status failed with status ${response.status}.`));
    }

    return parsePairingRequestStatusResult(body);
  }

  async waitForApproval(
    pairingRequestId: string,
    options: WaitForApprovalOptions = {}
  ): Promise<AuthSessionToken> {
    const intervalMs = options.intervalMs ?? 1_000;
    const timeoutMs = options.timeoutMs ?? 60_000;
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const status = await this.getPairingRequest(pairingRequestId);

      if (status.status === "approved") {
        return status.auth;
      }

      if (status.status === "rejected") {
        throw new Error(`Pairing rejected: ${status.reason}`);
      }

      await delay(intervalMs);
    }

    throw new Error("Pairing approval timed out.");
  }

  async revokeSessionToken(input: RevokeSessionTokenInput): Promise<RevokeSessionTokenResult> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}/session-tokens/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(body, `Session token revoke failed with status ${response.status}.`));
    }

    return parseRevokeSessionTokenResult(body);
  }
}

function parsePairingRequestResult(input: unknown): PairingRequestResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid pairing response.");
  }

  const body = input as Record<string, unknown>;
  if (
    typeof body.pairingRequestId !== "string" ||
    body.pairingRequestId.trim().length === 0 ||
    typeof body.deviceId !== "string" ||
    body.deviceId.trim().length === 0 ||
    body.status !== "pending"
  ) {
    throw new Error("Invalid pairing response.");
  }

  return {
    pairingRequestId: body.pairingRequestId,
    deviceId: body.deviceId,
    status: "pending"
  };
}

function parsePairingRequestStatusResult(input: unknown): PairingRequestStatusResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid pairing status response.");
  }

  const body = input as Record<string, unknown>;
  const base = parsePairingStatusBase(body);

  if (base.status === "pending") {
    return base;
  }

  if (base.status === "rejected") {
    const reason = body.reason;
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new Error("Invalid pairing status response.");
    }

    return {
      ...base,
      reason
    };
  }

  const auth = parseAuthSessionToken(body.auth);
  if (auth.deviceId !== base.deviceId) {
    throw new Error("Invalid pairing status response.");
  }

  return {
    ...base,
    auth
  };
}

function parsePairingStatusBase(
  body: Record<string, unknown>
):
  | PendingPairingRequestResult
  | Omit<ApprovedPairingRequestResult, "auth">
  | Omit<RejectedPairingRequestResult, "reason"> {
  if (
    typeof body.pairingRequestId !== "string" ||
    body.pairingRequestId.trim().length === 0 ||
    typeof body.deviceId !== "string" ||
    body.deviceId.trim().length === 0 ||
    (body.status !== "pending" && body.status !== "approved" && body.status !== "rejected")
  ) {
    throw new Error("Invalid pairing status response.");
  }

  return {
    pairingRequestId: body.pairingRequestId,
    deviceId: body.deviceId,
    status: body.status
  };
}

function parseAuthSessionToken(input: unknown): AuthSessionToken {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid pairing status response.");
  }

  const body = input as Record<string, unknown>;
  if (
    body.type !== "auth.sessionToken" ||
    typeof body.sessionId !== "string" ||
    body.sessionId.trim().length === 0 ||
    typeof body.deviceId !== "string" ||
    body.deviceId.trim().length === 0 ||
    typeof body.sessionToken !== "string" ||
    body.sessionToken.trim().length === 0 ||
    typeof body.expiresAt !== "string" ||
    body.expiresAt.trim().length === 0
  ) {
    throw new Error("Invalid pairing status response.");
  }

  return {
    type: "auth.sessionToken",
    sessionId: body.sessionId,
    deviceId: body.deviceId,
    sessionToken: body.sessionToken,
    expiresAt: body.expiresAt
  };
}

function readErrorMessage(input: unknown, fallback: string): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fallback;
  }

  const error = (input as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length > 0 ? error : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRevokeSessionTokenResult(input: unknown): RevokeSessionTokenResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid revoke response.");
  }

  const revoked = (input as Record<string, unknown>).revoked;
  if (typeof revoked !== "boolean") {
    throw new Error("Invalid revoke response.");
  }

  return { revoked };
}
