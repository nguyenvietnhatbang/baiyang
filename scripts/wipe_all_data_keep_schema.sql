-- Xóa toàn bộ dữ liệu nghiệp vụ, GIỮ NGUYÊN cấu trúc bảng + function/trigger.
-- GIỮ tài khoản admin: user có public.profiles.role = 'admin' không bị xóa khỏi auth.users.
-- Xóa các user còn lại (đại lý/văn phòng/hộ qua Auth) + profiles đi kèm (CASCADE).
-- Tài khoản hiện trường (field_accounts) luôn bị xóa hết.
--
-- Chạy: Supabase Dashboard → SQL Editor.
-- Nếu không còn admin nào trong DB, không có dòng nào được “giữ” — nên tạo admin trước hoặc bỏ qua khối DELETE.

begin;

-- Gỡ liên kết profile → đại lý/hộ để truncate agencies/households không lỗi (admin vẫn đăng nhập được).
update public.profiles
set agency_id = null,
    household_id = null;

delete from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
    and trim(lower(p.role::text)) = 'admin'
);

truncate table
  public.plan_adjustments,
  public.pond_logs,
  public.harvest_records,
  public.pond_cycles,
  public.ponds,
  public.field_accounts,
  public.households,
  public.agencies,
  public.stocking_batches,
  public.seasons,
  public.region_codes,
  public.app_settings
restart identity cascade;

-- Tối thiểu để app không lỗi (bỏ 2 insert nếu muốn reference trống).
insert into public.app_settings (id, harvest_alert_days, bypass_rls)
values (1, 7, true)
on conflict (id) do update set
  harvest_alert_days = excluded.harvest_alert_days,
  bypass_rls = excluded.bypass_rls,
  updated_at = timezone('utc', now());

insert into public.region_codes (code, name, sort_order) values
  ('17', 'Thái Bình', 17),
  ('30', 'Hà Nội', 30)
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

commit;
