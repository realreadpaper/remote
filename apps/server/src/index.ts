import websocket from "@fastify/websocket";
import fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { fileURLToPath } from "node:url";
import { loadServerConfig, type ServerConfig } from "./config.js";
import { registerWsRoutes } from "./ws.js";

export async function createServer(
  options: FastifyServerOptions = {},
  config: ServerConfig = loadServerConfig()
): Promise<FastifyInstance> {
  const app = fastify(options);
  await app.register(websocket);
  registerWsRoutes(app, config);
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadServerConfig();
  const app = await createServer({ logger: true }, config);

  await app.listen({ port: config.port, host: config.host });
}
