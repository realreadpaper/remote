import { describe, expect, it } from "vitest";
import {
  clearPairingToken,
  loadPairingTokens,
  loadPairingToken,
  PAIRING_TOKEN_STORAGE_KEY,
  PAIRING_TOKEN_LIST_STORAGE_KEY,
  removePairingToken,
  savePairingToken,
  upsertPairingToken,
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

const secondToken = {
  deviceId: "mac-2",
  sessionToken: "session-token-2",
  expiresAt: "2026-05-05T00:00:00.000Z",
  pairedAt: "2026-05-03T01:00:00.000Z"
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

  it("loads multiple non-expired pairing tokens", async () => {
    const storage = new FakePairingTokenStorage();

    await upsertPairingToken(storage, validToken);
    await upsertPairingToken(storage, secondToken);

    await expect(
      loadPairingTokens(storage, {
        now: () => new Date("2026-05-03T12:00:00.000Z")
      })
    ).resolves.toEqual([validToken, secondToken]);
    expect(storage.values.get(PAIRING_TOKEN_LIST_STORAGE_KEY)).toBe(JSON.stringify([validToken, secondToken]));
  });

  it("migrates the legacy single pairing token into the token list", async () => {
    const storage = new FakePairingTokenStorage();
    storage.values.set(PAIRING_TOKEN_STORAGE_KEY, JSON.stringify(validToken));

    await expect(
      loadPairingTokens(storage, {
        now: () => new Date("2026-05-03T12:00:00.000Z")
      })
    ).resolves.toEqual([validToken]);

    expect(storage.values.get(PAIRING_TOKEN_LIST_STORAGE_KEY)).toBe(JSON.stringify([validToken]));
  });

  it("removes only the requested pairing token from the token list", async () => {
    const storage = new FakePairingTokenStorage();
    await upsertPairingToken(storage, validToken);
    await upsertPairingToken(storage, secondToken);

    await removePairingToken(storage, "mac-1");

    await expect(
      loadPairingTokens(storage, {
        now: () => new Date("2026-05-03T12:00:00.000Z")
      })
    ).resolves.toEqual([secondToken]);
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
    expect(storage.values.has(PAIRING_TOKEN_LIST_STORAGE_KEY)).toBe(false);
    expect(storage.deletedKeys).toEqual([PAIRING_TOKEN_STORAGE_KEY, PAIRING_TOKEN_LIST_STORAGE_KEY]);
  });

  it("can clear the pairing token more than once", async () => {
    const storage = new FakePairingTokenStorage();

    await clearPairingToken(storage);
    await clearPairingToken(storage);

    expect(storage.deletedKeys).toEqual([
      PAIRING_TOKEN_STORAGE_KEY,
      PAIRING_TOKEN_LIST_STORAGE_KEY,
      PAIRING_TOKEN_STORAGE_KEY,
      PAIRING_TOKEN_LIST_STORAGE_KEY
    ]);
  });
});
