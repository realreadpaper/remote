export interface MobileRuntimeConfig {
  sessionUrl: string;
  displaySessionUrl: string;
  deviceId: string;
  devToken: string | null;
  autoConnect: boolean;
  smokeCommand: string | null;
}

type RuntimeEnv = Record<string, string | undefined>;

export function loadMobileRuntimeConfig(env: RuntimeEnv = process.env): MobileRuntimeConfig {
  const smokeCommand = env.EXPO_PUBLIC_REMOTE_SMOKE_COMMAND?.trim();
  const baseSessionUrl = env.EXPO_PUBLIC_REMOTE_WS_URL ?? "ws://127.0.0.1:8787/ws/mobile";
  const devToken = normalizeOptional(env.EXPO_PUBLIC_REMOTE_DEV_TOKEN);
  const sessionUrl = buildSessionUrl(baseSessionUrl, devToken);

  return {
    sessionUrl,
    displaySessionUrl: buildDisplaySessionUrl(sessionUrl, devToken),
    deviceId: env.EXPO_PUBLIC_REMOTE_DEVICE_ID ?? "mac-dev",
    devToken,
    autoConnect: env.EXPO_PUBLIC_REMOTE_AUTOCONNECT === "1",
    smokeCommand: smokeCommand && smokeCommand.length > 0 ? smokeCommand : null
  };
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

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
