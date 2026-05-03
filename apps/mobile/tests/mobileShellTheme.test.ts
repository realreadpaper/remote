import { describe, expect, it } from "vitest";
import { getConnectionStatusLabel, getPairingPanelMode, mobileShellTheme } from "../src/components/mobileShellTheme";

describe("mobile shell theme", () => {
  it("uses a non-black app background and a distinct terminal surface", () => {
    expect(mobileShellTheme.colors.appBackground).not.toMatch(/^#0[0-9a-f]{5}$/i);
    expect(mobileShellTheme.colors.appBackground).not.toBe(mobileShellTheme.colors.terminalBackground);
    expect(mobileShellTheme.colors.splashBackground).toBe(mobileShellTheme.colors.appBackground);
  });

  it("uses a restrained iOS tool palette with one clear primary action", () => {
    expect(mobileShellTheme.colors.appBackground).toBe("#f7f7f5");
    expect(mobileShellTheme.colors.panel).toBe("#ffffff");
    expect(mobileShellTheme.colors.terminalBackground).toBe("#111315");
    expect(mobileShellTheme.colors.accent).toBe("#007aff");
    expect(mobileShellTheme.colors.textPrimary).toBe("#111111");
  });

  it("exposes compact stable layout tokens for a terminal-first screen", () => {
    expect(mobileShellTheme).toHaveProperty("layout");

    const layout = mobileShellTheme.layout;
    expect(layout.headerMinHeight).toBeLessThanOrEqual(68);
    expect(layout.panelRadius).toBeLessThanOrEqual(8);
    expect(layout.terminalRadius).toBeLessThanOrEqual(8);
    expect(layout.inputMinHeight).toBe(44);
    expect(layout.shortcutHeight).toBeLessThanOrEqual(30);
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
