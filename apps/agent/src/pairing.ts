import readline from "node:readline/promises";
import type { ServerMessage } from "@remote/protocol";

export interface PairingApprovalDecision {
  approved: boolean;
  reason?: string;
}

export type PairingCodeDisplay = (
  message: Extract<ServerMessage, { type: "pairing.created" }>
) => void;

export type PairingApprovalPrompt = (
  message: Extract<ServerMessage, { type: "pairing.requested" }>
) => Promise<PairingApprovalDecision> | PairingApprovalDecision;

export const displayPairingCode: PairingCodeDisplay = (message) => {
  console.info(`Pairing code: ${message.pairingCode}`);
  console.info(`Device: ${message.deviceName} (${message.deviceId})`);
  console.info(`Server: ${message.serverUrl}`);
  console.info(`Expires at: ${message.expiresAt}`);
};

export const promptPairingApproval: PairingApprovalPrompt = async (message) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return {
      approved: false,
      reason: "Agent console is not interactive"
    };
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question(
      `Approve pairing for ${message.mobileName} (${message.mobileClientId})? [y/N] `
    );
    const normalized = answer.trim().toLowerCase();

    if (normalized === "y" || normalized === "yes") {
      return { approved: true };
    }

    return {
      approved: false,
      reason: "Pairing rejected by agent user"
    };
  } finally {
    rl.close();
  }
};
