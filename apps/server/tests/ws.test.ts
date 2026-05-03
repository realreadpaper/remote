import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { createServer } from "../src/index.js";
import type { ServerConfig } from "../src/config.js";

function nextJson(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket message"));
    }, 1_000);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
    };

    const onMessage = (data: WebSocket.RawData): void => {
      cleanup();
      resolve(JSON.parse(data.toString()));
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

function noJson(socket: WebSocket, timeoutMs = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
    };

    const onMessage = (data: WebSocket.RawData): void => {
      cleanup();
      reject(new Error(`Unexpected websocket message: ${data.toString()}`));
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

function firstSocketOutcome(socket: WebSocket): Promise<"closed" | { message: unknown }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket close or message"));
    }, 1_000);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("close", onClose);
      socket.off("message", onMessage);
      socket.off("error", onError);
    };

    const onClose = (): void => {
      cleanup();
      resolve("closed");
    };

    const onMessage = (data: WebSocket.RawData): void => {
      cleanup();
      resolve({ message: JSON.parse(data.toString()) });
    };

    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    socket.once("close", onClose);
    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

const tokenServerConfig: ServerConfig = {
  host: "127.0.0.1",
  port: 8787,
  requireDevToken: true,
  devToken: "secret",
  publicBaseUrl: null,
  dataDir: null,
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 120,
  wsMessageRateLimitWindowMs: 10_000,
  wsMessageRateLimitMaxRequests: 200,
  terminalInputMaxBytes: 16_384,
  wsRawMessageMaxBytes: 65_536,
  agentOutputRateLimitWindowMs: 10_000,
  agentOutputRateLimitMaxMessages: 1000,
  agentOutputByteRateLimitWindowMs: 10_000,
  agentOutputByteRateLimitMaxBytes: 1_048_576,
  mobileInputByteRateLimitWindowMs: 10_000,
  mobileInputByteRateLimitMaxBytes: 262_144
};

async function registerAgent(app: FastifyInstance, deviceId = "mac-1"): Promise<WebSocket> {
  const agent = await app.injectWS("/ws/agent");

  agent.send(
    JSON.stringify({
      type: "device.register",
      deviceId,
      deviceName: "MacBook Pro",
      capabilities: ["terminal"]
    })
  );
  await nextJson(agent);

  return agent;
}

async function openMobileSession(
  app: FastifyInstance,
  deviceId = "mac-1",
  sessionToken?: string
): Promise<{ mobile: WebSocket; sessionId: string }> {
  const mobile = await app.injectWS("/ws/mobile");
  const opened = nextJson(mobile);

  mobile.send(JSON.stringify(sessionToken ? { type: "session.open", deviceId, sessionToken } : { type: "session.open", deviceId }));

  const message = (await opened) as { sessionId: string };
  return { mobile, sessionId: message.sessionId };
}

async function createPairingRequest(
  app: FastifyInstance,
  agent: WebSocket,
  input: { deviceId?: string; mobileClientId?: string; mobileName?: string; devToken?: string } = {}
): Promise<{ pairingRequestId: string; deviceId: string }> {
  const deviceId = input.deviceId ?? "mac-1";
  const pairingCreated = nextJson(agent);
  agent.send(JSON.stringify({ type: "pairing.create", deviceId }));
  const created = (await pairingCreated) as { pairingCode: string };

  const pairingRequested = nextJson(agent);
  const response = await app.inject({
    method: "POST",
    url: "/pairing/requests",
    headers: input.devToken ? { authorization: `Bearer ${input.devToken}` } : undefined,
    payload: {
      pairingCode: created.pairingCode,
      mobileClientId: input.mobileClientId ?? "mobile-1",
      mobileName: input.mobileName ?? "Alice iPhone"
    }
  });

  expect(response.statusCode).toBe(202);
  const requested = (await pairingRequested) as { pairingRequestId: string; deviceId: string };
  return {
    pairingRequestId: requested.pairingRequestId,
    deviceId: requested.deviceId
  };
}

