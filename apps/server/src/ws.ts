import type { FastifyInstance } from "fastify";
import { WebSocket, type RawData } from "ws";
import {
  encodeMessage,
  parseClientMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage
} from "@remote/protocol";
import { DeviceRegistry } from "./deviceRegistry.js";
import { SessionHub } from "./sessionHub.js";
import type { ServerConfig } from "./config.js";

type MobileRoutableMessage = Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" }>;
type AgentRoutableMessage = Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>;
type AgentSendCallback = (
  message:
    | Extract<ServerMessage, { type: "session.opened" }>
    | Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" | "terminal.close" }>
) => void;

function messageText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJson(data: RawData): unknown {
  return JSON.parse(data.toString());
}

function messageType(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    return undefined;
  }

  const type = (payload as { type: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

function sendJson(socket: WebSocket, message: ClientMessage | ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket is not open");
  }

  socket.send(encodeMessage(message));
}

function sendSessionError(socket: WebSocket, message: string, sessionId?: string): boolean {
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  sendJson(socket, { type: "session.error", code: "SESSION_ERROR", message, sessionId });
  return true;
}

function isMobileRoutableMessage(message: ClientMessage): message is MobileRoutableMessage {
  return message.type === "terminal.input" || message.type === "terminal.resize";
}

function isAgentRoutableMessage(message: ServerMessage): message is AgentRoutableMessage {
  return message.type === "terminal.output" || message.type === "terminal.exit";
}

export function registerWsRoutes(app: FastifyInstance, _config?: ServerConfig): void {
  const registry = new DeviceRegistry();
  const hub = new SessionHub();
  const agentOwners = new Map<string, AgentSendCallback>();

  app.get("/health", async () => ({ ok: true }));
  app.get("/devices", async () => ({ devices: registry.list() }));

  app.get("/ws/agent", { websocket: true }, (socket) => {
    let attachedDeviceId: string | undefined;

    const agentSend: AgentSendCallback = (message): void => {
      sendJson(socket, message);
    };

    socket.on("message", (data) => {
      try {
        const payload = parseJson(data);

        if (!attachedDeviceId) {
          if (messageType(payload) !== "device.register") {
            throw new Error("Agent must send device.register before terminal messages");
          }

          const message = parseClientMessage(payload);
          if (message.type !== "device.register") {
            throw new Error("Agent must send device.register before terminal messages");
          }

          registry.register({
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            capabilities: message.capabilities
          });
          attachedDeviceId = message.deviceId;
          hub.attachAgent(message.deviceId, agentSend);
          agentOwners.set(message.deviceId, agentSend);
          sendJson(socket, { type: "device.registered", deviceId: message.deviceId });
          return;
        }

        const message = parseServerMessage(payload);
        if (!isAgentRoutableMessage(message)) {
          throw new Error(`Unsupported agent message type ${message.type}`);
        }

        hub.routeFromAgent(attachedDeviceId, agentSend, message);
      } catch (error) {
        sendSessionError(socket, messageText(error));
      }
    });

    socket.on("close", () => {
      if (!attachedDeviceId) {
        return;
      }

      if (agentOwners.get(attachedDeviceId) !== agentSend) {
        return;
      }

      agentOwners.delete(attachedDeviceId);
      registry.markOffline(attachedDeviceId);
      hub.detachAgent(attachedDeviceId, agentSend);
    });
  });

  app.get("/ws/mobile", { websocket: true }, (socket) => {
    const mobileSend = (message: Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>): void => {
      sendJson(socket, message);
    };

    socket.on("message", (data) => {
      let sessionId: string | undefined;

      try {
        const message = parseClientMessage(parseJson(data));
        sessionId = "sessionId" in message ? message.sessionId : undefined;

        if (message.type === "session.open") {
          const session = hub.openSession(message.deviceId, mobileSend);
          sendJson(socket, {
            type: "session.opened",
            sessionId: session.sessionId,
            deviceId: session.deviceId
          });
          return;
        }

        if (!isMobileRoutableMessage(message)) {
          throw new Error(`Unsupported mobile message type ${message.type}`);
        }

        hub.routeFromMobile(mobileSend, message);
      } catch (error) {
        sendSessionError(socket, messageText(error), sessionId);
      }
    });

    socket.on("close", () => {
      hub.closeMobile(mobileSend);
    });
  });
}
