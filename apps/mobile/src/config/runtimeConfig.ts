export interface MobileRuntimeConfig {
  sessionUrl: string;
  deviceId: string;
  autoConnect: boolean;
  smokeCommand: string | null;
}

type RuntimeEnv = Record<string, string | undefined>;

export function loadMobileRuntimeConfig(env: RuntimeEnv = process.env): MobileRuntimeConfig {
  const smokeCommand = env.EXPO_PUBLIC_REMOTE_SMOKE_COMMAND?.trim();

  return {
    sessionUrl: env.EXPO_PUBLIC_REMOTE_WS_URL ?? "ws://127.0.0.1:8787/ws/mobile",
    deviceId: env.EXPO_PUBLIC_REMOTE_DEVICE_ID ?? "mac-dev",
    autoConnect: env.EXPO_PUBLIC_REMOTE_AUTOCONNECT === "1",
    smokeCommand: smokeCommand && smokeCommand.length > 0 ? smokeCommand : null
  };
}
