-- Bỏ chặn cột “đăng ký gốc” trên ponds: đại lý / chủ hộ đã được RLS giới hạn ao;
-- trigger cũ khiến UI không lưu được kế hoạch ban đầu dù đã mở quyền.

create or replace function public.tr_enforce_pond_plan_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;
