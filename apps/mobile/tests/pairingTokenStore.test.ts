import { describe, expect, it } from "vitest";
import {
  clearPairingToken,
  loadPairingToken,
  PAIRING_TOKEN_STORAGE_KEY,
  savePairingToken,
  type PairingTokenStorage
} from "../src/state/pairingTokenStore";

class FakePairingTokenStorage implements PairingTokenStorage {
  readonly values = new Map<string, string>();
  readonly deletedKeys: string[] = [];

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.deletedKeys.push(key);
    this.values.delete(key);
  }
}

const validToken = {
  deviceId: "mac-1",
  sessionToken: "session-token-1",
  expiresAt: "2026-05-04T00:00:00.000Z",
  pairedAt: "2026-05-03T00:00:00.000Z"
};

describe("pairingTokenStore", () => {
  it("saves a pairing token as JSON under the stable storage key", async () => {
    const storage = new FakePairingTokenStorage();

    await savePairingToken(storage, validToken);

    expect(storage.values.get(PAIRING_TOKEN_STORAGE_KEY)).toBe(JSON.stringify(validToken));
  });

  it("loads a valid non-expired pairing token", async () => {
    const storage = new FakePairingTokenStorage();
    storage.values.set(PAIRING_TOKEN_STORAGE_KEY, JSON.stringify(validToken));

    await expect(
      loadPairingToken(storage, {
        now: () => new Date("2026-05-03T12:00:00.000Z")
      })
    ).resolves.toEqual(validToken);
    expect(storage.deletedKeys).toEqual([]);
  });

  it("clears and ignores an expired pairing token", async () => {
    const storage = new FakePairingTokenStorage();
    storage.values.set(PAIRING_TOKEN_STORAGE_KEY, JSON.stringify(validToken));

    await expect(
      loadPairingToken(storage, {
        now: () => new Date("2026-05-04T00:00:00.000Z")
      })
    ).resolves.toBeNull();
    expect(storage.deletedKeys).toEqual([PAIRING_TOKEN_STORAGE_KEY]);
  });

  it("clears and ignores invalid JSON", async () => {
    const storage = new FakePairingTokenStorage();
    storage.values.set(PAIRING_TOKEN_STORAGE_KEY, "{");

    await expect(loadPairingToken(storage)).resolves.toBeNull();
    expect(storage.deletedKeys).toEqual([PAIRING_TOKEN_STORAGE_KEY]);
  });

  it("deletes the stored pairing token", async () => {
    const storage = new FakePairingTokenStorage();
    storage.values.set(PAIRING_TOKEN_STORAGE_KEY, JSON.stringify(validToken));

    await clearPairingToken(storage);

    expect(storage.values.has(PAIRING_TOKEN_STORAGE_KEY)).toBe(false);
    expect(storage.deletedKeys).toEqual([PAIRING_TOKEN_STORAGE_KEY]);
  });

  it("can clear the pairing token more than once", async () => {
    const storage = new FakePairingTokenStorage();

    await clearPairingToken(storage);
    await clearPairingToken(storage);

    expect(storage.deletedKeys).toEqual([PAIRING_TOKEN_STORAGE_KEY, PAIRING_TOKEN_STORAGE_KEY]);
  });
});
