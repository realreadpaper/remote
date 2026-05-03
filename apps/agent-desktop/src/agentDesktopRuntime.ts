import { AgentClient, type AgentClientDependencies } from "@remote/agent/agentClient";
import type { AgentConfig } from "@remote/agent/config";
import type { PairingApprovalDecision } from "@remote/agent/pairing";
import type { ServerMessage } from "@remote/protocol";
import {
  createInitialDesktopState,
  type DesktopState,
  withConnectionStatus,
  withPairingCreated,
  withPairingDecision,
  withPairingRequest,
  withTerminalEnabled
} from "./desktopState.js";

interface ManagedAgentClient {
  connect(): void;
  close(): void;
}

export interface AgentDesktopRuntimeDependencies {
  createAgentClient?: (dependencies: AgentClientDependencies) => ManagedAgentClient;
  createQrDataUrl: (payload: string) => Promise<string>;
  onStateChange?: (state: DesktopState) => void;
}

type PairingResolver = (decision: PairingApprovalDecision) => void;

export class AgentDesktopRuntime {
  private state: DesktopState;
  private agentClient: ManagedAgentClient | null = null;
  private readonly createAgentClient: (dependencies: AgentClientDependencies) => ManagedAgentClient;
  private readonly createQrDataUrl: (payload: string) => Promise<string>;
  private readonly onStateChange?: (state: DesktopState) => void;
  private pairingResolver: PairingResolver | null = null;

  constructor(
    private readonly config: AgentConfig,
    dependencies: AgentDesktopRuntimeDependencies
  ) {
    this.state = createInitialDesktopState(config);
    this.createAgentClient =
      dependencies.createAgentClient ?? ((agentDependencies) => new AgentClient(config, agentDependencies));
    this.createQrDataUrl = dependencies.createQrDataUrl;
    this.onStateChange = dependencies.onStateChange;
  }

  getState(): DesktopState {
    return this.state;
  }

  start(): void {
    if (this.agentClient) {
      return;
    }

    this.updateState(withTerminalEnabled(this.state, true));
    this.updateState(withConnectionStatus(this.state, "connecting", "Connecting to relay."));
    const client = this.createAgentClient({
      displayPairingCode: (message) => {
        void this.handlePairingCreated(message);
      },
      approvePairingRequest: (message) => this.handlePairingRequested(message)
    });
    this.agentClient = client;
    client.connect();
  }

  stop(): void {
    const client = this.agentClient;
    this.agentClient = null;

    if (client) {
      client.close();
    }

    this.updateState(withTerminalEnabled(this.state, false));
    this.updateState(withConnectionStatus(this.state, "stopped", "Agent is stopped."));
  }

  setTerminalEnabled(enabled: boolean): void {
    if (enabled) {
      this.updateState(withTerminalEnabled(this.state, true));
      this.start();
      return;
    }

    this.stop();
  }

  async handlePairingCreated(message: Extract<ServerMessage, { type: "pairing.created" }>): Promise<void> {
    const payload = JSON.stringify({
      serverUrl: message.serverUrl,
      deviceId: message.deviceId,
      deviceName: message.deviceName,
      pairingCode: message.pairingCode,
      expiresAt: message.expiresAt
    });
    const qrDataUrl = await this.createQrDataUrl(payload);

    this.updateState(withConnectionStatus(this.state, "online", "Agent is online."));
    this.updateState(withPairingCreated(this.state, message, qrDataUrl));
  }

  handlePairingRequested(
    message: Extract<ServerMessage, { type: "pairing.requested" }>
  ): Promise<PairingApprovalDecision> {
    this.pairingResolver?.({
      approved: false,
      reason: "Superseded by a newer pairing request"
    });

    this.updateState(withPairingRequest(this.state, message));

    return new Promise((resolve) => {
      this.pairingResolver = resolve;
    });
  }

  approvePairing(): void {
    this.resolvePairing({ approved: true });
  }

  rejectPairing(): void {
    this.resolvePairing({
      approved: false,
      reason: "Pairing rejected in desktop agent"
    });
  }

  private resolvePairing(decision: PairingApprovalDecision): void {
    const resolver = this.pairingResolver;
    this.pairingResolver = null;

    if (resolver) {
      resolver(decision);
    }

    this.updateState(withPairingDecision(this.state));
  }

  private updateState(state: DesktopState): void {
    this.state = state;
    this.onStateChange?.(this.state);
  }
}
