export const PAIRING_TOKEN_STORAGE_KEY = "remote-terminal.pairing-token.v1";

export interface PairingTokenRecord {
  deviceId: string;
  sessionToken: string;
  expiresAt: string;
  pairedAt: string;
}

export interface PairingTokenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface LoadPairingTokenOptions {
  now?: () => Date;
}

export function createSecureStorePairingTokenStorage(): PairingTokenStorage {
  return {
    getItem: async (key) => {
      const secureStore = await import("expo-secure-store");
      return secureStore.getItemAsync(key);
    },
    setItem: async (key, value) => {
      const secureStore = await import("expo-secure-store");
      await secureStore.setItemAsync(key, value);
    },
    deleteItem: async (key) => {
      const secureStore = await import("expo-secure-store");
      await secureStore.deleteItemAsync(key);
    }
  };
}

export async function savePairingToken(storage: PairingTokenStorage, record: PairingTokenRecord): Promise<void> {
  await storage.setItem(PAIRING_TOKEN_STORAGE_KEY, JSON.stringify(record));
}

export async function loadPairingToken(
  storage: PairingTokenStorage,
  options: LoadPairingTokenOptions = {}
): Promise<PairingTokenRecord | null> {
  const raw = await storage.getItem(PAIRING_TOKEN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await clearPairingToken(storage);
    return null;
  }

  const record = parsePairingTokenRecord(parsed);
  if (!record) {
    await clearPairingToken(storage);
    return null;
  }

  const now = options.now?.() ?? new Date();
  if (Date.parse(record.expiresAt) <= now.getTime()) {
    await clearPairingToken(storage);
    return null;
  }

  return record;
}

export async function clearPairingToken(storage: PairingTokenStorage): Promise<void> {
  await storage.deleteItem(PAIRING_TOKEN_STORAGE_KEY);
}

function parsePairingTokenRecord(input: unknown): PairingTokenRecord | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const record = input as Record<string, unknown>;
  if (
    typeof record.deviceId !== "string" ||
    record.deviceId.trim().length === 0 ||
    typeof record.sessionToken !== "string" ||
    record.sessionToken.trim().length === 0 ||
    typeof record.expiresAt !== "string" ||
    record.expiresAt.trim().length === 0 ||
    typeof record.pairedAt !== "string" ||
    record.pairedAt.trim().length === 0 ||
    Number.isNaN(Date.parse(record.expiresAt))
  ) {
    return null;
  }

  return {
    deviceId: record.deviceId,
    sessionToken: record.sessionToken,
    expiresAt: record.expiresAt,
    pairedAt: record.pairedAt
  };
}
