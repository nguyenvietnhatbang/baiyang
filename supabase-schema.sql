-- Supabase schema for my-pond-app
-- Run in SQL editor (new project) or apply incrementally on existing DB (see comments).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Region codes (dropdown, single source for pond code prefix)
-- ---------------------------------------------------------------------------
create table if not exists public.region_codes (
  code text primary key,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.region_codes (code, name, sort_order) values ('17', 'Thái Bình', 17)
on conflict (code) do nothing;
-- Danh mục đầy đủ (mã biển số): scripts/restore_region_codes_vietnam.sql hoặc migrations 20260426 / 20260502.

-- ---------------------------------------------------------------------------
-- App settings (singleton id = 1): harvest alert window, RLS bypass for dev
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  harvest_alert_days int not null default 7,
  -- Kế hoạch nhà máy theo tháng (kg). Lưu dạng mảng 12 phần tử [T1..T12]
  factory_plan_kg_by_month jsonb not null default '[]'::jsonb,
  bypass_rls boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_settings (id, harvest_alert_days, bypass_rls) values (1, 7, true)
on conflict (id) do nothing;

alter table public.app_settings
  add column if not exists factory_plan_kg_by_month jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Seasons / vụ
-- ---------------------------------------------------------------------------
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

alter table public.seasons
  add column if not exists sort_order int not null default 0;

-- ---------------------------------------------------------------------------
-- Stocking batches / đợt thả (trong một vụ)
-- ---------------------------------------------------------------------------
create table if not exists public.stocking_batches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on update cascade on delete cascade,
  code text not null,
  name text not null,
  stock_reference_date date,
  sort_order int not null default 0,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (season_id, code)
);

create index if not exists idx_stocking_batches_season_id on public.stocking_batches(season_id);

-- ---------------------------------------------------------------------------
-- Agencies (add pond_code_segment for composite pond codes)
-- ---------------------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  phone text,
  address text,
  region text,
  region_code text references public.region_codes(code) on update cascade on delete set null,
  pond_code_segment text not null default '01',
  total_ponds numeric,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Households (hộ nuôi)
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on update cascade on delete restrict,
  region_code text not null references public.region_codes(code) on update cascade on delete restrict,
  household_segment text not null,
  name text not null,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (agency_id, household_segment)
);

alter table if exists public.households
  add column if not exists phone text;

create index if not exists idx_households_agency_id on public.households(agency_id);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 auth.users — role + data scope)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'household_owner' check (role in ('admin', 'agency', 'household_owner')),
  agency_id uuid references public.agencies(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  display_name text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_agency_id on public.profiles(agency_id);
create index if not exists idx_profiles_household_id on public.profiles(household_id);
create unique index if not exists idx_profiles_phone_unique on public.profiles (phone) where phone is not null;

-- ---------------------------------------------------------------------------
-- Ponds (ao vật lý)
-- ---------------------------------------------------------------------------
create table if not exists public.ponds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_name text,
  household_id uuid references public.households(id) on update cascade on delete set null,
  area numeric,
  depth numeric,
  location text,
  agency_code text,
  ph_min numeric not null default 6.5,
  ph_max numeric not null default 8.5,
  temp_min numeric not null default 25,
  temp_max numeric not null default 32,
  qr_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ponds_agency_code_fkey foreign key (agency_code) references public.agencies(code) on update cascade on delete set null,
  constraint ponds_ph_bounds check (ph_min <= ph_max),
  constraint ponds_temp_bounds check (temp_min <= temp_max)
);

create index if not exists idx_ponds_agency_code on public.ponds(agency_code);
create index if not exists idx_ponds_household_id on public.ponds(household_id);

