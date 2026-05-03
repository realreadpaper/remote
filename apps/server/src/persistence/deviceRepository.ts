import type { Queryable } from "./db.js";

export interface UserRecord {
  userId: string;
  email: string | null;
  createdAt: string;
  disabledAt: string | null;
}

export interface UpsertUserInput {
  userId: string;
  email: string | null;
  createdAt: string;
}

export interface DeviceRecord {
  deviceId: string;
  ownerUserId: string | null;
  name: string;
  platform: string;
  capabilities: string[];
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface UpsertDeviceInput {
  deviceId: string;
  ownerUserId: string | null;
  name: string;
  platform: string;
  capabilities: string[];
  lastSeenAt: string;
}

interface UserRow {
  id: string;
  email: string | null;
  created_at: Date | string;
  disabled_at: Date | string | null;
}

interface DeviceRow {
  id: string;
  owner_user_id: string | null;
  name: string;
  platform: string;
  capabilities: string[] | string;
  last_seen_at: Date | string;
  revoked_at: Date | string | null;
}

export class DeviceRepository {
  constructor(private readonly db: Queryable) {}

  async upsertUser(input: UpsertUserInput): Promise<UserRecord> {
    const result = await this.db.query<UserRow>(
      `
        insert into users (id, email, created_at)
        values ($1, $2, $3)
        on conflict (id) do update set
          email = excluded.email
        returning id, email, created_at, disabled_at
      `,
      [input.userId, input.email, input.createdAt]
    );

    return mapUserRow(readOne(result.rows));
  }

  async upsertDevice(input: UpsertDeviceInput): Promise<DeviceRecord> {
    const result = await this.db.query<DeviceRow>(
      `
        insert into devices (id, owner_user_id, name, platform, capabilities, last_seen_at)
        values ($1, $2, $3, $4, $5::jsonb, $6)
        on conflict (id) do update set
          owner_user_id = excluded.owner_user_id,
          name = excluded.name,
          platform = excluded.platform,
          capabilities = excluded.capabilities,
          last_seen_at = excluded.last_seen_at
        returning id, owner_user_id, name, platform, capabilities, last_seen_at, revoked_at
      `,
      [
        input.deviceId,
        input.ownerUserId,
        input.name,
        input.platform,
        JSON.stringify(input.capabilities),
        input.lastSeenAt
      ]
    );

    return mapDeviceRow(readOne(result.rows));
  }

  async getDevice(deviceId: string): Promise<DeviceRecord | undefined> {
    const result = await this.db.query<DeviceRow>(
      `
        select id, owner_user_id, name, platform, capabilities, last_seen_at, revoked_at
        from devices
        where id = $1
      `,
      [deviceId]
    );

    return result.rows[0] ? mapDeviceRow(result.rows[0]) : undefined;
  }

  async listDevicesForUser(userId: string): Promise<DeviceRecord[]> {
    const result = await this.db.query<DeviceRow>(
      `
        select distinct d.id, d.owner_user_id, d.name, d.platform, d.capabilities, d.last_seen_at, d.revoked_at
        from devices d
        join device_bindings b on b.device_id = d.id
        where b.user_id = $1
          and b.revoked_at is null
          and d.revoked_at is null
        order by d.name asc, d.id asc
      `,
      [userId]
    );

    return result.rows.map(mapDeviceRow);
  }
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    userId: row.id,
    email: row.email,
    createdAt: toIsoString(row.created_at),
    disabledAt: row.disabled_at ? toIsoString(row.disabled_at) : null
  };
}

function mapDeviceRow(row: DeviceRow): DeviceRecord {
  return {
    deviceId: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    platform: row.platform,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : JSON.parse(row.capabilities),
    lastSeenAt: toIsoString(row.last_seen_at),
    revokedAt: row.revoked_at ? toIsoString(row.revoked_at) : null
  };
}

function readOne<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) {
    throw new Error("Expected query to return a row");
  }
  return row;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
