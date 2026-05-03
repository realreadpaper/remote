import type { FastifyInstance } from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
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
import { getProvidedDevToken, validateDevToken } from "./auth/devToken.js";
import { JsonFileSessionTokenStore, MemorySessionTokenStore, type SessionTokenStore } from "./auth/sessionTokens.js";
import { JsonFilePairingStore, MemoryPairingStore, type PairingStore } from "./pairing/pairingStore.js";
import { PairingService } from "./pairing/pairingService.js";
import { MemoryRateLimiter, MemoryWeightedRateLimiter } from "./rateLimit.js";
import { join } from "node:path";

type MobileRoutableMessage = Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" }>;
type AgentRoutableMessage = Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>;
type AgentPairingMessage = Extract<ClientMessage, { type: "pairing.create" | "pairing.approved" | "pairing.rejected" }>;
type AgentSendCallback = (
  message:
    | Extract<ServerMessage, { type: "session.opened" }>
    | Extract<ServerMessage, { type: "pairing.created" | "pairing.requested" }>
    | Extract<ClientMessage, { type: "terminal.input" | "terminal.resize" | "terminal.close" }>
) => void;

function messageText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJson(data: RawData, maxBytes: number): unknown {
  const byteLength = rawDataByteLength(data);
  if (byteLength > maxBytes) {
    throw new Error(`WebSocket message exceeds ${maxBytes} bytes`);
  }

  return JSON.parse(data.toString());
}

function rawDataByteLength(data: RawData): number {
  if (typeof data === "string") {
    return Buffer.byteLength(data, "utf8");
  }

  if (Array.isArray(data)) {
    return data.reduce((total, chunk) => total + chunk.byteLength, 0);
  }

  return data.byteLength;
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

function readRequiredString(input: Record<string, unknown>, fieldName: string): string {
  const value = input[fieldName];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function parsePairingRequestBody(body: unknown): { pairingCode: string; mobileClientId: string; mobileName: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be an object");
  }

  const input = body as Record<string, unknown>;
  return {
    pairingCode: readRequiredString(input, "pairingCode"),
    mobileClientId: readRequiredString(input, "mobileClientId"),
    mobileName: readRequiredString(input, "mobileName")
  };
}

function parseRevokeSessionTokenBody(body: unknown): { deviceId: string; sessionToken: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be an object");
  }

  const input = body as Record<string, unknown>;
  return {
    deviceId: readRequiredString(input, "deviceId"),
    sessionToken: readRequiredString(input, "sessionToken")
  };
}

function readPairingRequestIdParam(params: unknown): string {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new Error("pairingRequestId is required");
  }

  return readRequiredString(params as Record<string, unknown>, "pairingRequestId");
}

function isAuthorizedWebSocket(
  socket: WebSocket,
  request: { url: string; headers: Record<string, unknown> },
  config: ServerConfig
): boolean {
  if (validateDevToken(config, getProvidedDevToken(request))) {
    return true;
  }

  socket.close(1008, "Unauthorized");
  return false;
}

function isAuthorizedHttpRequest(request: FastifyRequest, reply: FastifyReply, config: ServerConfig): boolean {
  if (validateDevToken(config, getProvidedDevToken({ url: request.url, headers: request.headers }))) {
    return true;
  }

  reply.code(401).send({ error: "Unauthorized" });
  return false;
}

function isAllowedHttpRate(
  request: FastifyRequest,
  reply: FastifyReply,
  limiter: MemoryRateLimiter,
  scope: string
): boolean {
  const result = limiter.check(`${scope}:${clientKey(request)}`);
  if (result.allowed) {
    return true;
  }

  reply.header("Retry-After", String(Math.ceil(result.retryAfterMs / 1_000)));
  reply.code(429).send({ error: "Rate limit exceeded", retryAfterMs: result.retryAfterMs });
  return false;
}

function isAllowedWebSocketMessageRate(limiter: MemoryRateLimiter, key: string): boolean {
  return limiter.check(key).allowed;
}

function isAllowedAgentOutputRate(limiter: MemoryRateLimiter, deviceId: string): boolean {
  return limiter.check(`ws.agent.output:${deviceId}`).allowed;
}

function isAllowedAgentOutputByteRate(
  limiter: MemoryWeightedRateLimiter,
  deviceId: string,
  message: Extract<ServerMessage, { type: "terminal.output" }>
): boolean {
  return limiter.check(`ws.agent.output.bytes:${deviceId}`, Buffer.byteLength(message.data, "utf8")).allowed;
}

function clientKey(request: FastifyRequest): string {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]?.split(",")[0]?.trim() || "unknown";
  }

  return request.ip || "unknown";
}

function isMobileRoutableMessage(message: ClientMessage): message is MobileRoutableMessage {
  return message.type === "terminal.input" || message.type === "terminal.resize";
}

