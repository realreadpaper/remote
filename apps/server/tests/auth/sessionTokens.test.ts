import { describe, expect, it } from "vitest";
import { MemorySessionTokenStore } from "../../src/auth/sessionTokens.js";

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
});