async function approvePairingRequest(
  app: FastifyInstance,
  agent: WebSocket,
  input: { deviceId?: string; mobileClientId?: string; mobileName?: string; devToken?: string } = {}
): Promise<{ pairingRequestId: string; deviceId: string; sessionToken: string }> {
  const request = await createPairingRequest(app, agent, input);
  agent.send(
    JSON.stringify({
      type: "pairing.approved",
      pairingRequestId: request.pairingRequestId,
      deviceId: request.deviceId
    })
  );
  await new Promise((resolve) => setTimeout(resolve, 10));

  const statusResponse = await app.inject({
    method: "GET",
    url: `/pairing/requests/${request.pairingRequestId}`,
    headers: input.devToken ? { authorization: `Bearer ${input.devToken}` } : undefined
  });
  expect(statusResponse.statusCode).toBe(200);
  const status = statusResponse.json() as { auth: { sessionToken: string } };

  return {
    ...request,
    sessionToken: status.auth.sessionToken
  };
}

describe("server websocket API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("rejects an agent websocket without token when dev token is required", async () => {
    await app.close();
    app = await createServer({ logger: false }, tokenServerConfig);
    await app.ready();

    const agent = await app.injectWS("/ws/agent");
    const outcome = firstSocketOutcome(agent);

    agent.send(
      JSON.stringify({
        type: "device.register",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        capabilities: ["terminal"]
      })
    );

    expect(await outcome).toBe("closed");

    const response = await app.inject({ method: "GET", url: "/devices" });
    expect(response.json()).toEqual({ devices: [] });
  });

  it("rejects a mobile websocket without token when dev token is required", async () => {
    await app.close();
    app = await createServer({ logger: false }, tokenServerConfig);
    await app.ready();

    const mobile = await app.injectWS("/ws/mobile");
    const outcome = firstSocketOutcome(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1" }));

    expect(await outcome).toBe("closed");
  });

  it("keeps existing websocket flow working with a correct dev token", async () => {
    await app.close();
    app = await createServer({ logger: false }, tokenServerConfig);
    await app.ready();

    const agent = await app.injectWS("/ws/agent?token=secret");

    agent.send(
      JSON.stringify({
        type: "device.register",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        capabilities: ["terminal"]
      })
    );
    expect(await nextJson(agent)).toEqual({
      type: "device.registered",
      deviceId: "mac-1"
    });
    const { sessionToken } = await approvePairingRequest(app, agent, { devToken: "secret" });

    const mobile = await app.injectWS("/ws/mobile?token=secret");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    const agentMessage = await agentOpened;
    const mobileMessage = await mobileOpened;
    expect(agentMessage).toMatchObject({
      type: "session.opened",
      deviceId: "mac-1"
    });
    expect(mobileMessage).toEqual(agentMessage);

    agent.terminate();
    mobile.terminate();
  });

  it("rejects HTTP pairing and revoke routes without token when dev token is required", async () => {
    await app.close();
    app = await createServer({ logger: false }, tokenServerConfig);
    await app.ready();

    const pairingResponse = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      payload: {
        pairingCode: "123456",
        mobileClientId: "mobile-1",
        mobileName: "iPhone"
      }
    });
    const statusResponse = await app.inject({ method: "GET", url: "/pairing/requests/request-1" });
    const revokeResponse = await app.inject({
      method: "POST",
      url: "/session-tokens/revoke",
      payload: {
        deviceId: "mac-1",
        sessionToken: "token-1"
      }
    });

    expect(pairingResponse.statusCode).toBe(401);
    expect(statusResponse.statusCode).toBe(401);
    expect(revokeResponse.statusCode).toBe(401);
  });

  it("allows HTTP pairing and revoke routes with a correct dev token", async () => {
    await app.close();
    app = await createServer({ logger: false }, tokenServerConfig);
    await app.ready();
    const agent = await app.injectWS("/ws/agent?token=secret");
    agent.send(
      JSON.stringify({
        type: "device.register",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        capabilities: ["terminal"]
      })
    );
    await nextJson(agent);
    const pairingCreated = nextJson(agent);
    agent.send(JSON.stringify({ type: "pairing.create", deviceId: "mac-1" }));
    const created = (await pairingCreated) as { pairingCode: string };
    const pairingRequested = nextJson(agent);

    const pairingResponse = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      headers: { authorization: "Bearer secret" },
      payload: {
        pairingCode: created.pairingCode,
        mobileClientId: "mobile-1",
        mobileName: "iPhone"
      }
    });

    expect(pairingResponse.statusCode).toBe(202);
    const requested = (await pairingRequested) as { pairingRequestId: string };
    agent.send(JSON.stringify({ type: "pairing.approved", pairingRequestId: requested.pairingRequestId, deviceId: "mac-1" }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const statusResponse = await app.inject({
      method: "GET",
      url: `/pairing/requests/${requested.pairingRequestId}`,
      headers: { authorization: "Bearer secret" }
    });
    expect(statusResponse.statusCode).toBe(200);
    const sessionToken = (statusResponse.json() as { auth: { sessionToken: string } }).auth.sessionToken;

    const revokeResponse = await app.inject({
      method: "POST",
      url: "/session-tokens/revoke?token=secret",
      payload: {
        deviceId: "mac-1",
        sessionToken
      }
    });
    expect(revokeResponse.statusCode).toBe(200);
    expect(revokeResponse.json()).toEqual({ revoked: true });

    agent.terminate();
  });

  it("rate limits authorized HTTP pairing requests by client IP", async () => {
    await app.close();
    app = await createServer({ logger: false }, { ...tokenServerConfig, rateLimitMaxRequests: 2 });
    await app.ready();

    const payload = {
      pairingCode: "000000",
      mobileClientId: "mobile-1",
      mobileName: "iPhone"
    };

    const first = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
      payload
    });
    const second = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
      payload
    });
    const third = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
      payload
    });

    expect(first.statusCode).toBe(400);
    expect(second.statusCode).toBe(400);
    expect(third.statusCode).toBe(429);
    expect(Number(third.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(third.headers["retry-after"])).toBeLessThanOrEqual(60);
    expect(third.json()).toMatchObject({ error: "Rate limit exceeded" });
    expect((third.json() as { retryAfterMs: number }).retryAfterMs).toBeGreaterThan(0);
    expect((third.json() as { retryAfterMs: number }).retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("keeps HTTP rate limit buckets separate by forwarded client IP", async () => {
    await app.close();
    app = await createServer({ logger: false }, { ...tokenServerConfig, rateLimitMaxRequests: 1 });
    await app.ready();

    const payload = {
      pairingCode: "000000",
      mobileClientId: "mobile-1",
      mobileName: "iPhone"
    };

    const first = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
      payload
    });
    const secondSameIp = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.10" },
      payload
    });
    const firstOtherIp = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      headers: { authorization: "Bearer secret", "x-forwarded-for": "203.0.113.11" },
      payload
    });

    expect(first.statusCode).toBe(400);
    expect(secondSameIp.statusCode).toBe(429);
    expect(firstOtherIp.statusCode).toBe(400);
  });

  it("creates a pairing code when a registered agent requests one", async () => {
    const agent = await registerAgent(app);
    const pairingCreated = nextJson(agent);

    agent.send(JSON.stringify({ type: "pairing.create", deviceId: "mac-1" }));

    expect(await pairingCreated).toMatchObject({
      type: "pairing.created",
      deviceId: "mac-1",
      deviceName: "MacBook Pro",
      pairingCode: expect.any(String),
      expiresAt: expect.any(String),
      serverUrl: expect.any(String)
    });

    agent.terminate();
  });

  it("pushes a mobile pairing request to the agent and records an approved binding", async () => {
    const agent = await registerAgent(app);
    const pairingCreated = nextJson(agent);
    agent.send(JSON.stringify({ type: "pairing.create", deviceId: "mac-1" }));
    const created = (await pairingCreated) as { pairingCode: string };

    const pairingRequested = nextJson(agent);
    const response = await app.inject({
      method: "POST",
      url: "/pairing/requests",
      payload: {
        pairingCode: created.pairingCode,
        mobileClientId: "mobile-1",
        mobileName: "Alice iPhone"
      }
    });

    expect(response.statusCode).toBe(202);
    const requested = (await pairingRequested) as {
      pairingRequestId: string;
      deviceId: string;
      mobileClientId: string;
      mobileName: string;
    };
    expect(requested).toMatchObject({
      type: "pairing.requested",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      mobileName: "Alice iPhone"
    });

    agent.send(
      JSON.stringify({
        type: "pairing.approved",
        pairingRequestId: requested.pairingRequestId,
        deviceId: "mac-1"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    const bindingsResponse = await app.inject({ method: "GET", url: "/pairing/bindings" });
    expect(bindingsResponse.statusCode).toBe(200);
    expect(bindingsResponse.json()).toEqual({
      bindings: [
        expect.objectContaining({
          deviceId: "mac-1",
          mobileClientId: "mobile-1",
          mobileName: "Alice iPhone"
        })
      ]
    });

    agent.terminate();
  });

  it("returns pending status for a pairing request before the agent decides", async () => {
    const agent = await registerAgent(app);
    const request = await createPairingRequest(app, agent);

    const response = await app.inject({
      method: "GET",
      url: `/pairing/requests/${request.pairingRequestId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      pairingRequestId: request.pairingRequestId,
      deviceId: "mac-1",
      status: "pending"
    });

    agent.terminate();
  });

  it("returns rejected status with reason after the agent rejects pairing", async () => {
    const agent = await registerAgent(app);
    const request = await createPairingRequest(app, agent);

    agent.send(
      JSON.stringify({
        type: "pairing.rejected",
        pairingRequestId: request.pairingRequestId,
        deviceId: "mac-1",
        reason: "not now"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response = await app.inject({
      method: "GET",
      url: `/pairing/requests/${request.pairingRequestId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      pairingRequestId: request.pairingRequestId,
      deviceId: "mac-1",
      status: "rejected",
      reason: "not now"
    });

    agent.terminate();
  });

  it("returns an auth session token after the agent approves pairing", async () => {
    const agent = await registerAgent(app);
    const request = await createPairingRequest(app, agent);

    agent.send(
      JSON.stringify({
        type: "pairing.approved",
        pairingRequestId: request.pairingRequestId,
        deviceId: "mac-1"
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response = await app.inject({
      method: "GET",
      url: `/pairing/requests/${request.pairingRequestId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      pairingRequestId: request.pairingRequestId,
      deviceId: "mac-1",
      status: "approved",
      auth: {
        type: "auth.sessionToken",
        sessionId: "pending",
        deviceId: "mac-1",
        sessionToken: expect.any(String),
        expiresAt: expect.any(String)
      }
    });

    agent.terminate();
  });

  it("keeps approved binding and session token after server restart when dataDir is configured", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "remote-server-data-"));
    await app.close();

    app = await createServer({ logger: false }, { ...tokenServerConfig, requireDevToken: false, devToken: null, dataDir });
    await app.ready();
    const firstAgent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, firstAgent);
    firstAgent.terminate();
    await app.close();

    app = await createServer({ logger: false }, { ...tokenServerConfig, requireDevToken: false, devToken: null, dataDir });
    await app.ready();
    const secondAgent = await registerAgent(app);
    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(secondAgent);
    const mobileOpened = nextJson(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    const agentMessage = await agentOpened;
    const mobileMessage = await mobileOpened;
    expect(agentMessage).toMatchObject({
      type: "session.opened",
      deviceId: "mac-1"
    });
    expect(mobileMessage).toEqual(agentMessage);

    const bindingsResponse = await app.inject({ method: "GET", url: "/pairing/bindings" });
    expect(bindingsResponse.json()).toEqual({
      bindings: [
        expect.objectContaining({
          deviceId: "mac-1",
          mobileClientId: "mobile-1"
        })
      ]
    });

    secondAgent.terminate();
    mobile.terminate();
  });

  it("shows an agent-registered device as online", async () => {
    const agent = await app.injectWS("/ws/agent");

    agent.send(
      JSON.stringify({
        type: "device.register",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        capabilities: ["terminal"]
      })
    );

    expect(await nextJson(agent)).toEqual({
      type: "device.registered",
      deviceId: "mac-1"
    });

    const response = await app.inject({ method: "GET", url: "/devices" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      devices: [
        {
          deviceId: "mac-1",
          deviceName: "MacBook Pro",
          capabilities: ["terminal"],
          online: true
        }
      ]
    });

    agent.terminate();
  });

  it("sends a clear error when an agent sends terminal output before registering", async () => {
    const agent = await app.injectWS("/ws/agent");
    const errorMessage = nextJson(agent);

    agent.send(
      JSON.stringify({
        type: "terminal.output",
        sessionId: "session-1",
        stream: "stdout",
        data: "early\n"
      })
    );

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Agent must send device.register before terminal messages"
    });

    agent.terminate();
  });

  it("sends session.opened to mobile and agent when mobile opens a session", async () => {
    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);

    mobile.send(
      JSON.stringify({
        type: "session.open",
        deviceId: "mac-1",
        sessionToken
      })
    );

    const agentMessage = await agentOpened;
    const mobileMessage = await mobileOpened;

    expect(agentMessage).toMatchObject({
      type: "session.opened",
      deviceId: "mac-1"
    });
    expect(mobileMessage).toEqual(agentMessage);

    agent.terminate();
    mobile.terminate();
  });

  it("returns session.error when mobile opens a session without a session token", async () => {
    const agent = await registerAgent(app);
    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1" }));

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Missing session token"
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("returns session.error when mobile opens a session with an invalid token", async () => {
    const agent = await registerAgent(app);
    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken: "invalid" }));

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Invalid session token"
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("revokes a session token so it cannot open another session", async () => {
    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);

    const revokeResponse = await app.inject({
      method: "POST",
      url: "/session-tokens/revoke",
      payload: {
        deviceId: "mac-1",
        sessionToken
      }
    });
    expect(revokeResponse.statusCode).toBe(200);
    expect(revokeResponse.json()).toEqual({ revoked: true });

    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Invalid session token"
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("returns session.error when mobile opens another device with a valid token", async () => {
    const firstAgent = await registerAgent(app, "mac-1");
    const secondAgent = await registerAgent(app, "mac-2");
    const { sessionToken } = await approvePairingRequest(app, firstAgent, { deviceId: "mac-1" });
    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-2", sessionToken }));

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Session token is not valid for device mac-2"
    });
    await noJson(secondAgent);

    firstAgent.terminate();
    secondAgent.terminate();
    mobile.terminate();
  });

  it("routes mobile terminal input to the agent socket", async () => {
    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const routedInput = nextJson(agent);

    mobile.send(
      JSON.stringify({
        type: "terminal.input",
        sessionId: opened.sessionId,
        data: "pwd\n"
      })
    );

    expect(await routedInput).toEqual({
      type: "terminal.input",
      sessionId: opened.sessionId,
      data: "pwd\n"
    });

    agent.terminate();
    mobile.terminate();
  });

  it("rate limits mobile terminal messages before routing to the agent", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, wsMessageRateLimitMaxRequests: 1 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.20" } });
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const firstRoutedInput = nextJson(agent);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "pwd\n" }));
    expect(await firstRoutedInput).toEqual({
      type: "terminal.input",
      sessionId: opened.sessionId,
      data: "pwd\n"
    });

    const rateLimitError = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "whoami\n" }));
    expect(await rateLimitError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Rate limit exceeded",
      sessionId: opened.sessionId
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("keeps mobile websocket message rate limit buckets separate by forwarded IP", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, wsMessageRateLimitMaxRequests: 1 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const firstMobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.21" } });
    const secondMobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.22" } });

    const firstAgentOpened = nextJson(agent);
    const firstMobileOpened = nextJson(firstMobile);
    firstMobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));
    await firstAgentOpened;
    const firstOpened = (await firstMobileOpened) as { sessionId: string };

    const firstRoutedInput = nextJson(agent);
    firstMobile.send(JSON.stringify({ type: "terminal.input", sessionId: firstOpened.sessionId, data: "pwd\n" }));
    await firstRoutedInput;

    const secondAgentOpened = nextJson(agent);
    const secondMobileOpened = nextJson(secondMobile);
    secondMobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));
    await secondAgentOpened;
    const secondOpened = (await secondMobileOpened) as { sessionId: string };

    const secondRoutedInput = nextJson(agent);
    secondMobile.send(JSON.stringify({ type: "terminal.input", sessionId: secondOpened.sessionId, data: "date\n" }));
    expect(await secondRoutedInput).toEqual({
      type: "terminal.input",
      sessionId: secondOpened.sessionId,
      data: "date\n"
    });

    agent.terminate();
    firstMobile.terminate();
    secondMobile.terminate();
  });

  it("rejects terminal input larger than the configured byte limit", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, terminalInputMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const routedInput = nextJson(agent);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcd" }));
    expect(await routedInput).toEqual({
      type: "terminal.input",
      sessionId: opened.sessionId,
      data: "abcd"
    });

    const sizeError = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcde" }));
    expect(await sizeError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Terminal input exceeds 4 bytes",
      sessionId: opened.sessionId
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("rejects oversized raw mobile websocket messages before parsing JSON", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, wsRawMessageMaxBytes: 8 }
    );
    await app.ready();

    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);
    mobile.send("not-json-but-too-large");

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "WebSocket message exceeds 8 bytes"
    });

    mobile.terminate();
  });

  it("rejects oversized raw agent websocket messages before parsing JSON", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, wsRawMessageMaxBytes: 8 }
    );
    await app.ready();

    const agent = await app.injectWS("/ws/agent");
    const errorMessage = nextJson(agent);
    agent.send("not-json-but-too-large");

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "WebSocket message exceeds 8 bytes"
    });

    agent.terminate();
  });

  it("checks terminal input size by UTF-8 bytes", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, terminalInputMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const sizeError = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "你好" }));
    expect(await sizeError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Terminal input exceeds 4 bytes",
      sessionId: opened.sessionId
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("rate limits mobile terminal input by UTF-8 bytes before routing to the agent", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, mobileInputByteRateLimitMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.30" } });
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const firstInput = nextJson(agent);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcd" }));
    expect(await firstInput).toEqual({
      type: "terminal.input",
      sessionId: opened.sessionId,
      data: "abcd"
    });

    const rateLimitError = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "e" }));
    expect(await rateLimitError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Rate limit exceeded",
      sessionId: opened.sessionId
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("counts mobile terminal input byte rate by UTF-8 bytes", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, mobileInputByteRateLimitMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.31" } });
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const rateLimitError = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "你好" }));
    expect(await rateLimitError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Rate limit exceeded",
      sessionId: opened.sessionId
    });
    await noJson(agent);

    agent.terminate();
    mobile.terminate();
  });

  it("routes terminal resize after mobile input byte rate limit is exceeded", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, mobileInputByteRateLimitMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.32" } });
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const firstInput = nextJson(agent);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcd" }));
    await firstInput;

    const rateLimitError = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "e" }));
    await rateLimitError;

    const resizeMessage = nextJson(agent);
    mobile.send(JSON.stringify({ type: "terminal.resize", sessionId: opened.sessionId, cols: 120, rows: 40 }));
    expect(await resizeMessage).toEqual({
      type: "terminal.resize",
      sessionId: opened.sessionId,
      cols: 120,
      rows: 40
    });

    agent.terminate();
    mobile.terminate();
  });

  it("routes mobile terminal signal to the agent socket", async () => {
    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const routedSignal = nextJson(agent);

    mobile.send(
      JSON.stringify({
        type: "terminal.signal",
        sessionId: opened.sessionId,
        signal: "SIGINT"
      })
    );

    expect(await routedSignal).toEqual({
      type: "terminal.signal",
      sessionId: opened.sessionId,
      signal: "SIGINT"
    });

    agent.terminate();
    mobile.terminate();
  });

  it("routes terminal signal after mobile input byte rate limit is exceeded", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, mobileInputByteRateLimitMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile", { headers: { "x-forwarded-for": "203.0.113.33" } });
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const firstInput = nextJson(agent);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "abcd" }));
    await firstInput;

    const rateLimitError = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "terminal.input", sessionId: opened.sessionId, data: "e" }));
    await rateLimitError;

    const signalMessage = nextJson(agent);
    mobile.send(JSON.stringify({ type: "terminal.signal", sessionId: opened.sessionId, signal: "SIGINT" }));
    expect(await signalMessage).toEqual({
      type: "terminal.signal",
      sessionId: opened.sessionId,
      signal: "SIGINT"
    });

    agent.terminate();
    mobile.terminate();
  });

  it("routes agent terminal output to the mobile socket", async () => {
    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const routedOutput = nextJson(mobile);

    agent.send(
      JSON.stringify({
        type: "terminal.output",
        sessionId: opened.sessionId,
        stream: "stdout",
        data: "ok\n"
      })
    );

    expect(await routedOutput).toEqual({
      type: "terminal.output",
      sessionId: opened.sessionId,
      stream: "stdout",
      data: "ok\n"
    });

    agent.terminate();
    mobile.terminate();
  });

  it("rate limits agent terminal output before routing to mobile", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputRateLimitMaxMessages: 1 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const firstOutput = nextJson(mobile);
    agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "one\n" }));
    expect(await firstOutput).toEqual({
      type: "terminal.output",
      sessionId: opened.sessionId,
      stream: "stdout",
      data: "one\n"
    });

    const rateLimitError = nextJson(agent);
    agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "two\n" }));
    expect(await rateLimitError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Rate limit exceeded",
      sessionId: opened.sessionId
    });
    await noJson(mobile);

    agent.terminate();
    mobile.terminate();
  });

  it("routes terminal exit after agent output rate limit is exceeded", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputRateLimitMaxMessages: 1 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const firstOutput = nextJson(mobile);
    agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "one\n" }));
    await firstOutput;

    const rateLimitError = nextJson(agent);
    agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "two\n" }));
    await rateLimitError;

    const exitMessage = nextJson(mobile);
    agent.send(JSON.stringify({ type: "terminal.exit", sessionId: opened.sessionId, exitCode: 0 }));
    expect(await exitMessage).toEqual({
      type: "terminal.exit",
      sessionId: opened.sessionId,
      exitCode: 0
    });

    agent.terminate();
    mobile.terminate();
  });

  it("rate limits agent terminal output by UTF-8 bytes before routing to mobile", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputByteRateLimitMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const firstOutput = nextJson(mobile);
    agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "abcd" }));
    await firstOutput;

    const rateLimitError = nextJson(agent);
    agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "e" }));
    expect(await rateLimitError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Rate limit exceeded",
      sessionId: opened.sessionId
    });
    await noJson(mobile);

    agent.terminate();
    mobile.terminate();
  });

  it("counts agent terminal output byte rate by UTF-8 bytes", async () => {
    await app.close();
    app = await createServer(
      { logger: false },
      { ...tokenServerConfig, requireDevToken: false, devToken: null, agentOutputByteRateLimitMaxBytes: 4 }
    );
    await app.ready();

    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const rateLimitError = nextJson(agent);
    agent.send(JSON.stringify({ type: "terminal.output", sessionId: opened.sessionId, stream: "stdout", data: "你好" }));
    expect(await rateLimitError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Rate limit exceeded",
      sessionId: opened.sessionId
    });
    await noJson(mobile);

    agent.terminate();
    mobile.terminate();
  });

  it("keeps a reconnected agent online when the old socket closes later", async () => {
    const oldAgent = await registerAgent(app);
    const newAgent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, newAgent);

    oldAgent.close();
    await new Promise((resolve) => oldAgent.once("close", resolve));
    await new Promise((resolve) => setTimeout(resolve, 25));

    const devicesResponse = await app.inject({ method: "GET", url: "/devices" });
    expect(devicesResponse.json()).toEqual({
      devices: [
        {
          deviceId: "mac-1",
          deviceName: "MacBook Pro",
          capabilities: ["terminal"],
          online: true
        }
      ]
    });

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(newAgent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await agentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const routedInput = nextJson(newAgent);

    mobile.send(
      JSON.stringify({
        type: "terminal.input",
        sessionId: opened.sessionId,
        data: "whoami\n"
      })
    );

    expect(await routedInput).toEqual({
      type: "terminal.input",
      sessionId: opened.sessionId,
      data: "whoami\n"
    });

    newAgent.terminate();
    mobile.terminate();
  });

  it("rejects terminal output from a stale same-device agent socket", async () => {
    const oldAgent = await registerAgent(app);
    const newAgent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, newAgent);

    const mobile = await app.injectWS("/ws/mobile");
    const newAgentOpened = nextJson(newAgent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1", sessionToken }));

    await newAgentOpened;
    const opened = (await mobileOpened) as { sessionId: string };
    const oldAgentError = nextJson(oldAgent);

    oldAgent.send(
      JSON.stringify({
        type: "terminal.output",
        sessionId: opened.sessionId,
        stream: "stdout",
        data: "stale\n"
      })
    );

    expect(await oldAgentError).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Agent sender is not attached for device mac-1",
      sessionId: opened.sessionId
    });
    await noJson(mobile);

    oldAgent.terminate();
    newAgent.terminate();
    mobile.terminate();
  });

  it("returns session.error when mobile routes an unknown session", async () => {
    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);

    mobile.send(
      JSON.stringify({
        type: "terminal.input",
        sessionId: "missing-session",
        data: "pwd\n"
      })
    );

    expect(await errorMessage).toEqual({
      type: "session.error",
      code: "SESSION_ERROR",
      message: "Unknown session missing-session",
      sessionId: "missing-session"
    });

    mobile.terminate();
  });

  it("returns session.error when mobile opens an offline device", async () => {
    const agent = await registerAgent(app, "offline-device");
    const { sessionToken } = await approvePairingRequest(app, agent, { deviceId: "offline-device" });
    agent.close();
    await new Promise((resolve) => agent.once("close", resolve));
    await new Promise((resolve) => setTimeout(resolve, 25));

    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "offline-device", sessionToken }));

    const error = await errorMessage;
    expect(error).toMatchObject({
      type: "session.error",
      code: "SESSION_ERROR"
    });
    expect(["Device offline-device is not online", "WebSocket is not open"]).toContain(
      (error as { message: string }).message
    );

    mobile.terminate();
  });

  it("returns session.error for invalid JSON without crashing", async () => {
    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);

    mobile.send("{");

    expect(await errorMessage).toMatchObject({
      type: "session.error",
      code: "SESSION_ERROR"
    });

    mobile.terminate();
  });

  it("returns session.error for invalid schema without crashing", async () => {
    const mobile = await app.injectWS("/ws/mobile");
    const errorMessage = nextJson(mobile);

    mobile.send(JSON.stringify({ type: "session.open", deviceId: "" }));

    expect(await errorMessage).toMatchObject({
      type: "session.error",
      code: "SESSION_ERROR"
    });

    mobile.terminate();
  });

  it("cleans mobile sessions on disconnect before later agent output", async () => {
    const agent = await registerAgent(app);
    const { sessionToken } = await approvePairingRequest(app, agent);
    const agentOpened = nextJson(agent);
    const { mobile, sessionId } = await openMobileSession(app, "mac-1", sessionToken);
    await agentOpened;

    mobile.close();
    await new Promise((resolve) => mobile.once("close", resolve));

    const agentError = nextJson(agent);
    agent.send(
      JSON.stringify({
        type: "terminal.output",
        sessionId,
        stream: "stdout",
        data: "late\n"
      })
    );

    const error = await agentError;
    expect(error).toMatchObject({
      type: "session.error",
      code: "SESSION_ERROR"
    });
    expect([`Unknown session ${sessionId} for device mac-1`, "WebSocket is not open"]).toContain(
      (error as { message: string }).message
    );
    await noJson(mobile);

    agent.terminate();
  });
});
