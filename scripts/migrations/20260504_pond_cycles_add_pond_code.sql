-- Thêm cột pond_code vào pond_cycles để hiển thị mã ao trong chi tiết chu kỳ
-- Migration: 20260504_pond_cycles_add_pond_code.sql

-- Thêm cột pond_code
alter table public.pond_cycles
  add column if not exists pond_code text;

-- Backfill dữ liệu từ bảng ponds
update public.pond_cycles pc
set pond_code = p.code
from public.ponds p
where p.id = pc.pond_id
  and pc.pond_code is null;

-- Tạo trigger để tự động điền pond_code khi insert/update
create or replace function public.tr_pond_cycles_set_pond_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p_code text;
begin
  if new.pond_id is null then
    raise exception 'pond_id is required';
  end if;
  
  select p.code into p_code
  from public.ponds p
  where p.id = new.pond_id;
  
  if p_code is null then
    raise exception 'Invalid pond_id';
  end if;
  
  new.pond_code := p_code;
  return new;
end;
$$;

drop trigger if exists trg_pond_cycles_set_pond_code on public.pond_cycles;
create trigger trg_pond_cycles_set_pond_code
before insert or update of pond_id on public.pond_cycles
for each row execute function public.tr_pond_cycles_set_pond_code();

-- Tạo trigger để cập nhật pond_code trong pond_cycles khi code trong ponds thay đổi
create or replace function public.tr_ponds_update_cycles_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is distinct from old.code then
    update public.pond_cycles
    set pond_code = new.code
    where pond_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ponds_update_cycles_code on public.ponds;
create trigger trg_ponds_update_cycles_code
after update of code on public.ponds
for each row execute function public.tr_ponds_update_cycles_code();
