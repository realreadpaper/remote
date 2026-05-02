import { timingSafeEqual } from "node:crypto";

export interface DevTokenGuardConfig {
  requireDevToken: boolean;
  devToken: string | null;
}

export function getProvidedDevToken(request: { url: string; headers: Record<string, unknown> }): string | null {
  const queryToken = new URL(request.url, "http://localhost").searchParams.get("token");
  if (queryToken && queryToken.trim().length > 0) {
    return queryToken;
  }

  const authorization = readHeader(request.headers, "authorization");
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const bearerToken = match?.[1]?.trim();
  return bearerToken && bearerToken.length > 0 ? bearerToken : null;
}

export function validateDevToken(config: DevTokenGuardConfig, providedToken: string | null): boolean {
  if (!config.requireDevToken) {
    return true;
  }

  if (!config.devToken || !providedToken) {
    return false;
  }

  const expected = Buffer.from(config.devToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function readHeader(headers: Record<string, unknown>, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const firstValue = value.find((item): item is string => typeof item === "string");
    return firstValue ?? null;
  }

  return null;
}
