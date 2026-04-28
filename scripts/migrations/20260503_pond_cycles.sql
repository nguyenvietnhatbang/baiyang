-- Ao vật lý (ponds) + chu kỳ thả (pond_cycles). Idempotent where practical.
-- Chạy xong: cập nhật app; sau đó chạy 20260503_pond_cycles_drop_legacy_pond_columns.sql

-- ---------------------------------------------------------------------------
-- 1) Bảng chu kỳ
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

-- Tối đa một chu kỳ CC / ao
create unique index if not exists idx_pond_cycles_one_cc_per_pond
  on public.pond_cycles(pond_id)
  where status = 'CC';

drop trigger if exists trg_pond_cycles_updated_at on public.pond_cycles;
create trigger trg_pond_cycles_updated_at
before update on public.pond_cycles
for each row execute function public.set_updated_at();

-- Trước khi ghi CC: hạ các chu kỳ CC khác cùng ao (tránh vi phạm unique index)
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

-- ---------------------------------------------------------------------------
-- 2) Backfill: một chu kỳ / ao hiện có (chỉ khi bảng pond_cycles còn trống cho ao đó)
-- ---------------------------------------------------------------------------
insert into public.pond_cycles (
  pond_id,
  season_id,
  stocking_batch_id,
  status,
  stock_date,
  total_fish,
  current_fish,
  seed_size,
  seed_weight,
  density,
  survival_rate,
  target_weight,
  expected_harvest_date,
  initial_plan_locked,
  initial_expected_harvest_date,
  expected_yield,
  actual_yield,
  harvest_done,
  total_feed_used,
  fcr,
  last_medicine_date,
  withdrawal_days,
  withdrawal_end_date,
  notes
)
select
  p.id,
  p.season_id,
  p.stocking_batch_id,
  p.status,
  p.stock_date,
  p.total_fish,
  p.current_fish,
  p.seed_size,
  p.seed_weight,
  p.density,
  p.survival_rate,
  p.target_weight,
  p.expected_harvest_date,
  coalesce(p.initial_plan_locked, false),
  p.initial_expected_harvest_date,
  p.expected_yield,
  p.actual_yield,
  coalesce(p.harvest_done, false),
  p.total_feed_used,
  p.fcr,
  p.last_medicine_date,
  p.withdrawal_days,
  p.withdrawal_end_date,
  p.notes
from public.ponds p
where not exists (select 1 from public.pond_cycles c where c.pond_id = p.id);

-- ---------------------------------------------------------------------------
-- 3) pond_logs / harvest_records: pond_cycle_id
-- ---------------------------------------------------------------------------
alter table public.pond_logs
  add column if not exists pond_cycle_id uuid references public.pond_cycles(id) on update cascade on delete cascade;

alter table public.harvest_records
  add column if not exists pond_cycle_id uuid references public.pond_cycles(id) on update cascade on delete cascade;

update public.pond_logs l
set pond_cycle_id = c.id
from public.pond_cycles c
where c.pond_id = l.pond_id
  and l.pond_cycle_id is null;

update public.harvest_records h
set pond_cycle_id = c.id
from public.pond_cycles c
where c.pond_id = h.pond_id
  and h.pond_cycle_id is null;

alter table public.pond_logs alter column pond_cycle_id set not null;
alter table public.harvest_records alter column pond_cycle_id set not null;

create index if not exists idx_pond_logs_pond_cycle_id on public.pond_logs(pond_cycle_id);
create index if not exists idx_harvest_records_pond_cycle_id on public.harvest_records(pond_cycle_id);

-- Đồng bộ pond_id từ chu kỳ khi ghi nhật ký / thu hoạch
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

-- ---------------------------------------------------------------------------
-- 4) plan_adjustments → pond_cycle_id
-- ---------------------------------------------------------------------------
alter table public.plan_adjustments
  add column if not exists pond_cycle_id uuid references public.pond_cycles(id) on update cascade on delete cascade;

