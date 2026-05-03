import type { AgentConfig } from "@remote/agent/config";
import type { ServerMessage } from "@remote/protocol";

export type ConnectionStatus = "stopped" | "connecting" | "online" | "offline" | "error";

export interface PendingPairingRequest {
  pairingRequestId: string;
  mobileClientId: string;
  mobileName: string;
  requestedAt: string;
}

export interface DesktopState {
  deviceName: string;
  deviceId: string;
  serverUrl: string;
  shell: string;
  terminalEnabled: boolean;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  pairingCode: string | null;
  pairingQrDataUrl: string | null;
  pairingExpiresAt: string | null;
  pendingPairingRequest: PendingPairingRequest | null;
}

export function createInitialDesktopState(config: AgentConfig): DesktopState {
  return {
    deviceName: config.deviceName,
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    shell: config.shell,
    terminalEnabled: true,
    connectionStatus: "stopped",
    statusMessage: "Agent is stopped.",
    pairingCode: null,
    pairingQrDataUrl: null,
    pairingExpiresAt: null,
    pendingPairingRequest: null
  };
}

export function withConnectionStatus(
  state: DesktopState,
  connectionStatus: ConnectionStatus,
  statusMessage: string
): DesktopState {
  return {
    ...state,
    connectionStatus,
    statusMessage
  };
}

export function withPairingCreated(
  state: DesktopState,
  message: Extract<ServerMessage, { type: "pairing.created" }>,
  pairingQrDataUrl: string
): DesktopState {
  return {
    ...state,
    pairingCode: message.pairingCode,
    pairingQrDataUrl,
    pairingExpiresAt: message.expiresAt
  };
}

export function withPairingRequest(
  state: DesktopState,
  message: Extract<ServerMessage, { type: "pairing.requested" }>
): DesktopState {
  return {
    ...state,
    pendingPairingRequest: {
      pairingRequestId: message.pairingRequestId,
      mobileClientId: message.mobileClientId,
      mobileName: message.mobileName,
      requestedAt: message.requestedAt
    }
  };
}

export function withPairingDecision(state: DesktopState): DesktopState {
  return {
    ...state,
    pendingPairingRequest: null
  };
}

export function withTerminalEnabled(state: DesktopState, terminalEnabled: boolean): DesktopState {
  return {
    ...state,
    terminalEnabled
  };
}
