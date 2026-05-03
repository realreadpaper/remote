create table if not exists users (
  id text primary key,
  email text unique,
  created_at timestamptz not null,
  disabled_at timestamptz
);

create table if not exists devices (
  id text primary key,
  owner_user_id text references users(id),
  name text not null,
  platform text not null,
  capabilities jsonb not null,
  last_seen_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists devices_owner_user_id_idx on devices(owner_user_id);

create table if not exists mobile_clients (
  id text primary key,
  user_id text references users(id),
  name text not null,
  platform text not null,
  last_seen_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists mobile_clients_user_id_idx on mobile_clients(user_id);

create table if not exists device_bindings (
  id text primary key,
  device_id text not null references devices(id),
  mobile_client_id text not null references mobile_clients(id),
  user_id text not null references users(id),
  approved_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists device_bindings_user_id_idx on device_bindings(user_id);
create index if not exists device_bindings_device_id_idx on device_bindings(device_id);
create unique index if not exists device_bindings_active_unique_idx
  on device_bindings(device_id, mobile_client_id)
  where revoked_at is null;

create table if not exists sessions (
  id text primary key,
  device_id text not null references devices(id),
  mobile_client_id text references mobile_clients(id),
  state text not null,
  created_at timestamptz not null,
  closed_at timestamptz
);

create index if not exists sessions_device_id_idx on sessions(device_id);
create index if not exists sessions_mobile_client_id_idx on sessions(mobile_client_id);
