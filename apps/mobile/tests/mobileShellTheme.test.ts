import { describe, expect, it } from "vitest";
import { getConnectionStatusLabel, getPairingPanelMode, mobileShellTheme } from "../src/components/mobileShellTheme";

describe("mobile shell theme", () => {
  it("uses a non-black app background and a distinct terminal surface", () => {
    expect(mobileShellTheme.colors.appBackground).not.toMatch(/^#0[0-9a-f]{5}$/i);
    expect(mobileShellTheme.colors.appBackground).not.toBe(mobileShellTheme.colors.terminalBackground);
    expect(mobileShellTheme.colors.splashBackground).toBe(mobileShellTheme.colors.appBackground);
  });

  it("keeps connection status labels short for narrow phones", () => {
    expect(getConnectionStatusLabel({ connected: true, connecting: false, deviceId: "home-mac" })).toBe("Online");
    expect(getConnectionStatusLabel({ connected: false, connecting: true, deviceId: "home-mac" })).toBe("Connecting");
    expect(getConnectionStatusLabel({ connected: false, connecting: false, deviceId: "home-mac" })).toBe("home-mac");
  });

  it("collapses pairing controls after a device is paired", () => {
    expect(getPairingPanelMode(null)).toBe("setup");
    expect(getPairingPanelMode("home-mac")).toBe("paired");
  });
});
