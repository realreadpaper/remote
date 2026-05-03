export const PAIRING_TOKEN_STORAGE_KEY = "remote-terminal.pairing-token.v1";
export const PAIRING_TOKEN_LIST_STORAGE_KEY = "remote-terminal.pairing-token-list.v1";

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
  await upsertPairingToken(storage, record);
}

export async function loadPairingToken(
  storage: PairingTokenStorage,
  options: LoadPairingTokenOptions = {}
): Promise<PairingTokenRecord | null> {
  const records = await loadPairingTokens(storage, options);
  return records[0] ?? null;
}

export async function clearPairingToken(storage: PairingTokenStorage): Promise<void> {
  await storage.deleteItem(PAIRING_TOKEN_STORAGE_KEY);
  await storage.deleteItem(PAIRING_TOKEN_LIST_STORAGE_KEY);
}

export async function loadPairingTokens(
  storage: PairingTokenStorage,
  options: LoadPairingTokenOptions = {}
): Promise<PairingTokenRecord[]> {
  const now = options.now?.() ?? new Date();
  const fromList = await loadTokenList(storage, now);
  if (fromList) {
    return fromList;
  }

  const legacy = await loadLegacyPairingToken(storage, now);
  if (!legacy) {
    return [];
  }

  await storage.setItem(PAIRING_TOKEN_LIST_STORAGE_KEY, JSON.stringify([legacy]));
  return [legacy];
}

export async function upsertPairingToken(storage: PairingTokenStorage, record: PairingTokenRecord): Promise<void> {
  const records = await loadPairingTokens(storage);
  const next = [...records.filter((item) => item.deviceId !== record.deviceId), record];
  await storage.setItem(PAIRING_TOKEN_LIST_STORAGE_KEY, JSON.stringify(next));
}

export async function removePairingToken(storage: PairingTokenStorage, deviceId: string): Promise<void> {
  const records = await loadPairingTokens(storage);
  const next = records.filter((item) => item.deviceId !== deviceId);
  await storage.setItem(PAIRING_TOKEN_LIST_STORAGE_KEY, JSON.stringify(next));
  const legacy = await loadLegacyPairingToken(storage, new Date());
  if (legacy?.deviceId === deviceId) {
    await storage.deleteItem(PAIRING_TOKEN_STORAGE_KEY);
  }
}

async function loadTokenList(storage: PairingTokenStorage, now: Date): Promise<PairingTokenRecord[] | null> {
  const raw = await storage.getItem(PAIRING_TOKEN_LIST_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await storage.deleteItem(PAIRING_TOKEN_LIST_STORAGE_KEY);
    return [];
  }

  if (!Array.isArray(parsed)) {
    await storage.deleteItem(PAIRING_TOKEN_LIST_STORAGE_KEY);
    return [];
  }

  const records = parsed
    .map(parsePairingTokenRecord)
    .filter((record): record is PairingTokenRecord => Boolean(record))
    .filter((record) => Date.parse(record.expiresAt) > now.getTime());

  if (records.length !== parsed.length) {
    await storage.setItem(PAIRING_TOKEN_LIST_STORAGE_KEY, JSON.stringify(records));
  }

  return records;
}

async function loadLegacyPairingToken(storage: PairingTokenStorage, now: Date): Promise<PairingTokenRecord | null> {
  const raw = await storage.getItem(PAIRING_TOKEN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await storage.deleteItem(PAIRING_TOKEN_STORAGE_KEY);
    return null;
  }

  const record = parsePairingTokenRecord(parsed);
  if (!record || Date.parse(record.expiresAt) <= now.getTime()) {
    await storage.deleteItem(PAIRING_TOKEN_STORAGE_KEY);
    return null;
  }

  return record;
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
