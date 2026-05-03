import type { RegisteredDeviceStatus } from "../protocol/deviceStatusClient";
import type { PairingTokenRecord } from "./pairingTokenStore";

export type ConnectionStatusTone = "online" | "offline" | "ready" | "expired";
export type OnlineStatusState = "ready" | "unavailable";

export interface ConnectionListItem {
  record: PairingTokenRecord;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: ConnectionStatusTone;
}

export interface BuildConnectionListOptions {
  now?: () => Date;
  deviceStatusesById?: Record<string, RegisteredDeviceStatus>;
}

type RuntimeEnv = Record<string, string | undefined>;

export function buildConnectionListItems(
  records: PairingTokenRecord[],
  options: BuildConnectionListOptions = {}
): ConnectionListItem[] {
  const now = options.now?.() ?? new Date();

  return records.map((record) => {
    const expiresAt = new Date(record.expiresAt);
    const expired = expiresAt.getTime() <= now.getTime();
    const deviceStatus = options.deviceStatusesById?.[record.deviceId];
    const status = buildStatus(expired, deviceStatus);

    return {
      record,
      title: deviceStatus?.deviceName ?? record.deviceId,
      statusLabel: status.label,
      statusTone: status.tone,
      subtitle: expired ? "Pair again" : `${formatPairedAt(record.pairedAt, now)} · Expires ${formatShortDate(record.expiresAt)}`
    };
  });
}

export function buildDeviceStatusLookup(devices: RegisteredDeviceStatus[]): Record<string, RegisteredDeviceStatus> {
  return Object.fromEntries(devices.map((device) => [device.deviceId, device]));
}

export function getOnlineStatusNotice(state: OnlineStatusState, savedConnectionCount: number): string | null {
  if (state === "unavailable" && savedConnectionCount > 0) {
    return "Online status unavailable. You can still open terminal.";
  }

  return null;
}

export function shouldUseDevelopmentPreviewConnections(env: RuntimeEnv = readRuntimeEnv()): boolean {
  return env.EXPO_PUBLIC_REMOTE_DEMO_CONNECTIONS === "1" && env.EXPO_PUBLIC_REMOTE_RELEASE !== "1";
}

export function buildDevelopmentPreviewConnections(): PairingTokenRecord[] {
  return [
    {
      deviceId: "MacBook-Pro",
      sessionToken: "preview-token-macbook-pro",
      expiresAt: "2026-12-31T00:00:00.000Z",
      pairedAt: "2026-05-03T10:30:00.000Z"
    },
    {
      deviceId: "Home-Mac-mini",
      sessionToken: "preview-token-home-mac-mini",
      expiresAt: "2026-12-31T00:00:00.000Z",
      pairedAt: "2026-05-02T16:00:00.000Z"
    }
  ];
}

function buildStatus(
  expired: boolean,
  deviceStatus: RegisteredDeviceStatus | undefined
): { label: string; tone: ConnectionStatusTone } {
  if (expired) {
    return { label: "Expired", tone: "expired" };
  }

  if (!deviceStatus) {
    return { label: "Ready", tone: "ready" };
  }

  return deviceStatus.online
    ? { label: "Online", tone: "online" }
    : { label: "Offline", tone: "offline" };
}

function readRuntimeEnv(): RuntimeEnv {
  const processLike = (globalThis as { process?: { env?: RuntimeEnv } }).process;
  return processLike?.env ?? {};
}

function formatPairedAt(value: string, now: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Paired";
  }

  if (date.toDateString() === now.toDateString()) {
    return "Paired today";
  }

  return `Paired ${formatShortDate(value)}`;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