update public.plan_adjustments pa
set pond_cycle_id = c.id
from public.pond_cycles c
where c.pond_id = pa.pond_id
  and pa.pond_cycle_id is null;

-- Nếu vẫn null (dữ liệu lạ), gán chu kỳ đầu tiên của ao
update public.plan_adjustments pa
set pond_cycle_id = (
  select c2.id from public.pond_cycles c2
  where c2.pond_id = pa.pond_id
  order by c2.created_at asc
  limit 1
)
where pa.pond_cycle_id is null;

alter table public.plan_adjustments alter column pond_cycle_id set not null;

-- Policies may still reference pond_id; replace them before dropping the column
drop policy if exists plan_adjustments_select on public.plan_adjustments;
drop policy if exists plan_adjustments_insert on public.plan_adjustments;

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

alter table public.plan_adjustments drop constraint if exists plan_adjustments_pond_id_fkey;
alter table public.plan_adjustments drop column if exists pond_id;

create index if not exists idx_plan_adjustments_pond_cycle_id on public.plan_adjustments(pond_cycle_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) FCR theo chu kỳ
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

-- Giữ hàm cũ (pond_id) — tính trên chu kỳ CC của ao, hoặc chu kỳ mới nhất
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

drop trigger if exists trg_pond_feed_recalc_fcr on public.ponds;
drop trigger if exists trg_pond_cycle_feed_recalc_fcr on public.pond_cycles;

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

create trigger trg_pond_cycle_feed_recalc_fcr
after update of total_feed_used on public.pond_cycles
for each row execute function public.trg_recalc_fcr_after_cycle_feed();

-- ---------------------------------------------------------------------------
-- 6) sum_pond_feed theo chu kỳ (+ overload theo pond_id = mọi log của ao — legacy)
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

-- ---------------------------------------------------------------------------
-- 7) Trigger bảo vệ đăng ký gốc trên pond_cycles (giốt ponds cũ)
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

drop trigger if exists trg_pond_cycles_plan_guard on public.pond_cycles;
create trigger trg_pond_cycles_plan_guard
before update on public.pond_cycles
for each row execute function public.tr_enforce_pond_cycle_plan_update();

-- Bỏ trigger kế hoạch trên ponds (cột sẽ bỏ ở migration sau)
drop trigger if exists trg_ponds_plan_guard on public.ponds;

-- ---------------------------------------------------------------------------
-- 8) RLS pond_cycles
-- ---------------------------------------------------------------------------
alter table public.pond_cycles enable row level security;

drop policy if exists pond_cycles_select on public.pond_cycles;
drop policy if exists pond_cycles_insert on public.pond_cycles;
drop policy if exists pond_cycles_update on public.pond_cycles;
drop policy if exists pond_cycles_delete on public.pond_cycles;

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
            where p2.id = auth.uid() and p2.household_id = po.household_id
          )
        )
    )
  );

create policy pond_cycles_update on public.pond_cycles
  for update using (
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
            where p2.id = auth.uid() and p2.household_id = po.household_id
          )
        )
    )
  )
  with check (
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
            where p2.id = auth.uid() and p2.household_id = po.household_id
          )
        )
    )
  );

create policy pond_cycles_delete on public.pond_cycles
  for delete using (public.app_settings_bypass_rls() or public.is_admin());

-- plan_adjustments RLS (pond_cycle_id) is applied in section 4 before pond_id is dropped

-- ---------------------------------------------------------------------------
-- 9) RPC: tạo ao + chu kỳ đầu (CT)
-- ---------------------------------------------------------------------------
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

grant execute on function public.create_pond_with_initial_cycle(
  text, uuid, text, text, numeric, numeric, text, numeric, numeric, numeric, numeric, text
) to anon, authenticated;

grant execute on function public.recalc_pond_cycle_fcr(uuid) to anon, authenticated;
grant execute on function public.sum_pond_cycle_feed(uuid, date, date) to anon, authenticated;

-- Cập nhật mốc ponds.updated_at khi chu kỳ đổi (sắp xếp danh sách ao)
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