function assertTerminalInputSize(message: MobileRoutableMessage, maxBytes: number): void {
  if (message.type !== "terminal.input") {
    return;
  }

  if (Buffer.byteLength(message.data, "utf8") > maxBytes) {
    throw new Error(`Terminal input exceeds ${maxBytes} bytes`);
  }
}

function isAgentRoutableMessage(message: ServerMessage): message is AgentRoutableMessage {
  return message.type === "terminal.output" || message.type === "terminal.exit";
}

function isAgentPairingMessage(message: ClientMessage): message is AgentPairingMessage {
  return message.type === "pairing.create" || message.type === "pairing.approved" || message.type === "pairing.rejected";
}

function serverBaseUrl(config: ServerConfig): string {
  return config.publicBaseUrl ?? `http://${config.host}:${config.port}`;
}

export function registerWsRoutes(app: FastifyInstance, config: ServerConfig): void {
  const registry = new DeviceRegistry();
  const hub = new SessionHub();
  const pairingStore = createPairingStore(config);
  const sessionTokens = createSessionTokenStore(config);
  const pairing = new PairingService(pairingStore);
  const agentOwners = new Map<string, AgentSendCallback>();
  const httpRateLimiter = new MemoryRateLimiter({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests
  });
  const wsMessageRateLimiter = new MemoryRateLimiter({
    windowMs: config.wsMessageRateLimitWindowMs,
    maxRequests: config.wsMessageRateLimitMaxRequests
  });
  const agentOutputRateLimiter = new MemoryRateLimiter({
    windowMs: config.agentOutputRateLimitWindowMs,
    maxRequests: config.agentOutputRateLimitMaxMessages
  });
  const agentOutputByteRateLimiter = new MemoryWeightedRateLimiter({
    windowMs: config.agentOutputByteRateLimitWindowMs,
    maxRequests: config.agentOutputByteRateLimitMaxBytes
  });

  app.get("/health", async () => ({ ok: true }));
  app.get("/devices", async () => ({ devices: registry.list() }));
  app.get("/pairing/bindings", async (request, reply) => {
    if (!isAuthorizedHttpRequest(request, reply, config)) {
      return reply;
    }
    if (!isAllowedHttpRate(request, reply, httpRateLimiter, "pairing.bindings")) {
      return reply;
    }

    return { bindings: pairing.listBindings() };
  });
  app.post("/session-tokens/revoke", async (request, reply) => {
    if (!isAuthorizedHttpRequest(request, reply, config)) {
      return reply;
    }
    if (!isAllowedHttpRate(request, reply, httpRateLimiter, "session-tokens.revoke")) {
      return reply;
    }

    try {
      return sessionTokens.revokeSessionToken(parseRevokeSessionTokenBody(request.body));
    } catch (error) {
      return reply.code(400).send({ error: messageText(error) });
    }
  });
  app.get("/pairing/requests/:pairingRequestId", async (request, reply) => {
    if (!isAuthorizedHttpRequest(request, reply, config)) {
      return reply;
    }
    if (!isAllowedHttpRate(request, reply, httpRateLimiter, "pairing.requests.status")) {
      return reply;
    }

    try {
      const pairingRequestId = readPairingRequestIdParam(request.params);
      const pairingRequest = pairing.getPairingRequest(pairingRequestId);
      if (!pairingRequest) {
        return reply.code(404).send({ error: `Pairing request ${pairingRequestId} was not found` });
      }

      if (pairingRequest.status === "approved") {
        const token = sessionTokens.findTokenForBinding({
          deviceId: pairingRequest.deviceId,
          mobileClientId: pairingRequest.mobileClientId
        });
        if (!token) {
          throw new Error(`Session token for pairing request ${pairingRequestId} was not found`);
        }

        return {
          pairingRequestId,
          deviceId: pairingRequest.deviceId,
          status: "approved",
          auth: {
            type: "auth.sessionToken",
            sessionId: "pending",
            deviceId: token.deviceId,
            sessionToken: token.sessionToken,
            expiresAt: token.expiresAt
          }
        };
      }

      if (pairingRequest.status === "rejected") {
        return {
          pairingRequestId,
          deviceId: pairingRequest.deviceId,
          status: "rejected",
          reason: pairingRequest.reason ?? "Pairing rejected"
        };
      }

      return {
        pairingRequestId,
        deviceId: pairingRequest.deviceId,
        status: "pending"
      };
    } catch (error) {
      return reply.code(400).send({ error: messageText(error) });
    }
  });
  app.post("/pairing/requests", async (request, reply) => {
    if (!isAuthorizedHttpRequest(request, reply, config)) {
      return reply;
    }
    if (!isAllowedHttpRate(request, reply, httpRateLimiter, "pairing.requests.create")) {
      return reply;
    }

    try {
      const pairingRequest = pairing.requestPairing(parsePairingRequestBody(request.body));
      const agentSend = agentOwners.get(pairingRequest.deviceId);
      if (!agentSend) {
        throw new Error(`Device ${pairingRequest.deviceId} is not online`);
      }

      agentSend(pairingRequest);
      return reply.code(202).send({
        pairingRequestId: pairingRequest.pairingRequestId,
        deviceId: pairingRequest.deviceId,
        status: "pending"
      });
    } catch (error) {
      return reply.code(400).send({ error: messageText(error) });
    }
  });

  app.get("/ws/agent", { websocket: true }, (socket, request) => {
    if (!isAuthorizedWebSocket(socket, { url: request.url, headers: request.headers as Record<string, unknown> }, config)) {
      return;
    }

    let attachedDeviceId: string | undefined;

    const agentSend: AgentSendCallback = (message): void => {
      sendJson(socket, message);
    };

    socket.on("message", (data) => {
      let sessionId: string | undefined;

      try {
        const payload = parseJson(data, config.wsRawMessageMaxBytes);

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

        if (messageType(payload)?.startsWith("pairing.")) {
          const message = parseClientMessage(payload);
          if (!isAgentPairingMessage(message)) {
            throw new Error(`Unsupported agent pairing message type ${message.type}`);
          }

          if (message.deviceId !== attachedDeviceId) {
            throw new Error(`Agent ${attachedDeviceId} cannot pair for device ${message.deviceId}`);
          }

          if (message.type === "pairing.create") {
            const device = registry.get(message.deviceId);
            if (!device) {
              throw new Error(`Device ${message.deviceId} is not registered`);
            }

            sendJson(
              socket,
              pairing.createPairingCode({
                deviceId: device.deviceId,
                deviceName: device.deviceName,
                serverUrl: serverBaseUrl(config)
              })
            );
            return;
          }

          if (message.type === "pairing.approved") {
            const binding = pairing.approvePairingRequest({
              pairingRequestId: message.pairingRequestId,
              deviceId: message.deviceId
            });
            const sessionToken = sessionTokens.issueSessionToken({
              bindingId: binding.bindingId,
              deviceId: binding.deviceId,
              mobileClientId: binding.mobileClientId
            });
            return;
          }

          pairing.rejectPairingRequest({
            pairingRequestId: message.pairingRequestId,
            deviceId: message.deviceId,
            reason: message.reason
          });
          return;
        }

        const message = parseServerMessage(payload);
        if (!isAgentRoutableMessage(message)) {
          throw new Error(`Unsupported agent message type ${message.type}`);
        }
        sessionId = message.sessionId;

        if (message.type === "terminal.output" && !isAllowedAgentOutputRate(agentOutputRateLimiter, attachedDeviceId)) {
          throw new Error("Rate limit exceeded");
        }
        if (
          message.type === "terminal.output" &&
          !isAllowedAgentOutputByteRate(agentOutputByteRateLimiter, attachedDeviceId, message)
        ) {
          throw new Error("Rate limit exceeded");
        }

        hub.routeFromAgent(attachedDeviceId, agentSend, message);
      } catch (error) {
        sendSessionError(socket, messageText(error), sessionId);
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

  app.get("/ws/mobile", { websocket: true }, (socket, request) => {
    if (!isAuthorizedWebSocket(socket, { url: request.url, headers: request.headers as Record<string, unknown> }, config)) {
      return;
    }

    const mobileSend = (message: Extract<ServerMessage, { type: "terminal.output" | "terminal.exit" }>): void => {
      sendJson(socket, message);
    };
    const mobileRateLimitKey = `ws.mobile.messages:${clientKey(request)}`;

    socket.on("message", (data) => {
      let sessionId: string | undefined;

      try {
        const message = parseClientMessage(parseJson(data, config.wsRawMessageMaxBytes));
        sessionId = "sessionId" in message ? message.sessionId : undefined;

        if (message.type === "session.open") {
          if (!message.sessionToken) {
            throw new Error("Missing session token");
          }

          const tokenResult = sessionTokens.verifySessionToken({
            sessionToken: message.sessionToken,
            deviceId: message.deviceId
          });
          if (!tokenResult.ok) {
            throw new Error(tokenResult.reason);
          }

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

        assertTerminalInputSize(message, config.terminalInputMaxBytes);

        if (!isAllowedWebSocketMessageRate(wsMessageRateLimiter, mobileRateLimitKey)) {
          throw new Error("Rate limit exceeded");
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

function createPairingStore(config: ServerConfig): PairingStore {
  return config.dataDir
    ? new JsonFilePairingStore(join(config.dataDir, "pairing-store.json"))
    : new MemoryPairingStore();
}

function createSessionTokenStore(config: ServerConfig): SessionTokenStore {
  return config.dataDir
    ? new JsonFileSessionTokenStore(join(config.dataDir, "session-tokens.json"))
    : new MemorySessionTokenStore();
}
