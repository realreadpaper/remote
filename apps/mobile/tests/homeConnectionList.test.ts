import { describe, expect, it } from "vitest";
import {
  buildConnectionListItems,
  buildDeviceStatusLookup,
  buildDevelopmentPreviewConnections,
  getOnlineStatusNotice,
  shouldUseDevelopmentPreviewConnections
} from "../src/state/homeConnectionList";
import type { PairingTokenRecord } from "../src/state/pairingTokenStore";

const readyRecord: PairingTokenRecord = {
  deviceId: "macbook-pro",
  sessionToken: "token-1",
  expiresAt: "2026-05-04T00:00:00.000Z",
  pairedAt: "2026-05-03T10:30:00.000Z"
};

const expiredRecord: PairingTokenRecord = {
  deviceId: "old-mac",
  sessionToken: "token-2",
  expiresAt: "2026-05-02T00:00:00.000Z",
  pairedAt: "2026-05-01T10:30:00.000Z"
};

describe("home connection list", () => {
  it("builds ready device cards with a concise status and subtitle", () => {
    expect(
      buildConnectionListItems([readyRecord], {
        now: () => new Date("2026-05-03T12:00:00.000Z")
      })
    ).toEqual([
      {
        record: readyRecord,
        title: "macbook-pro",
        statusLabel: "Ready",
        statusTone: "ready",
        subtitle: "Paired today · Expires May 4"
      }
    ]);
  });

  it("marks expired connection cards so the user does not open a dead token blindly", () => {
    expect(
      buildConnectionListItems([expiredRecord], {
        now: () => new Date("2026-05-03T12:00:00.000Z")
      })[0]
    ).toMatchObject({
      title: "old-mac",
      statusLabel: "Expired",
      statusTone: "expired",
      subtitle: "Pair again"
    });
  });

  it("uses live server device status when it is available", () => {
    const statuses = buildDeviceStatusLookup([
      {
        deviceId: "macbook-pro",
        deviceName: "He MacBook Pro",
        capabilities: ["terminal"],
        online: true,
        lastSeenAt: "2026-05-03T11:58:00.000Z"
      },
      {
        deviceId: "old-mac",
        deviceName: "Old Mac",
        capabilities: ["terminal"],
        online: false,
        lastSeenAt: "2026-05-03T08:00:00.000Z"
      }
    ]);

    expect(
      buildConnectionListItems([readyRecord, expiredRecord], {
        now: () => new Date("2026-05-03T12:00:00.000Z"),
        deviceStatusesById: statuses
      })
    ).toEqual([
      expect.objectContaining({
        title: "He MacBook Pro",
        statusLabel: "Online",
        statusTone: "online"
      }),
      expect.objectContaining({
        title: "Old Mac",
        statusLabel: "Expired",
        statusTone: "expired"
      })
    ]);
  });

  it("keeps a concise notice when online status cannot be loaded", () => {
    expect(getOnlineStatusNotice("unavailable", 2)).toBe("Online status unavailable. You can still open terminal.");
    expect(getOnlineStatusNotice("ready", 2)).toBeNull();
    expect(getOnlineStatusNotice("unavailable", 0)).toBeNull();
  });

  it("only enables preview connections in explicit non-release development mode", () => {
    expect(shouldUseDevelopmentPreviewConnections({ EXPO_PUBLIC_REMOTE_DEMO_CONNECTIONS: "1" })).toBe(true);
    expect(
      shouldUseDevelopmentPreviewConnections({
        EXPO_PUBLIC_REMOTE_DEMO_CONNECTIONS: "1",
        EXPO_PUBLIC_REMOTE_RELEASE: "1"
      })
    ).toBe(false);
    expect(shouldUseDevelopmentPreviewConnections({})).toBe(false);
  });

  it("builds stable preview connections for simulator visual checks", () => {
    expect(buildDevelopmentPreviewConnections()).toEqual([
      expect.objectContaining({
        deviceId: "MacBook-Pro",
        sessionToken: "preview-token-macbook-pro"
      }),
      expect.objectContaining({
        deviceId: "Home-Mac-mini",
        sessionToken: "preview-token-home-mac-mini"
      })
    ]);
  });
});
