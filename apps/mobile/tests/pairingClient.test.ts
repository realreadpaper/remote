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
