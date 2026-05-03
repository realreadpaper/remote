export const mobileShellTheme = {
  colors: {
    appBackground: "#f7f7f5",
    splashBackground: "#f7f7f5",
    panel: "#ffffff",
    panelMuted: "#eeeeec",
    panelBorder: "#d8d8d6",
    textPrimary: "#111111",
    textSecondary: "#4c4c4a",
    textMuted: "#777773",
    terminalBackground: "#111315",
    terminalBorder: "#24282b",
    terminalText: "#f2f3ef",
    terminalMuted: "#a5aaa4",
    commandBackground: "#ffffff",
    commandBorder: "#d6d6d3",
    accent: "#007aff",
    accentPressed: "#0057d9",
    accentText: "#ffffff",
    warning: "#a85b00",
    warningSurface: "#fff8ef",
    online: "#248a3d",
    connecting: "#c77700",
    offline: "#777773",
    danger: "#d70015",
    dangerSurface: "#fff2f3"
  },
  layout: {
    headerMinHeight: 64,
    panelRadius: 8,
    terminalRadius: 8,
    inputMinHeight: 44,
    shortcutHeight: 30,
    horizontalPadding: 16,
    sectionGap: 8
  },
  fonts: {
    terminal: { ios: "Menlo", android: "monospace", default: "monospace" } as const
  }
} as const;

export interface ConnectionStatusInput {
  connected: boolean;
  connecting: boolean;
  deviceId: string;
}

export function getConnectionStatusLabel(input: ConnectionStatusInput): string {
  if (input.connected) {
    return "Online";
  }

  if (input.connecting) {
    return "Connecting";
  }

  return input.deviceId;
}

export type PairingPanelMode = "setup" | "paired";

export function getPairingPanelMode(pairedDeviceId: string | null): PairingPanelMode {
  return pairedDeviceId ? "paired" : "setup";
}
