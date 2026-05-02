import { describe, expect, it, vi } from "vitest";
import { PairingClient } from "../src/protocol/pairingClient";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body
  } as Response;
}

describe("PairingClient", () => {
  it("posts a pairing request and returns the pending result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        pairingRequestId: "request-1",
        deviceId: "device-1",
        status: "pending"
      })
    );
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchMock
    });

    await expect(
      client.requestPairing({
        pairingCode: "123456",
        mobileClientId: "mobile-1",
        mobileName: "Alice iPhone"
      })
    ).resolves.toEqual({
      pairingRequestId: "request-1",
      deviceId: "device-1",
      status: "pending"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/pairing/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairingCode: "123456",
        mobileClientId: "mobile-1",
        mobileName: "Alice iPhone"
      })
    });
  });

  it("gets pending pairing request status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        pairingRequestId: "request-1",
        deviceId: "device-1",
        status: "pending"
      })
    );
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787/",
      fetchImpl: fetchMock
    });

    await expect(client.getPairingRequest("request-1")).resolves.toEqual({
      pairingRequestId: "request-1",
      deviceId: "device-1",
      status: "pending"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/pairing/requests/request-1");
  });

  it("gets approved pairing request status with an auth session token", async () => {
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({
          pairingRequestId: "request-1",
          deviceId: "device-1",
          status: "approved",
          auth: {
            type: "auth.sessionToken",
            sessionId: "pending",
            deviceId: "device-1",
            sessionToken: "session-token-1",
            expiresAt: "2026-05-04T00:00:00.000Z"
          }
        })
      )
    });

    await expect(client.getPairingRequest("request-1")).resolves.toEqual({
      pairingRequestId: "request-1",
      deviceId: "device-1",
      status: "approved",
      auth: {
        type: "auth.sessionToken",
        sessionId: "pending",
        deviceId: "device-1",
        sessionToken: "session-token-1",
        expiresAt: "2026-05-04T00:00:00.000Z"
      }
    });
  });

  it("gets rejected pairing request status with the rejection reason", async () => {
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({
          pairingRequestId: "request-1",
          deviceId: "device-1",
          status: "rejected",
          reason: "not now"
        })
      )
    });

    await expect(client.getPairingRequest("request-1")).resolves.toEqual({
      pairingRequestId: "request-1",
      deviceId: "device-1",
      status: "rejected",
      reason: "not now"
    });
  });

  it("waits for approval and returns the auth session token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          pairingRequestId: "request-1",
          deviceId: "device-1",
          status: "pending"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          pairingRequestId: "request-1",
          deviceId: "device-1",
          status: "approved",
          auth: {
            type: "auth.sessionToken",
            sessionId: "pending",
            deviceId: "device-1",
            sessionToken: "session-token-1",
            expiresAt: "2026-05-04T00:00:00.000Z"
          }
        })
      );
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchMock
    });

    await expect(
      client.waitForApproval("request-1", {
        intervalMs: 1,
        timeoutMs: 100
      })
    ).resolves.toEqual({
      type: "auth.sessionToken",
      sessionId: "pending",
      deviceId: "device-1",
      sessionToken: "session-token-1",
      expiresAt: "2026-05-04T00:00:00.000Z"
    });
  });

  it("stops waiting when the pairing request is rejected", async () => {
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({
          pairingRequestId: "request-1",
          deviceId: "device-1",
          status: "rejected",
          reason: "not now"
        })
      )
    });

    await expect(
      client.waitForApproval("request-1", {
        intervalMs: 1,
        timeoutMs: 100
      })
    ).rejects.toThrow("Pairing rejected: not now");
  });

  it("revokes a session token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ revoked: true }));
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchMock
    });

    await expect(
      client.revokeSessionToken({
        deviceId: "mac-1",
        sessionToken: "session-token-1"
      })
    ).resolves.toEqual({ revoked: true });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/session-tokens/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "mac-1",
        sessionToken: "session-token-1"
      })
    });
  });

  it("uses the server error message when pairing fails", async () => {
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ error: "Pairing code expired" }, { ok: false, status: 400 }))
    });

    await expect(
      client.requestPairing({
        pairingCode: "123456",
        mobileClientId: "mobile-1",
        mobileName: "Alice iPhone"
      })
    ).rejects.toThrow("Pairing code expired");
  });

  it("rejects invalid pairing responses", async () => {
    const client = new PairingClient({
      apiBaseUrl: "http://127.0.0.1:8787",
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ deviceId: "device-1", status: "pending" }))
    });

    await expect(
      client.requestPairing({
        pairingCode: "123456",
        mobileClientId: "mobile-1",
        mobileName: "Alice iPhone"
      })
    ).rejects.toThrow("Invalid pairing response");
  });
});
