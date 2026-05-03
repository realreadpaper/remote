import type { Queryable } from "./db.js";

export interface MobileClientRecord {
  mobileClientId: string;
  userId: string | null;
  name: string;
  platform: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface UpsertMobileClientInput {
  mobileClientId: string;
  userId: string | null;
  name: string;
  platform: string;
  lastSeenAt: string;
}

export interface DeviceBindingRecord {
  bindingId: string;
  deviceId: string;
  mobileClientId: string;
  userId: string;
  approvedAt: string;
  revokedAt: string | null;
}

export interface CreateBindingInput {
  bindingId: string;
  deviceId: string;
  mobileClientId: string;
  userId: string;
  approvedAt: string;
}

interface MobileClientRow {
  id: string;
  user_id: string | null;
  name: string;
  platform: string;
  last_seen_at: Date | string;
  revoked_at: Date | string | null;
}

interface DeviceBindingRow {
  id: string;
  device_id: string;
  mobile_client_id: string;
  user_id: string;
  approved_at: Date | string;
  revoked_at: Date | string | null;
}

export class BindingRepository {
  constructor(private readonly db: Queryable) {}

  async upsertMobileClient(input: UpsertMobileClientInput): Promise<MobileClientRecord> {
    const result = await this.db.query<MobileClientRow>(
      `
        insert into mobile_clients (id, user_id, name, platform, last_seen_at)
        values ($1, $2, $3, $4, $5)
        on conflict (id) do update set
          user_id = excluded.user_id,
          name = excluded.name,
          platform = excluded.platform,
          last_seen_at = excluded.last_seen_at
        returning id, user_id, name, platform, last_seen_at, revoked_at
      `,
      [input.mobileClientId, input.userId, input.name, input.platform, input.lastSeenAt]
    );

    return mapMobileClientRow(readOne(result.rows));
  }

  async createBinding(input: CreateBindingInput): Promise<DeviceBindingRecord> {
    const result = await this.db.query<DeviceBindingRow>(
      `
        insert into device_bindings (id, device_id, mobile_client_id, user_id, approved_at)
        values ($1, $2, $3, $4, $5)
        returning id, device_id, mobile_client_id, user_id, approved_at, revoked_at
      `,
      [input.bindingId, input.deviceId, input.mobileClientId, input.userId, input.approvedAt]
    );

    return mapBindingRow(readOne(result.rows));
  }

  async revokeBinding(bindingId: string, revokedAt: string): Promise<boolean> {
    const result = await this.db.query<DeviceBindingRow>(
      `
        update device_bindings
        set revoked_at = $2
        where id = $1
          and revoked_at is null
        returning id, device_id, mobile_client_id, user_id, approved_at, revoked_at
      `,
      [bindingId, revokedAt]
    );

    return result.rows.length > 0;
  }

  async listActiveBindingsForUser(userId: string): Promise<DeviceBindingRecord[]> {
    const result = await this.db.query<DeviceBindingRow>(
      `
        select id, device_id, mobile_client_id, user_id, approved_at, revoked_at
        from device_bindings
        where user_id = $1
          and revoked_at is null
        order by approved_at asc, id asc
      `,
      [userId]
    );

    return result.rows.map(mapBindingRow);
  }
}

function mapMobileClientRow(row: MobileClientRow): MobileClientRecord {
  return {
    mobileClientId: row.id,
    userId: row.user_id,
    name: row.name,
    platform: row.platform,
    lastSeenAt: toIsoString(row.last_seen_at),
    revokedAt: row.revoked_at ? toIsoString(row.revoked_at) : null
  };
}

function mapBindingRow(row: DeviceBindingRow): DeviceBindingRecord {
  return {
    bindingId: row.id,
    deviceId: row.device_id,
    mobileClientId: row.mobile_client_id,
    userId: row.user_id,
    approvedAt: toIsoString(row.approved_at),
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
