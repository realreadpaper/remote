export interface ServerConfig {
  host: string;
  port: number;
  requireDevToken: boolean;
  devToken: string | null;
  publicBaseUrl: string | null;
  dataDir: string | null;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  wsMessageRateLimitWindowMs: number;
  wsMessageRateLimitMaxRequests: number;
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
    dataDir: normalizeOptional(env.REMOTE_DATA_DIR),
    rateLimitWindowMs: parseIntegerEnv(
      env.REMOTE_HTTP_RATE_LIMIT_WINDOW_MS,
      60_000,
      "REMOTE_HTTP_RATE_LIMIT_WINDOW_MS",
      1_000
    ),
    rateLimitMaxRequests: parseIntegerEnv(env.REMOTE_HTTP_RATE_LIMIT_MAX, 120, "REMOTE_HTTP_RATE_LIMIT_MAX", 1),
    wsMessageRateLimitWindowMs: parseIntegerEnv(
      env.REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS,
      10_000,
      "REMOTE_WS_MESSAGE_RATE_LIMIT_WINDOW_MS",
      1_000
    ),
    wsMessageRateLimitMaxRequests: parseIntegerEnv(
      env.REMOTE_WS_MESSAGE_RATE_LIMIT_MAX,
      200,
      "REMOTE_WS_MESSAGE_RATE_LIMIT_MAX",
      1
    )
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

function parseIntegerEnv(
  rawValue: string | undefined,
  defaultValue: number,
  envName: string,
  minimum: number
): number {
  const normalized = normalizeOptional(rawValue);
  if (!normalized) {
    return defaultValue;
  }

  const value = Number(normalized);
  if (!Number.isInteger(value) || value < minimum) {
    if (minimum === 1) {
      throw new Error(`${envName} must be a positive integer`);
    }
    throw new Error(`${envName} must be an integer greater than or equal to ${minimum}`);
  }

  return value;
}
