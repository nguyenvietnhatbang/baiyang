-- Xóa sạch dữ liệu nghiệp vụ (ao, hộ, đại lý, nhật ký, thu hoạch, vụ…).
-- Chạy trong Supabase → SQL Editor. KHÔNG xóa: region_codes, app_settings.
--
-- Lưu ý:
-- - Tài khoản Auth (auth.users) KHÔNG bị đụng — chỉ gỡ liên kết profile ↔ đại lý/hộ (mục A).
-- - Nếu dùng mục B (xóa profiles), user vẫn đăng nhập được nhưng có thể thiếu dòng profile → cần seed/trigger lại.

begin;

-- A) Gỡ FK profile → đại lý / hộ (để truncate agencies/households không lỗi)
update public.profiles
set agency_id = null,
    household_id = null;

-- B) [Tuỳ chọn] Xóa hết profiles (role, scope). Bỏ comment 2 dòng dưới nếu muốn:
-- delete from public.profiles;

-- C) Truncate theo nhóm (thứ tự + CASCADE an toàn cho FK nội bộ)
truncate table
  public.plan_adjustments,
  public.pond_logs,
  public.harvest_records,
  public.pond_cycles,
  public.ponds,
  public.households,
  public.agencies,
  public.seasons
restart identity cascade;

commit;

-- Sau khi chạy: nạp lại dữ liệu mẫu bằng scripts/seed_standard_demo.sql (có sẵn mùa vụ + đợt thả + 4 đại lý / 8 hộ / 16 ao).
