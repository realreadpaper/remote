export const mobileShellTheme = {
  colors: {
    appBackground: "#f4f0e7",
    splashBackground: "#f4f0e7",
    panel: "#fffdf7",
    panelMuted: "#ebe3d5",
    panelBorder: "#d8cfc0",
    textPrimary: "#1d2528",
    textSecondary: "#5c666b",
    textMuted: "#7d8588",
    terminalBackground: "#151a1d",
    terminalBorder: "#2d373c",
    terminalText: "#e9f0e8",
    terminalMuted: "#9da8a2",
    commandBackground: "#ffffff",
    commandBorder: "#cfc6b8",
    accent: "#1f7663",
    accentPressed: "#185f50",
    accentText: "#ffffff",
    warning: "#b15d18",
    warningSurface: "#fff2df",
    online: "#23935f",
    connecting: "#c9831c",
    offline: "#9b5a25",
    danger: "#9f3c2f",
    dangerSurface: "#fff0ec"
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
