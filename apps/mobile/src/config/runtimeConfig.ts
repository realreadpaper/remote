export interface MobileRuntimeConfig {
  sessionUrl: string;
  displaySessionUrl: string;
  apiBaseUrl: string;
  displayApiBaseUrl: string;
  deviceId: string;
  mobileClientId: string;
  mobileName: string;
  devToken: string | null;
  autoConnect: boolean;
  smokeCommand: string | null;
  autoPairingCode: string | null;
}

type RuntimeEnv = Record<string, string | undefined>;

export interface AutoConnectDecisionInput {
  autoConnect: boolean;
  autoPairingCode: string | null;
  autoConnectAttempted: boolean;
  sessionToken: string | null;
}

export function loadMobileRuntimeConfig(env: RuntimeEnv = process.env): MobileRuntimeConfig {
  const smokeCommand = env.EXPO_PUBLIC_REMOTE_SMOKE_COMMAND?.trim();
  const autoPairingCode = normalizeOptional(env.EXPO_PUBLIC_REMOTE_AUTO_PAIRING_CODE);
  const release = env.EXPO_PUBLIC_REMOTE_RELEASE === "1";
  const relayHost = normalizeOptional(env.EXPO_PUBLIC_REMOTE_RELAY_HOST);
  const baseSessionUrl =
    normalizeOptional(env.EXPO_PUBLIC_REMOTE_WS_URL) ?? (relayHost ? `wss://${relayHost}/ws/mobile` : "ws://127.0.0.1:8787/ws/mobile");
  const devToken = normalizeOptional(env.EXPO_PUBLIC_REMOTE_DEV_TOKEN);
  const sessionUrl = buildSessionUrl(baseSessionUrl, devToken);
  const apiBaseUrl =
    normalizeOptional(env.EXPO_PUBLIC_REMOTE_API_URL) ?? (relayHost ? `https://${relayHost}` : deriveApiBaseUrl(baseSessionUrl));

  if (release) {
    if (!devToken) {
      throw new Error("EXPO_PUBLIC_REMOTE_DEV_TOKEN is required when EXPO_PUBLIC_REMOTE_RELEASE=1");
    }
    if (isPlaceholderToken(devToken)) {
      throw new Error("Release mobile dev token must not be a placeholder");
    }
    assertNoReleasePlaceholder(sessionUrl, "Release mobile endpoint");
    assertNoReleasePlaceholder(apiBaseUrl, "Release mobile endpoint");
  }

  return {
    sessionUrl,
    displaySessionUrl: buildDisplaySessionUrl(sessionUrl, devToken),
    apiBaseUrl,
    displayApiBaseUrl: apiBaseUrl,
    deviceId: env.EXPO_PUBLIC_REMOTE_DEVICE_ID ?? "mac-dev",
    mobileClientId: normalizeOptional(env.EXPO_PUBLIC_REMOTE_MOBILE_CLIENT_ID) ?? "mobile-dev",
    mobileName: normalizeOptional(env.EXPO_PUBLIC_REMOTE_MOBILE_NAME) ?? "iPhone",
    devToken,
    autoConnect: env.EXPO_PUBLIC_REMOTE_AUTOCONNECT === "1",
    smokeCommand: smokeCommand && smokeCommand.length > 0 ? smokeCommand : null,
    autoPairingCode
  };
}

function isPlaceholderToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  return normalized.includes("replace") || normalized.includes("<") || normalized.includes(">");
}

function assertNoReleasePlaceholder(rawUrl: string, context: string): void {
  const url = new URL(rawUrl);
  const host = url.host;
  if (
    host === "api.example.com" ||
    host.endsWith(".example.invalid") ||
    host.includes("<") ||
    host.includes(">")
  ) {
    throw new Error(`${context} must not use placeholder host ${host}`);
  }
}

export function shouldAutoConnectTerminal(input: AutoConnectDecisionInput): boolean {
  if (!input.autoConnect || input.autoConnectAttempted) {
    return false;
  }

  return !input.autoPairingCode || Boolean(input.sessionToken);
}

function buildSessionUrl(baseSessionUrl: string, devToken: string | null): string {
  if (!devToken) {
    return baseSessionUrl;
  }

  const url = new URL(baseSessionUrl);
  url.searchParams.set("token", devToken);
  return url.toString();
}

function buildDisplaySessionUrl(sessionUrl: string, devToken: string | null): string {
  if (!devToken) {
    return sessionUrl;
  }

  const url = new URL(sessionUrl);
  url.searchParams.set("token", "redacted");
  return url.toString();
}

function deriveApiBaseUrl(sessionUrl: string): string {
  const url = new URL(sessionUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