-- ---------------------------------------------------------------------------
-- Pond cycles (chu kỳ thả / kế hoạch trên ao)
-- ---------------------------------------------------------------------------
create table if not exists public.pond_cycles (
  id uuid primary key default gen_random_uuid(),
  pond_id uuid not null references public.ponds(id) on update cascade on delete cascade,
  season_id uuid references public.seasons(id) on update cascade on delete set null,
  stocking_batch_id uuid references public.stocking_batches(id) on update cascade on delete set null,
  status text not null default 'CT' check (status in ('CC', 'CT')),
  stock_date date,
  total_fish numeric,
  current_fish numeric,
  seed_size numeric,
  seed_weight numeric,
  density numeric,
  survival_rate numeric,
  target_weight numeric,
  expected_harvest_date date,
  initial_plan_locked boolean not null default false,
  initial_expected_harvest_date date,
  expected_yield numeric,
  actual_yield numeric,
  harvest_done boolean not null default false,
  total_feed_used numeric,
  fcr numeric,
  last_medicine_date date,
  withdrawal_days numeric,
  withdrawal_end_date date,
  notes text,
  name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_pond_cycles_pond_id on public.pond_cycles(pond_id);
create index if not exists idx_pond_cycles_season_id on public.pond_cycles(season_id);
create index if not exists idx_pond_cycles_stocking_batch_id on public.pond_cycles(stocking_batch_id);
create index if not exists idx_pond_cycles_status on public.pond_cycles(status);

create unique index if not exists idx_pond_cycles_one_cc_per_pond
  on public.pond_cycles(pond_id)
  where status = 'CC';

-- ---------------------------------------------------------------------------
-- Plan adjustments (theo chu kỳ)
-- ---------------------------------------------------------------------------
create table if not exists public.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  pond_cycle_id uuid not null references public.pond_cycles(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('auto_loss', 'manual_admin', 'manual_company')),
  field_name text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_plan_adjustments_pond_cycle_id on public.plan_adjustments(pond_cycle_id, created_at desc);

insert into public.seasons (code, name, active)
values ('VU-2026-1', 'Vụ 2026 — lứa 1', true)
on conflict (code) do nothing;

insert into public.stocking_batches (season_id, code, name, sort_order)
select id, 'D1', 'Đợt mặc định', 0
from public.seasons
where code = 'VU-2026-1'
on conflict (season_id, code) do nothing;

create table if not exists public.pond_logs (
  id uuid primary key default gen_random_uuid(),
  pond_id uuid not null references public.ponds(id) on delete cascade,
  pond_cycle_id uuid not null references public.pond_cycles(id) on update cascade on delete cascade,
  pond_code text,
  log_date date not null,
  ph numeric,
  temperature numeric,
  "do" numeric,
  nh3 numeric,
  no2 numeric,
  h2s numeric,
  water_color text,
  feed_code text,
  feed_amount numeric,
  stocked_fish numeric not null default 0,
  dead_fish numeric not null default 0,
  medicine_used text,
  medicine_dosage text,
  withdrawal_days numeric,
  disease_notes text,
  avg_weight numeric,
  growth_g numeric,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.pond_logs
  add column if not exists stocked_fish numeric not null default 0;

alter table if exists public.pond_logs
  add column if not exists growth_g numeric;

create table if not exists public.harvest_records (
  id uuid primary key default gen_random_uuid(),
  pond_id uuid not null references public.ponds(id) on delete cascade,
  pond_cycle_id uuid not null references public.pond_cycles(id) on update cascade on delete cascade,
  pond_code text,
  owner_name text,
  agency_code text,
  harvest_date date not null,
  planned_yield numeric,
  actual_yield numeric,
  fish_count_harvested numeric,
  avg_weight_harvest numeric,
  dead_fish_count numeric,
  reject_fish_count numeric,
  sick_yellow_fish numeric,
  thin_fish numeric,
  stomach_ratio numeric,
  water_quality_ok boolean,
  antibiotic_residue_ok boolean,
  heavy_metal_ok boolean,
  pesticide_ok boolean,
  action_taken text check (action_taken in ('approved', 'reject_load', 'deduct_weight', 'deduct_price')),
  price_per_kg numeric,
  total_value numeric,
  lot_code text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_pond_logs_pond_id_log_date on public.pond_logs(pond_id, log_date desc);
create index if not exists idx_pond_logs_pond_cycle_id on public.pond_logs(pond_cycle_id);
create index if not exists idx_harvest_records_pond_id_harvest_date on public.harvest_records(pond_id, harvest_date desc);
create index if not exists idx_harvest_records_pond_cycle_id on public.harvest_records(pond_cycle_id);
create index if not exists idx_harvest_records_agency_code on public.harvest_records(agency_code);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_agencies_updated_at on public.agencies;
create trigger trg_agencies_updated_at
before update on public.agencies
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_households_updated_at on public.households;
create trigger trg_households_updated_at
before update on public.households
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_seasons_updated_at on public.seasons;
create trigger trg_seasons_updated_at
before update on public.seasons
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_stocking_batches_updated_at on public.stocking_batches;
create trigger trg_stocking_batches_updated_at
before update on public.stocking_batches
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_ponds_updated_at on public.ponds;
create trigger trg_ponds_updated_at
before update on public.ponds
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_pond_cycles_updated_at on public.pond_cycles;
create trigger trg_pond_cycles_updated_at
before update on public.pond_cycles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_pond_logs_updated_at on public.pond_logs;
create trigger trg_pond_logs_updated_at
before update on public.pond_logs
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_harvest_records_updated_at on public.harvest_records;
create trigger trg_harvest_records_updated_at
before update on public.harvest_records
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- FCR theo chu kỳ: total_feed_used / sum(harvest actual_yield)
-- ---------------------------------------------------------------------------
create or replace function public.recalc_pond_cycle_fcr(p_pond_cycle_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  feed_total numeric;
  harvest_total numeric;
  f numeric;
begin
  select coalesce(c.total_feed_used, 0) into feed_total
  from public.pond_cycles c where c.id = p_pond_cycle_id;
  select coalesce(sum(h.actual_yield), 0) into harvest_total
  from public.harvest_records h
  where h.pond_cycle_id = p_pond_cycle_id;
  if harvest_total > 0 then
    f := round((feed_total / harvest_total)::numeric, 4);
  else
    f := null;
  end if;
  update public.pond_cycles set fcr = f where id = p_pond_cycle_id;
  return f;
end;
$$;

create or replace function public.recalc_pond_fcr(p_pond_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  select c.id into cid
  from public.pond_cycles c
  where c.pond_id = p_pond_id and c.status = 'CC'
  limit 1;
  if cid is null then
    select c2.id into cid
    from public.pond_cycles c2
    where c2.pond_id = p_pond_id
    order by c2.updated_at desc nulls last
    limit 1;
  end if;
  if cid is null then
    return null;
  end if;
  return public.recalc_pond_cycle_fcr(cid);
end;
$$;

create or replace function public.trg_recalc_fcr_after_harvest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.pond_cycle_id is not null then
      perform public.recalc_pond_cycle_fcr(old.pond_cycle_id);
    end if;
    return old;
  end if;
  if new.pond_cycle_id is not null then
    perform public.recalc_pond_cycle_fcr(new.pond_cycle_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_harvest_recalc_fcr on public.harvest_records;
create trigger trg_harvest_recalc_fcr
after insert or update of actual_yield or delete on public.harvest_records
for each row execute function public.trg_recalc_fcr_after_harvest();

create or replace function public.trg_recalc_fcr_after_cycle_feed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.total_feed_used is distinct from old.total_feed_used) then
    perform public.recalc_pond_cycle_fcr(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pond_feed_recalc_fcr on public.ponds;
drop trigger if exists trg_pond_cycle_feed_recalc_fcr on public.pond_cycles;
create trigger trg_pond_cycle_feed_recalc_fcr
after update of total_feed_used on public.pond_cycles
for each row execute function public.trg_recalc_fcr_after_cycle_feed();

-- ---------------------------------------------------------------------------
-- Sum feed: theo ao (mọi chu kỳ) hoặc theo một chu kỳ
-- ---------------------------------------------------------------------------
create or replace function public.sum_pond_cycle_feed(p_pond_cycle_id uuid, p_from date, p_to date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(l.feed_amount), 0)::numeric
  from public.pond_logs l
  where l.pond_cycle_id = p_pond_cycle_id
    and l.log_date >= p_from
    and l.log_date <= p_to;
$$;

create or replace function public.sum_pond_feed(p_pond_id uuid, p_from date, p_to date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(l.feed_amount), 0)::numeric
  from public.pond_logs l
  where l.pond_id = p_pond_id
    and l.log_date >= p_from
    and l.log_date <= p_to;
$$;

-- Đồng bộ pond_id từ pond_cycle_id
create or replace function public.tr_pond_logs_set_pond_from_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if new.pond_cycle_id is null then
    raise exception 'pond_cycle_id is required';
  end if;
  select c.pond_id into pid from public.pond_cycles c where c.id = new.pond_cycle_id;
  if pid is null then
    raise exception 'Invalid pond_cycle_id';
  end if;
  new.pond_id := pid;
  return new;
end;
$$;

drop trigger if exists trg_pond_logs_pond_from_cycle on public.pond_logs;
create trigger trg_pond_logs_pond_from_cycle
before insert or update of pond_cycle_id on public.pond_logs
for each row execute function public.tr_pond_logs_set_pond_from_cycle();

create or replace function public.tr_harvest_records_set_pond_from_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if new.pond_cycle_id is null then
    raise exception 'pond_cycle_id is required';
  end if;
  select c.pond_id into pid from public.pond_cycles c where c.id = new.pond_cycle_id;
  if pid is null then
    raise exception 'Invalid pond_cycle_id';
  end if;
  new.pond_id := pid;
  return new;
end;
$$;

drop trigger if exists trg_harvest_records_pond_from_cycle on public.harvest_records;
create trigger trg_harvest_records_pond_from_cycle
before insert or update of pond_cycle_id on public.harvest_records
for each row execute function public.tr_harvest_records_set_pond_from_cycle();

create or replace function public.tr_pond_cycles_demote_other_cc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'CC' then
    update public.pond_cycles c
    set status = 'CT'
    where c.pond_id = new.pond_id
      and c.id is distinct from new.id
      and c.status = 'CC';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pond_cycles_single_cc on public.pond_cycles;
create trigger trg_pond_cycles_single_cc
before insert or update of status on public.pond_cycles
for each row
when (new.status = 'CC')
execute function public.tr_pond_cycles_demote_other_cc();

create or replace function public.tr_pond_cycles_touch_pond()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ponds p
  set updated_at = timezone('utc', now())
  where p.id = new.pond_id;
  return new;
end;
$$;

drop trigger if exists trg_pond_cycles_touch_pond on public.pond_cycles;
create trigger trg_pond_cycles_touch_pond
after insert or update on public.pond_cycles
for each row execute function public.tr_pond_cycles_touch_pond();

-- ---------------------------------------------------------------------------
-- Next pond code: region-agency_segment-household_segment-NN (seq per household)
-- ---------------------------------------------------------------------------
create or replace function public.next_pond_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  a record;
  prefix text;
  system_seg text;
  next_n int;
  max_s int;
begin
  select * into h from public.households where id = p_household_id for update;
  if not found then
    raise exception 'Household % not found', p_household_id;
  end if;
  select * into a from public.agencies where id = h.agency_id;

  -- Format yêu cầu: Mã tỉnh - Mã hệ thống - Mã hộ nuôi - Mã ao nuôi
  -- Ở hệ thống này: "Mã hệ thống" = agencies.code (ví dụ 09), KHÔNG phải pond_code_segment.
  system_seg := lpad(regexp_replace(coalesce(a.code, ''), '\D', '', 'g'), 2, '0');
  if system_seg = '' then
    raise exception 'Agency code not set for household %', p_household_id;
  end if;
  prefix := h.region_code || '-' || system_seg || '-' || h.household_segment;

  select coalesce(max(
    (regexp_match(p.code, '-(\d+)$'))[1]::int
  ), 0) into max_s
  from public.ponds p
  where p.household_id = p_household_id;

  next_n := max_s + 1;

  return prefix || '-' || lpad(next_n::text, 2, '0');
end;
$$;

create or replace function public.create_pond_with_initial_cycle(
  p_code text,
  p_household_id uuid,
  p_owner_name text,
  p_agency_code text,
  p_area numeric,
  p_depth numeric,
  p_location text,
  p_ph_min numeric,
  p_ph_max numeric,
  p_temp_min numeric,
  p_temp_max numeric,
  p_qr_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pond_uuid uuid;
begin
  insert into public.ponds (
    code, household_id, owner_name, agency_code, area, depth, location,
    ph_min, ph_max, temp_min, temp_max, qr_code
  ) values (
    p_code, p_household_id, p_owner_name, p_agency_code, p_area, p_depth, p_location,
    p_ph_min, p_ph_max, p_temp_min, p_temp_max, p_qr_code
  )
  returning id into pond_uuid;

  insert into public.pond_cycles (pond_id, status)
  values (pond_uuid, 'CT');

  return pond_uuid;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.app_settings_bypass_rls()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select bypass_rls from public.app_settings where id = 1), true);
$$;

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Enforce: chỉ admin sửa đăng ký gốc trên pond_cycles (khi không bypass)
-- ---------------------------------------------------------------------------
create or replace function public.tr_enforce_pond_cycle_plan_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bypass boolean;
  adm boolean;
begin
  select public.app_settings_bypass_rls() into bypass;
  if bypass then
    return new;
  end if;
  select public.is_admin() into adm;
  if adm then
    return new;
  end if;

  if (new.stock_date is distinct from old.stock_date)
     or (new.total_fish is distinct from old.total_fish)
     or (new.survival_rate is distinct from old.survival_rate)
     or (new.target_weight is distinct from old.target_weight)
     or (new.seed_size is distinct from old.seed_size)
     or (new.seed_weight is distinct from old.seed_weight)
     or (new.density is distinct from old.density)
     or (new.initial_plan_locked is distinct from old.initial_plan_locked)
     or (new.initial_expected_harvest_date is distinct from old.initial_expected_harvest_date)
     or (new.season_id is distinct from old.season_id)
     or (new.stocking_batch_id is distinct from old.stocking_batch_id)
  then
    raise exception 'Chỉ admin được sửa đăng ký / chỉ tiêu thả gốc. Đại lý và chủ hộ chỉ cập nhật kế hoạch điều chỉnh (số cá hiện tại, SL mục tiêu, ngày thu điều chỉnh).';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ponds_plan_guard on public.ponds;
drop trigger if exists trg_pond_cycles_plan_guard on public.pond_cycles;
create trigger trg_pond_cycles_plan_guard
before update on public.pond_cycles
for each row execute function public.tr_enforce_pond_cycle_plan_update();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.region_codes enable row level security;
alter table public.app_settings enable row level security;
alter table public.seasons enable row level security;
alter table public.stocking_batches enable row level security;
alter table public.agencies enable row level security;
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.ponds enable row level security;
alter table public.pond_cycles enable row level security;
alter table public.pond_logs enable row level security;
alter table public.harvest_records enable row level security;
alter table public.plan_adjustments enable row level security;

-- Idempotent policy refresh (safe to re-run)
drop policy if exists region_codes_all on public.region_codes;
drop policy if exists app_settings_read on public.app_settings;
drop policy if exists app_settings_update on public.app_settings;
drop policy if exists seasons_select on public.seasons;
drop policy if exists seasons_mutate on public.seasons;
drop policy if exists stocking_batches_select on public.stocking_batches;
drop policy if exists stocking_batches_mutate on public.stocking_batches;
drop policy if exists agencies_select on public.agencies;
drop policy if exists agencies_mutate on public.agencies;
drop policy if exists households_select on public.households;
drop policy if exists households_mutate on public.households;
drop policy if exists profiles_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists ponds_select on public.ponds;
drop policy if exists ponds_insert on public.ponds;
drop policy if exists ponds_update on public.ponds;
drop policy if exists ponds_delete on public.ponds;
drop policy if exists pond_cycles_select on public.pond_cycles;
drop policy if exists pond_cycles_insert on public.pond_cycles;
drop policy if exists pond_cycles_update on public.pond_cycles;
drop policy if exists pond_cycles_delete on public.pond_cycles;
drop policy if exists pond_logs_all on public.pond_logs;
drop policy if exists harvest_records_all on public.harvest_records;
drop policy if exists plan_adjustments_select on public.plan_adjustments;
drop policy if exists plan_adjustments_insert on public.plan_adjustments;

create policy region_codes_all on public.region_codes
  for all using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  )
  with check (public.app_settings_bypass_rls() or public.is_admin());

create policy app_settings_read on public.app_settings
  for select using (true);

create policy app_settings_update on public.app_settings
  for update using (public.app_settings_bypass_rls() or public.is_admin())
  with check (public.app_settings_bypass_rls() or public.is_admin());

create policy seasons_select on public.seasons
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

create policy seasons_mutate on public.seasons
  for all using (public.app_settings_bypass_rls() or public.is_admin())
  with check (public.app_settings_bypass_rls() or public.is_admin());

create policy stocking_batches_select on public.stocking_batches
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

create policy stocking_batches_mutate on public.stocking_batches
  for all using (public.app_settings_bypass_rls() or public.is_admin())
  with check (public.app_settings_bypass_rls() or public.is_admin());

create policy agencies_select on public.agencies
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency' and p.agency_id = agencies.id)
    or exists (
      select 1 from public.profiles p
      inner join public.households h on h.id = p.household_id
      where p.id = auth.uid() and h.agency_id = agencies.id
    )
  );

create policy agencies_mutate on public.agencies
  for all using (public.app_settings_bypass_rls() or public.is_admin())
  with check (public.app_settings_bypass_rls() or public.is_admin());

create policy households_select on public.households
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency' and p.agency_id = households.agency_id)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.household_id = households.id)
  );

create policy households_mutate on public.households
  for all using (public.app_settings_bypass_rls() or public.is_admin())
  with check (public.app_settings_bypass_rls() or public.is_admin());

create policy profiles_own on public.profiles
  for select using (public.app_settings_bypass_rls() or id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (public.app_settings_bypass_rls() or public.is_admin())
  with check (public.app_settings_bypass_rls() or public.is_admin());

create policy profiles_insert on public.profiles
  for insert with check (public.app_settings_bypass_rls() or public.is_admin() or id = auth.uid());

create policy ponds_select on public.ponds
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'agency'
        and p.agency_id = (select agency_id from public.agencies a where a.code = ponds.agency_code limit 1)
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.household_id is not null and p.household_id = ponds.household_id
    )
  );

create policy ponds_insert on public.ponds
  for insert with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
  );

