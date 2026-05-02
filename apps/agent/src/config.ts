import os from "node:os";
import { loadOrCreateDeviceIdentity, type DeviceIdentity } from "./identity.js";

export interface AgentConfig {
  serverUrl: string;
  deviceId: string;
  deviceName: string;
  devToken: string | null;
  shell: string;
}

export interface LoadAgentConfigOptions {
  loadIdentity?: () => DeviceIdentity;
}

export function loadAgentConfig(options: LoadAgentConfigOptions = {}): AgentConfig {
  const loadIdentity = options.loadIdentity ?? loadOrCreateDeviceIdentity;

  return {
    serverUrl: process.env.REMOTE_SERVER_URL ?? "ws://127.0.0.1:8787/ws/agent",
    deviceId: normalizeOptional(process.env.REMOTE_DEVICE_ID) ?? loadIdentity().deviceId,
    deviceName: process.env.REMOTE_DEVICE_NAME ?? os.hostname(),
    devToken: normalizeOptional(process.env.REMOTE_DEV_TOKEN),
    shell: process.env.SHELL ?? "/bin/zsh"
  };
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
