import { describe, expect, it } from "vitest";
import { MemoryPairingStore } from "../../src/pairing/pairingStore.js";
import { PairingService } from "../../src/pairing/pairingService.js";

function createHarness() {
  let nowMs = Date.parse("2026-05-03T00:00:00.000Z");
  let codeCounter = 0;
  let idCounter = 0;
  const service = new PairingService(new MemoryPairingStore(), {
    now: () => new Date(nowMs),
    generatePairingCode: () => `code-${++codeCounter}`,
    generateId: () => `id-${++idCounter}`,
    pairingTtlMs: 60_000
  });

  return {
    service,
    advance(ms: number) {
      nowMs += ms;
    }
  };
}

describe("PairingService", () => {
  it("creates a one-time pairing code for a device", () => {
    const { service } = createHarness();

    const created = service.createPairingCode({
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      serverUrl: "wss://relay.example.test"
    });

    expect(created).toEqual({
      type: "pairing.created",
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      serverUrl: "wss://relay.example.test",
      pairingCode: "code-1",
      expiresAt: "2026-05-03T00:01:00.000Z"
    });
  });

  it("rejects expired pairing codes", () => {
    const { service, advance } = createHarness();
    const created = service.createPairingCode({
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      serverUrl: "wss://relay.example.test"
    });

    advance(60_001);

    expect(() =>
      service.requestPairing({
        pairingCode: created.pairingCode,
        mobileClientId: "mobile-1",
        mobileName: "Alice iPhone"
      })
    ).toThrow("Pairing code expired");
  });

  it("rejects pairing codes that were already used", () => {
    const { service } = createHarness();
    const created = service.createPairingCode({
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      serverUrl: "wss://relay.example.test"
    });

    service.requestPairing({
      pairingCode: created.pairingCode,
      mobileClientId: "mobile-1",
      mobileName: "Alice iPhone"
    });

    expect(() =>
      service.requestPairing({
        pairingCode: created.pairingCode,
        mobileClientId: "mobile-2",
        mobileName: "Bob iPhone"
      })
    ).toThrow("Pairing code already used");
  });

  it("marks a pairing request as rejected", () => {
    const { service } = createHarness();
    const created = service.createPairingCode({
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      serverUrl: "wss://relay.example.test"
    });
    const request = service.requestPairing({
      pairingCode: created.pairingCode,
      mobileClientId: "mobile-1",
      mobileName: "Alice iPhone"
    });

    const rejected = service.rejectPairingRequest({
      pairingRequestId: request.pairingRequestId,
      deviceId: "device-1",
      reason: "User denied"
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.reason).toBe("User denied");
    expect(service.listBindings()).toEqual([]);
  });

  it("creates a binding when the agent approves a pending request", () => {
    const { service } = createHarness();
    const created = service.createPairingCode({
      deviceId: "device-1",
      deviceName: "MacBook Pro",
      serverUrl: "wss://relay.example.test"
    });
    const request = service.requestPairing({
      pairingCode: created.pairingCode,
      mobileClientId: "mobile-1",
      mobileName: "Alice iPhone"
    });

    const binding = service.approvePairingRequest({
      pairingRequestId: request.pairingRequestId,
      deviceId: "device-1"
    });

    expect(binding).toEqual({
      bindingId: "id-2",
      deviceId: "device-1",
      mobileClientId: "mobile-1",
      mobileName: "Alice iPhone",
      approvedAt: "2026-05-03T00:00:00.000Z"
    });
    expect(service.listBindings()).toEqual([binding]);
  });
});
