import os from "node:os";

export interface AgentConfig {
  serverUrl: string;
  deviceId: string;
  deviceName: string;
  devToken: string | null;
  shell: string;
}

export function loadAgentConfig(): AgentConfig {
  return {
    serverUrl: process.env.REMOTE_SERVER_URL ?? "ws://127.0.0.1:8787/ws/agent",
    deviceId: process.env.REMOTE_DEVICE_ID ?? `${os.hostname()}-dev`,
    deviceName: process.env.REMOTE_DEVICE_NAME ?? os.hostname(),
    devToken: normalizeOptional(process.env.REMOTE_DEV_TOKEN),
    shell: process.env.SHELL ?? "/bin/zsh"
  };
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
