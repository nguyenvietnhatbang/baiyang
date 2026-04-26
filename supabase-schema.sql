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

insert into public.region_codes (code, name, sort_order) values ('17', 'Thái Bình', 1)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- App settings (singleton id = 1): harvest alert window, RLS bypass for dev
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  harvest_alert_days int not null default 7,
  bypass_rls boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_settings (id, harvest_alert_days, bypass_rls) values (1, 7, true)
on conflict (id) do nothing;

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
  address text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (agency_id, household_segment)
);

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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_agency_id on public.profiles(agency_id);
create index if not exists idx_profiles_household_id on public.profiles(household_id);

-- ---------------------------------------------------------------------------
-- Ponds
-- ---------------------------------------------------------------------------
create table if not exists public.ponds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_name text,
  household_id uuid references public.households(id) on update cascade on delete set null,
  season_id uuid references public.seasons(id) on update cascade on delete set null,
  stocking_batch_id uuid references public.stocking_batches(id) on update cascade on delete set null,
  area numeric,
  depth numeric,
  location text,
  agency_code text,
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
  ph_min numeric not null default 6.5,
  ph_max numeric not null default 8.5,
  temp_min numeric not null default 25,
  temp_max numeric not null default 32,
  notes text,
  qr_code text,
  last_medicine_date date,
  withdrawal_days numeric,
  withdrawal_end_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ponds_agency_code_fkey foreign key (agency_code) references public.agencies(code) on update cascade on delete set null,
  constraint ponds_ph_bounds check (ph_min <= ph_max),
  constraint ponds_temp_bounds check (temp_min <= temp_max)
);

create index if not exists idx_ponds_agency_code on public.ponds(agency_code);
create index if not exists idx_ponds_household_id on public.ponds(household_id);
create index if not exists idx_ponds_season_id on public.ponds(season_id);
create index if not exists idx_ponds_stocking_batch_id on public.ponds(stocking_batch_id);
create index if not exists idx_ponds_status on public.ponds(status);
create index if not exists idx_ponds_expected_harvest_date on public.ponds(expected_harvest_date);

-- ---------------------------------------------------------------------------
-- Plan adjustments + audit trail for plan fields
-- ---------------------------------------------------------------------------
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

create index if not exists idx_plan_adjustments_pond_id on public.plan_adjustments(pond_id, created_at desc);

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
  dead_fish numeric not null default 0,
  medicine_used text,
  medicine_dosage text,
  withdrawal_days numeric,
  disease_notes text,
  avg_weight numeric,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.harvest_records (
  id uuid primary key default gen_random_uuid(),
  pond_id uuid not null references public.ponds(id) on delete cascade,
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
create index if not exists idx_harvest_records_pond_id_harvest_date on public.harvest_records(pond_id, harvest_date desc);
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
-- FCR = total_feed_used / sum(harvest actual_yield)
-- ---------------------------------------------------------------------------
create or replace function public.recalc_pond_fcr(p_pond_id uuid)
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
  select coalesce(p.total_feed_used, 0) into feed_total from public.ponds p where p.id = p_pond_id;
  select coalesce(sum(h.actual_yield), 0) into harvest_total from public.harvest_records h where h.pond_id = p_pond_id;
  if harvest_total > 0 then
    f := round((feed_total / harvest_total)::numeric, 4);
  else
    f := null;
  end if;
  update public.ponds set fcr = f where id = p_pond_id;
  return f;
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
    perform public.recalc_pond_fcr(old.pond_id);
    return old;
  end if;
  perform public.recalc_pond_fcr(new.pond_id);
  return new;
end;
$$;

drop trigger if exists trg_harvest_recalc_fcr on public.harvest_records;
create trigger trg_harvest_recalc_fcr
after insert or update of actual_yield or delete on public.harvest_records
for each row execute function public.trg_recalc_fcr_after_harvest();

-- Also recalc when total_feed_used changes on pond (via logs)
create or replace function public.trg_recalc_fcr_after_pond_feed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.total_feed_used is distinct from old.total_feed_used) then
    perform public.recalc_pond_fcr(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pond_feed_recalc_fcr on public.ponds;
create trigger trg_pond_feed_recalc_fcr
after update of total_feed_used on public.ponds
for each row execute function public.trg_recalc_fcr_after_pond_feed();

-- ---------------------------------------------------------------------------
-- Sum feed for pond in date range (for UI aggregates)
-- ---------------------------------------------------------------------------
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
  next_n int;
  max_s int;
begin
  select * into h from public.households where id = p_household_id for update;
  if not found then
    raise exception 'Household % not found', p_household_id;
  end if;
  select * into a from public.agencies where id = h.agency_id;

  prefix := h.region_code || '-' || a.pond_code_segment || '-' || h.household_segment;

  select coalesce(max(
    (regexp_match(p.code, '-(\d+)$'))[1]::int
  ), 0) into max_s
  from public.ponds p
  where p.household_id = p_household_id;

  next_n := max_s + 1;

  return prefix || '-' || lpad(next_n::text, 2, '0');
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
-- Enforce: only admin can update "plan" columns on ponds (when RLS strict)
-- ---------------------------------------------------------------------------
create or replace function public.tr_enforce_pond_plan_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Quyền sửa kế hoạch (cả đăng ký gốc) do RLS ponds_update + ứng dụng; không chặn thêm ở đây.
  return new;
end;
$$;

drop trigger if exists trg_ponds_plan_guard on public.ponds;
create trigger trg_ponds_plan_guard
before update on public.ponds
for each row execute function public.tr_enforce_pond_plan_update();

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
  for all using (public.app_settings_bypass_rls() or public.is_admin() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency' and p.agency_id = households.agency_id
  ))
  with check (public.app_settings_bypass_rls() or public.is_admin() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agency' and p.agency_id = households.agency_id
  ));

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
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'agency'
        and p.agency_id = (select agency_id from public.agencies a where a.code = ponds.agency_code limit 1)
    )
  );

create policy ponds_update on public.ponds
  for update using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'agency'
        and p.agency_id = (select agency_id from public.agencies a where a.code = ponds.agency_code limit 1)
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.household_id = ponds.household_id
    )
  )
  with check (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'agency'
        and p.agency_id = (select agency_id from public.agencies a where a.code = ponds.agency_code limit 1)
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.household_id = ponds.household_id
    )
  );

create policy ponds_delete on public.ponds
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
      select 1 from public.ponds po
      where po.id = plan_adjustments.pond_id
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
        select 1 from public.ponds po join public.profiles pr on pr.id = auth.uid()
        where po.id = pond_id
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
grant execute on function public.recalc_pond_fcr(uuid) to anon, authenticated;
