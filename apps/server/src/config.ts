export interface ServerConfig {
  host: string;
  port: number;
  requireDevToken: boolean;
  devToken: string | null;
  publicBaseUrl: string | null;
  dataDir: string | null;
  databaseUrl: string | null;
  redisUrl: string | null;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  wsMessageRateLimitWindowMs: number;
  wsMessageRateLimitMaxRequests: number;
  terminalInputMaxBytes: number;
  wsRawMessageMaxBytes: number;
  agentOutputRateLimitWindowMs: number;
  agentOutputRateLimitMaxMessages: number;
  agentOutputByteRateLimitWindowMs: number;
  agentOutputByteRateLimitMaxBytes: number;
  mobileInputByteRateLimitWindowMs: number;
  mobileInputByteRateLimitMaxBytes: number;
}

type ServerEnv = Record<string, string | undefined>;

export function loadServerConfig(env: ServerEnv = process.env): ServerConfig {
  const port = parsePort(env.PORT);
  const requireDevToken = env.REMOTE_REQUIRE_DEV_TOKEN === "1";
  const devToken = normalizeOptional(env.REMOTE_DEV_TOKEN);
  const publicBaseUrl = parsePublicBaseUrl(env);

  if (requireDevToken && !devToken) {
    throw new Error("REMOTE_DEV_TOKEN is required when REMOTE_REQUIRE_DEV_TOKEN=1");
  }

  if (env.REMOTE_RELEASE === "1") {
    if (!requireDevToken) {
      throw new Error("REMOTE_REQUIRE_DEV_TOKEN=1 is required when REMOTE_RELEASE=1");
    }
    if (publicBaseUrl) {
      assertNoReleasePlaceholder(publicBaseUrl, "Release server endpoint");
    }
  }

  return {
    host: normalizeOptional(env.HOST) ?? "127.0.0.1",
    port,
    requireDevToken,
    devToken,
    publicBaseUrl,
    dataDir: normalizeOptional(env.REMOTE_DATA_DIR),
    databaseUrl: parseOptionalUrl(env.DATABASE_URL, "DATABASE_URL"),
    redisUrl: parseOptionalUrl(env.REDIS_URL, "REDIS_URL"),
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
    ),
    terminalInputMaxBytes: parseIntegerEnv(
      env.REMOTE_TERMINAL_INPUT_MAX_BYTES,
      16_384,
      "REMOTE_TERMINAL_INPUT_MAX_BYTES",
      1
    ),
    wsRawMessageMaxBytes: parseIntegerEnv(
      env.REMOTE_WS_RAW_MESSAGE_MAX_BYTES,
      65_536,
      "REMOTE_WS_RAW_MESSAGE_MAX_BYTES",
      1
    ),
    agentOutputRateLimitWindowMs: parseIntegerEnv(
      env.REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS,
      10_000,
      "REMOTE_AGENT_OUTPUT_RATE_LIMIT_WINDOW_MS",
      1_000
    ),
    agentOutputRateLimitMaxMessages: parseIntegerEnv(
      env.REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX,
      1000,
      "REMOTE_AGENT_OUTPUT_RATE_LIMIT_MAX",
      1
    ),
    agentOutputByteRateLimitWindowMs: parseIntegerEnv(
      env.REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS,
      10_000,
      "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_WINDOW_MS",
      1_000
    ),
    agentOutputByteRateLimitMaxBytes: parseIntegerEnv(
      env.REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX,
      1_048_576,
      "REMOTE_AGENT_OUTPUT_BYTE_RATE_LIMIT_MAX",
      1
    ),
    mobileInputByteRateLimitWindowMs: parseIntegerEnv(
      env.REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS,
      10_000,
      "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_WINDOW_MS",
      1_000
    ),
    mobileInputByteRateLimitMaxBytes: parseIntegerEnv(
      env.REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX,
      262_144,
      "REMOTE_MOBILE_INPUT_BYTE_RATE_LIMIT_MAX",
      1
    )
  };
}

function parsePublicBaseUrl(env: ServerEnv): string | null {
  const explicit = normalizeOptional(env.REMOTE_PUBLIC_BASE_URL);
  if (explicit) {
    return explicit;
  }

  const relayHost = normalizeOptional(env.REMOTE_RELAY_HOST);
  return relayHost ? `https://${relayHost}` : null;
}

function assertNoReleasePlaceholder(rawUrl: string, context: string): void {
  const url = new URL(rawUrl);
  const host = url.host;
  if (
    host === "api.example.com" ||
    host.endsWith(".example.invalid") ||
    host.includes("<") ||
    host.includes(">")
  ) {
    throw new Error(`${context} must not use placeholder host ${host}`);
  }
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

function parseOptionalUrl(rawValue: string | undefined, envName: string): string | null {
  const normalized = normalizeOptional(rawValue);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    throw new Error(`${envName} must be a valid URL`);
  }
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