create policy ponds_update on public.ponds
  for update using (
    public.app_settings_bypass_rls()
    or public.is_admin()
  )
  with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
  );

create policy ponds_delete on public.ponds
  for delete using (public.app_settings_bypass_rls() or public.is_admin());

create policy pond_cycles_select on public.pond_cycles
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.ponds po
      where po.id = pond_cycles.pond_id
        and (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'agency'
              and p.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
          )
          or exists (
            select 1 from public.profiles p2
            where p2.id = auth.uid() and p2.household_id is not null and p2.household_id = po.household_id
          )
        )
    )
  );

create policy pond_cycles_insert on public.pond_cycles
  for insert with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
  );

create policy pond_cycles_update on public.pond_cycles
  for update using (
    public.app_settings_bypass_rls()
    or public.is_admin()
  )
  with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
  );

create policy pond_cycles_delete on public.pond_cycles
  for delete using (public.app_settings_bypass_rls() or public.is_admin());

create policy pond_logs_all on public.pond_logs
  for all using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.ponds po join public.profiles pr on pr.id = auth.uid()
      where po.id = pond_logs.pond_id
        and (
          pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
          or pr.household_id = po.household_id
        )
    )
  )
  with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.ponds po join public.profiles pr on pr.id = auth.uid()
      where po.id = pond_logs.pond_id
        and (
          pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
          or pr.household_id = po.household_id
        )
    )
  );

