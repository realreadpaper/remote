import os from "node:os";

export interface AgentConfig {
  serverUrl: string;
  deviceId: string;
  deviceName: string;
  shell: string;
}

export function loadAgentConfig(): AgentConfig {
  return {
    serverUrl: process.env.REMOTE_SERVER_URL ?? "ws://127.0.0.1:8787/ws/agent",
    deviceId: process.env.REMOTE_DEVICE_ID ?? `${os.hostname()}-dev`,
    deviceName: process.env.REMOTE_DEVICE_NAME ?? os.hostname(),
    shell: process.env.SHELL ?? "/bin/zsh"
  };
}
