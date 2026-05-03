import type { PairingTokenRecord } from "./pairingTokenStore";

export type ConnectionStatusTone = "ready" | "expired";

export interface ConnectionListItem {
  record: PairingTokenRecord;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: ConnectionStatusTone;
}

export interface BuildConnectionListOptions {
  now?: () => Date;
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

    return {
      record,
      title: record.deviceId,
      statusLabel: expired ? "Expired" : "Ready",
      statusTone: expired ? "expired" : "ready",
      subtitle: expired ? "Pair again" : `${formatPairedAt(record.pairedAt, now)} · Expires ${formatShortDate(record.expiresAt)}`
    };
  });
}

export function shouldUseDevelopmentPreviewConnections(env: RuntimeEnv = process.env): boolean {
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
