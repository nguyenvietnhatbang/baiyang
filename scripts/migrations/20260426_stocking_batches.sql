-- Đợt thả cá (stocking batch) trong từng vụ — gán cho ao để lọc báo cáo / nhật ký.
-- Idempotent: chạy lại an toàn.

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

alter table public.ponds
  add column if not exists stocking_batch_id uuid references public.stocking_batches(id) on update cascade on delete set null;

create index if not exists idx_ponds_stocking_batch_id on public.ponds(stocking_batch_id);

drop trigger if exists trg_stocking_batches_updated_at on public.stocking_batches;
create trigger trg_stocking_batches_updated_at
before update on public.stocking_batches
for each row execute procedure public.set_updated_at();

-- RLS (cùng mô hình seasons: mọi user đăng nhập đọc; chỉ admin ghi)
alter table public.stocking_batches enable row level security;

drop policy if exists stocking_batches_select on public.stocking_batches;
drop policy if exists stocking_batches_mutate on public.stocking_batches;

create policy stocking_batches_select on public.stocking_batches
  for select using (
    public.app_settings_bypass_rls()
    or public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid())
  );

create policy stocking_batches_mutate on public.stocking_batches
  for all using (public.app_settings_bypass_rls() or public.is_admin())
  with check (public.app_settings_bypass_rls() or public.is_admin());

-- Một đợt mặc định cho mỗi vụ đang active (và mọi vụ đã có ao) để backfill
insert into public.stocking_batches (season_id, code, name, sort_order)
select s.id, 'D1', 'Đợt mặc định', 0
from public.seasons s
where s.active = true
on conflict (season_id, code) do nothing;

insert into public.stocking_batches (season_id, code, name, sort_order)
select distinct p.season_id, 'D1', 'Đợt mặc định', 0
from public.ponds p
where p.season_id is not null
on conflict (season_id, code) do nothing;

update public.ponds p
set stocking_batch_id = b.id
from public.stocking_batches b
where p.season_id = b.season_id
  and b.code = 'D1'
  and p.stocking_batch_id is null
  and p.season_id is not null;
