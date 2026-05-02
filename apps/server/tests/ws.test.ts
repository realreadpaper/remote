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
  dataDir: null
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
      message: "Agent sender is not attached for device mac-1"
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
