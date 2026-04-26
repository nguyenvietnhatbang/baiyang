-- Apply on an existing DB that already had the pre–Pha-1 schema (agencies/ponds without new columns).
-- Run after backing up. Order matters: create referenced tables before FKs.

create extension if not exists pgcrypto;

-- Core new tables (safe if already exist — use supabase-schema.sql for full DDL)
-- If you already ran the full supabase-schema.sql, skip this file.

alter table public.agencies add column if not exists pond_code_segment text not null default '01';

create table if not exists public.region_codes (
  code text primary key,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);
insert into public.region_codes (code, name, sort_order) values ('17', 'Thái Bình', 1)
on conflict (code) do nothing;

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  harvest_alert_days int not null default 7,
  bypass_rls boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.app_settings (id, harvest_alert_days, bypass_rls) values (1, 7, true)
on conflict (id) do nothing;

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  start_date date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on update cascade on delete restrict,
  region_code text not null references public.region_codes(code) on update cascade on delete restrict,
  household_segment text not null,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (agency_id, household_segment)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'household_owner' check (role in ('admin', 'agency', 'household_owner')),
  agency_id uuid references public.agencies(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  pond_id uuid not null references public.ponds(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('auto_loss', 'manual_admin', 'manual_company')),
  field_name text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.ponds add column if not exists household_id uuid references public.households(id) on update cascade on delete set null;
alter table public.ponds add column if not exists season_id uuid references public.seasons(id) on update cascade on delete set null;
alter table public.ponds alter column owner_name drop not null;

-- Then run the remainder of supabase-schema.sql (functions, triggers, RLS, grants) if not applied yet.
