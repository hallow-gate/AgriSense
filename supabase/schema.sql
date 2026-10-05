-- AgriSense schema. Safe to re-run; also upgrades the old SmartCultiva tables.
-- The app never talks to Supabase directly. Only the server does, using the
-- service-role key, so every table is locked (RLS on, no policies).

create extension if not exists pgcrypto;

-- ---------- live state ----------
create table if not exists telemetry(
  id int primary key default 1 check(id = 1),
  temp_c real, humidity real, soil_pct int, shade text, pump boolean,
  updated_at timestamptz default now());
alter table telemetry add column if not exists soil_fault boolean default false;
alter table telemetry add column if not exists rssi int;
alter table telemetry add column if not exists uptime_s bigint;
alter table telemetry add column if not exists heap int;
alter table telemetry add column if not exists boots int;
alter table telemetry add column if not exists fw text;

-- ---------- commands (idempotent, one open command per action) ----------
create table if not exists commands(
  id uuid primary key default gen_random_uuid(),
  action text not null check(action in('water','cover','uncover')),
  idem_key text unique not null,
  status text not null default 'pending' check(status in('pending','sent','done','failed','expired')),
  created_by uuid, created_at timestamptz default now(), sent_at timestamptz, done_at timestamptz);
create unique index if not exists one_open_cmd on commands(action) where status in('pending','sent');

-- ---------- events (device activity log) ----------
create table if not exists events(
  id bigint generated always as identity primary key,
  event_id text unique not null,
  type text not null check(type in('water_auto','water_manual','water_skipped','shade_close','shade_open')),
  source text not null, detail jsonb not null default '{}',
  command_id uuid references commands(id),
  occurred_at timestamptz not null default now(), created_at timestamptz default now());
create index if not exists events_time on events(occurred_at desc);

-- ---------- sensor history (one row about every 5 min) ----------
create table if not exists readings(
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  temp_c real, humidity real, soil_pct int, shade text, pump boolean);
create index if not exists readings_time on readings(recorded_at desc);

-- ---------- automation settings (single row, pushed to the device) ----------
create table if not exists settings(
  id int primary key default 1 check(id = 1),
  auto_water boolean not null default true,
  auto_shade boolean not null default true,
  soil_dry_pct int not null default 40 check(soil_dry_pct between 10 and 80),
  hot_c real not null default 37 check(hot_c between 30 and 45),
  cool_c real not null default 35 check(cool_c between 25 and 43),
  pump_seconds int not null default 30 check(pump_seconds between 5 and 30),
  water_hour_1 int not null default 7 check(water_hour_1 between 0 and 23),
  water_hour_2 int not null default 17 check(water_hour_2 between 0 and 23),
  pump_ml_per_s real not null default 20 check(pump_ml_per_s between 1 and 200),
  updated_at timestamptz default now(), updated_by uuid,
  check(cool_c <= hot_c - 1));
insert into settings(id) values(1) on conflict do nothing;

-- ---------- user / security audit log ----------
create table if not exists audit_logs(
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid, actor_email text,
  action text not null,
  ip text, user_agent text,
  meta jsonb not null default '{}');
create index if not exists audit_time on audit_logs(created_at desc);
create index if not exists audit_actor on audit_logs(actor_id, created_at desc);

-- ---------- lock everything down ----------
alter table telemetry  enable row level security;
alter table commands   enable row level security;
alter table events     enable row level security;
alter table readings   enable row level security;
alter table settings   enable row level security;
alter table audit_logs enable row level security;
drop policy if exists "read" on telemetry;
drop policy if exists "read" on commands;
drop policy if exists "read" on events;
-- No policies on purpose: anon/authenticated roles get nothing. The server
-- uses the service-role key, which bypasses RLS.

-- ---------- aggregation helpers (server only) ----------
create or replace function readings_bucketed(since timestamptz, bucket_seconds int)
returns table(t timestamptz, temp_c real, humidity real, soil_pct real)
language sql stable as $$
  select to_timestamp(floor(extract(epoch from recorded_at) / bucket_seconds) * bucket_seconds),
         avg(temp_c)::real, avg(humidity)::real, avg(soil_pct)::real
  from readings where recorded_at >= since group by 1 order by 1;
$$;

create or replace function daily_stats(days int, tz text)
returns table(day date, avg_temp real, min_temp real, max_temp real, avg_hum real, avg_soil real)
language sql stable as $$
  select (recorded_at at time zone tz)::date,
         avg(temp_c)::real, min(temp_c)::real, max(temp_c)::real,
         avg(humidity)::real, avg(soil_pct)::real
  from readings where recorded_at >= now() - make_interval(days => days)
  group by 1 order by 1;
$$;

revoke all on function readings_bucketed(timestamptz, int) from public, anon, authenticated;
revoke all on function daily_stats(int, text) from public, anon, authenticated;