create policy harvest_records_all on public.harvest_records
  for all using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.ponds po join public.profiles pr on pr.id = auth.uid()
      where po.id = harvest_records.pond_id
        and (
          pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
          or pr.household_id = po.household_id
        )
    )
  )
  with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.ponds po join public.profiles pr on pr.id = auth.uid()
      where po.id = harvest_records.pond_id
        and (
          pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
          or pr.household_id = po.household_id
        )
    )
  );

create policy plan_adjustments_select on public.plan_adjustments
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.pond_cycles pc
      join public.ponds po on po.id = pc.pond_id
      where pc.id = plan_adjustments.pond_cycle_id
        and exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid()
            and (
              (pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1))
              or pr.household_id = po.household_id
            )
        )
    )
  );

create policy plan_adjustments_insert on public.plan_adjustments
  for insert with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or (
      adjustment_type = 'auto_loss'
      and exists (
        select 1 from public.pond_cycles pc
        join public.ponds po on po.id = pc.pond_id
        join public.profiles pr on pr.id = auth.uid()
        where pc.id = pond_cycle_id
          and (
            pr.role = 'agency' and pr.agency_id = (select agency_id from public.agencies a where a.code = po.agency_code limit 1)
            or pr.household_id = po.household_id
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Auth: new user profile stub (adjust role in SQL dashboard)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'household_owner', coalesce(new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RPC exposed to anon (Supabase Data API)
grant execute on function public.next_pond_code(uuid) to anon, authenticated;
grant execute on function public.sum_pond_feed(uuid, date, date) to anon, authenticated;
grant execute on function public.sum_pond_cycle_feed(uuid, date, date) to anon, authenticated;
grant execute on function public.recalc_pond_fcr(uuid) to anon, authenticated;
grant execute on function public.recalc_pond_cycle_fcr(uuid) to anon, authenticated;
grant execute on function public.create_pond_with_initial_cycle(
  text, uuid, text, text, numeric, numeric, text, numeric, numeric, numeric, numeric, text
) to anon, authenticated;
