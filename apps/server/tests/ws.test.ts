import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { createServer } from "../src/index.js";

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
    const agent = await app.injectWS("/ws/agent");
    agent.send(
      JSON.stringify({
        type: "device.register",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        capabilities: ["terminal"]
      })
    );
    await nextJson(agent);

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);

    mobile.send(
      JSON.stringify({
        type: "session.open",
        deviceId: "mac-1"
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

  it("routes mobile terminal input to the agent socket", async () => {
    const agent = await app.injectWS("/ws/agent");
    agent.send(
      JSON.stringify({
        type: "device.register",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        capabilities: ["terminal"]
      })
    );
    await nextJson(agent);

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1" }));

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
    const agent = await app.injectWS("/ws/agent");
    agent.send(
      JSON.stringify({
        type: "device.register",
        deviceId: "mac-1",
        deviceName: "MacBook Pro",
        capabilities: ["terminal"]
      })
    );
    await nextJson(agent);

    const mobile = await app.injectWS("/ws/mobile");
    const agentOpened = nextJson(agent);
    const mobileOpened = nextJson(mobile);
    mobile.send(JSON.stringify({ type: "session.open", deviceId: "mac-1" }));

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
});
