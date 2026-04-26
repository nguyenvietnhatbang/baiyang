-- Kế hoạch ban đầu: khóa sau khi lưu; ngày thu gốc tách với ngày thu điều chỉnh.
alter table public.ponds
  add column if not exists initial_plan_locked boolean not null default false;

alter table public.ponds
  add column if not exists initial_expected_harvest_date date;

-- Dữ liệu cũ: coi như đã khóa KH gốc nếu đã có thả cá; đồng bộ ngày thu gốc.
update public.ponds
set initial_plan_locked = true
where initial_plan_locked = false
  and (total_fish is not null and total_fish > 0);

update public.ponds
set initial_expected_harvest_date = expected_harvest_date
where initial_expected_harvest_date is null
  and expected_harvest_date is not null;

comment on column public.ponds.initial_plan_locked is 'true: không sửa chỉ tiêu thả/đăng ký ban đầu từ UI';
comment on column public.ponds.initial_expected_harvest_date is 'Ngày thu hoạch dự kiến lúc đăng ký gốc (báo cáo KH ban đầu theo tháng)';
