export type DeviceCapability = "terminal" | "file" | "desktop";

export interface RegisteredDeviceStatus {
  deviceId: string;
  deviceName: string;
  capabilities: DeviceCapability[];
  online: boolean;
  lastSeenAt: string;
}

export interface DeviceStatusClientOptions {
  apiBaseUrl: string;
  devToken?: string | null;
  fetchImpl?: typeof fetch;
}

export class DeviceStatusClient {
  private readonly apiBaseUrl: string;
  private readonly devToken: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeviceStatusClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.devToken = options.devToken ?? null;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listDevices(): Promise<RegisteredDeviceStatus[]> {
    const url = `${this.apiBaseUrl}/devices`;
    const response = this.devToken
      ? await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.devToken}` } })
      : await this.fetchImpl(url);
    const body = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(body, `Device status failed with status ${response.status}.`));
    }

    return parseDevicesResponse(body);
  }
}

function parseDevicesResponse(input: unknown): RegisteredDeviceStatus[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid devices response.");
  }

  const devices = (input as Record<string, unknown>).devices;
  if (!Array.isArray(devices)) {
    throw new Error("Invalid devices response.");
  }

  return devices.map(parseRegisteredDeviceStatus);
}

function parseRegisteredDeviceStatus(input: unknown): RegisteredDeviceStatus {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid devices response.");
  }

  const body = input as Record<string, unknown>;
  if (
    typeof body.deviceId !== "string" ||
    body.deviceId.trim().length === 0 ||
    typeof body.deviceName !== "string" ||
    body.deviceName.trim().length === 0 ||
    !Array.isArray(body.capabilities) ||
    !body.capabilities.every(isDeviceCapability) ||
    typeof body.online !== "boolean" ||
    typeof body.lastSeenAt !== "string" ||
    body.lastSeenAt.trim().length === 0
  ) {
    throw new Error("Invalid devices response.");
  }

  return {
    deviceId: body.deviceId,
    deviceName: body.deviceName,
    capabilities: body.capabilities,
    online: body.online,
    lastSeenAt: body.lastSeenAt
  };
}

function isDeviceCapability(value: unknown): value is DeviceCapability {
  return value === "terminal" || value === "file" || value === "desktop";
}

function readErrorMessage(input: unknown, fallback: string): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fallback;
  }

  const error = (input as Record<string, unknown>).error;
  return typeof error === "string" && error.trim().length > 0 ? error : fallback;
}
