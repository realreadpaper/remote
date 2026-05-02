import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JsonFilePairingStore } from "../../src/pairing/pairingStore.js";

function tempFile(): string {
  return join(mkdtempSync(join(tmpdir(), "remote-pairing-store-")), "pairing-store.json");
}

describe("JsonFilePairingStore", () => {
  it("persists pairing codes, requests, and bindings across store instances", () => {
    const filePath = tempFile();
    const first = new JsonFilePairingStore(filePath);

    first.saveCode({
      codeHash: "hash-1",
      deviceId: "mac-1",
      deviceName: "Mac",
      serverUrl: "http://127.0.0.1:8787",
      createdAt: "2026-05-03T00:00:00.000Z",
      expiresAt: "2026-05-03T00:05:00.000Z",
      usedAt: null
    });
    first.markCodeUsed("hash-1", "2026-05-03T00:01:00.000Z");
    first.saveRequest({
      pairingRequestId: "request-1",
      codeHash: "hash-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      mobileName: "iPhone",
      requestedAt: "2026-05-03T00:01:00.000Z",
      status: "approved",
      decidedAt: "2026-05-03T00:02:00.000Z",
      reason: null
    });
    first.saveBinding({
      bindingId: "binding-1",
      deviceId: "mac-1",
      mobileClientId: "mobile-1",
      mobileName: "iPhone",
      approvedAt: "2026-05-03T00:02:00.000Z"
    });

    const second = new JsonFilePairingStore(filePath);

    expect(second.getCode("hash-1")).toEqual({
      codeHash: "hash-1",
      deviceId: "mac-1",
      deviceName: "Mac",
      serverUrl: "http://127.0.0.1:8787",
      createdAt: "2026-05-03T00:00:00.000Z",
      expiresAt: "2026-05-03T00:05:00.000Z",
      usedAt: "2026-05-03T00:01:00.000Z"
    });
    expect(second.getRequest("request-1")).toMatchObject({
      pairingRequestId: "request-1",
      status: "approved"
    });
    expect(second.listBindings()).toEqual([
      {
        bindingId: "binding-1",
        deviceId: "mac-1",
        mobileClientId: "mobile-1",
        mobileName: "iPhone",
        approvedAt: "2026-05-03T00:02:00.000Z"
      }
    ]);
  });

  it("throws when the persisted pairing store is invalid JSON", () => {
    const filePath = tempFile();
    writeFileSync(filePath, "{", "utf8");

    expect(() => new JsonFilePairingStore(filePath)).toThrow("Pairing store file is invalid");
  });
});
