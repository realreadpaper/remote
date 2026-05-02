import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonFileSessionTokenStore, MemorySessionTokenStore } from "../../src/auth/sessionTokens.js";

function tempFile(): string {
  return join(mkdtempSync(join(tmpdir(), "remote-session-tokens-")), "session-tokens.json");
}

describe("MemorySessionTokenStore", () => {
  it("issues a token record with expiry metadata", () => {
    const store = new MemorySessionTokenStore({
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      generateToken: () => "token-1",
      tokenTtlMs: 60_000
    });

    const token = store.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    expect(token).toEqual({
      sessionToken: "token-1",
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      issuedAt: "2026-05-03T00:00:00.000Z",
      expiresAt: "2026-05-03T00:01:00.000Z"
    });
  });

  it("accepts a valid token for the matching device", () => {
    const store = new MemorySessionTokenStore({
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      generateToken: () => "token-1",
      tokenTtlMs: 60_000
    });
    store.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    const result = store.verifySessionToken({
      sessionToken: "token-1",
      deviceId: "mac-1",
      now: new Date("2026-05-03T00:00:30.000Z")
    });

    expect(result).toEqual({
      ok: true,
      record: {
        sessionToken: "token-1",
        bindingId: "binding-1",
        deviceId: "mac-1",
        mobileClientId: "mobile-1",
        issuedAt: "2026-05-03T00:00:00.000Z",
        expiresAt: "2026-05-03T00:01:00.000Z"
      }
    });
  });

  it("rejects an unknown token", () => {
    const store = new MemorySessionTokenStore();

    expect(
      store.verifySessionToken({
        sessionToken: "missing",
        deviceId: "mac-1"
      })
    ).toEqual({ ok: false, reason: "Invalid session token" });
  });

  it("rejects an expired token", () => {
    const store = new MemorySessionTokenStore({
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      generateToken: () => "token-1",
      tokenTtlMs: 60_000
    });
    store.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    expect(
      store.verifySessionToken({
        sessionToken: "token-1",
        deviceId: "mac-1",
        now: new Date("2026-05-03T00:01:01.000Z")
      })
    ).toEqual({ ok: false, reason: "Session token expired" });
  });

  it("rejects a token issued for another device", () => {
    const store = new MemorySessionTokenStore({
      generateToken: () => "token-1"
    });
    store.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    expect(
      store.verifySessionToken({
        sessionToken: "token-1",
        deviceId: "mac-2"
      })
    ).toEqual({ ok: false, reason: "Session token is not valid for device mac-2" });
  });

  it("revokes a token so it can no longer be verified", () => {
    const store = new MemorySessionTokenStore({
      generateToken: () => "token-1"
    });
    store.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    expect(store.revokeSessionToken({ sessionToken: "token-1", deviceId: "mac-1" })).toEqual({ revoked: true });
    expect(store.verifySessionToken({ sessionToken: "token-1", deviceId: "mac-1" })).toEqual({
      ok: false,
      reason: "Invalid session token"
    });
  });

  it("rejects revoke when the token belongs to another device", () => {
    const store = new MemorySessionTokenStore({
      generateToken: () => "token-1"
    });
    store.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    expect(() => store.revokeSessionToken({ sessionToken: "token-1", deviceId: "mac-2" })).toThrow(
      "Session token is not valid for device mac-2"
    );
  });

  it("persists session tokens across store instances", () => {
    const filePath = tempFile();
    const first = new JsonFileSessionTokenStore(filePath, {
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      generateToken: () => "token-1",
      tokenTtlMs: 60_000
    });
    first.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    const second = new JsonFileSessionTokenStore(filePath, {
      now: () => new Date("2026-05-03T00:00:30.000Z")
    });

    expect(
      second.verifySessionToken({
        sessionToken: "token-1",
        deviceId: "mac-1"
      })
    ).toMatchObject({ ok: true });
  });

  it("finds the newest token for a binding", () => {
    let nowMs = Date.parse("2026-05-03T00:00:00.000Z");
    const store = new JsonFileSessionTokenStore(tempFile(), {
      now: () => new Date(nowMs),
      generateToken: (() => {
        const tokens = ["token-1", "token-2"];
        return () => tokens.shift() ?? "token-x";
      })(),
      tokenTtlMs: 60_000
    });
    store.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });
    nowMs += 1_000;
    const newer = store.issueSessionToken({
      bindingId: "binding-2",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });

    expect(store.findTokenForBinding({ deviceId: "mac-1", mobileClientId: "mobile-1" })).toEqual(newer);
  });

  it("throws when the persisted token store is invalid JSON", () => {
    const filePath = tempFile();
    writeFileSync(filePath, "{", "utf8");

    expect(() => new JsonFileSessionTokenStore(filePath)).toThrow("Session token store file is invalid");
  });

  it("persists token revocation across JSON store instances", () => {
    const filePath = tempFile();
    const first = new JsonFileSessionTokenStore(filePath, {
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      generateToken: () => "token-1",
      tokenTtlMs: 60_000
    });
    first.issueSessionToken({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1"
    });
    first.revokeSessionToken({ sessionToken: "token-1", deviceId: "mac-1" });

    const second = new JsonFileSessionTokenStore(filePath);

    expect(second.verifySessionToken({ sessionToken: "token-1", deviceId: "mac-1" })).toEqual({
      ok: false,
      reason: "Invalid session token"
    });
  });
});
