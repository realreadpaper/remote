import websocket from "@fastify/websocket";
import fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { fileURLToPath } from "node:url";
import { registerWsRoutes } from "./ws.js";

export async function createServer(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = fastify(options);
  await app.register(websocket);
  registerWsRoutes(app);
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = await createServer({ logger: true });
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "127.0.0.1";

  await app.listen({ port, host });
}
