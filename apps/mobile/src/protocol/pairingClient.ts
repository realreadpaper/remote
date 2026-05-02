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

function readErrorMessage(input: unknown, fallback: string): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fallback;
  }

  const error = (input as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length > 0 ? error : fallback;
}
