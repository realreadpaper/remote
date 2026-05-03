import os from "node:os";
import { loadOrCreateDeviceIdentity, type DeviceIdentity } from "./identity.js";

export interface AgentConfig {
  serverUrl: string;
  deviceId: string;
  deviceName: string;
  devToken: string | null;
  shell: string;
  terminalOutputChunkBytes: number;
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
    shell: process.env.SHELL ?? "/bin/zsh",
    terminalOutputChunkBytes: parsePositiveIntegerEnv(
      process.env.REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES,
      16_384,
      "REMOTE_TERMINAL_OUTPUT_CHUNK_BYTES"
    )
  };
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function parsePositiveIntegerEnv(rawValue: string | undefined, defaultValue: number, envName: string): number {
  const normalized = normalizeOptional(rawValue);
  if (!normalized) {
    return defaultValue;
  }

  const value = Number(normalized);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${envName} must be a positive integer`);
  }

  return value;
}
