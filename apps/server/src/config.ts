export interface ServerConfig {
  host: string;
  port: number;
  requireDevToken: boolean;
  devToken: string | null;
  publicBaseUrl: string | null;
  dataDir: string | null;
}

type ServerEnv = Record<string, string | undefined>;

export function loadServerConfig(env: ServerEnv = process.env): ServerConfig {
  const port = parsePort(env.PORT);
  const requireDevToken = env.REMOTE_REQUIRE_DEV_TOKEN === "1";
  const devToken = normalizeOptional(env.REMOTE_DEV_TOKEN);

  if (requireDevToken && !devToken) {
    throw new Error("REMOTE_DEV_TOKEN is required when REMOTE_REQUIRE_DEV_TOKEN=1");
  }

  return {
    host: normalizeOptional(env.HOST) ?? "127.0.0.1",
    port,
    requireDevToken,
    devToken,
    publicBaseUrl: normalizeOptional(env.REMOTE_PUBLIC_BASE_URL),
    dataDir: normalizeOptional(env.REMOTE_DATA_DIR)
  };
}

function parsePort(rawPort: string | undefined): number {
  if (!rawPort) {
    return 8787;
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a valid TCP port");
  }

  return port;
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
