-- Mã hộ (3 số) phải duy nhất theo từng cặp đại lý + khu vực, khớp cách ghép mã ao:
--   region_code - mã đại lý - household_segment - STT ao
-- (Trước đây chỉ unique theo agency_id + household_segment nên không cho cùng đại lý
--  dùng lại mã hộ ở khu vực khác.)

alter table public.households
  drop constraint if exists households_agency_id_household_segment_key;

-- Cho phép chạy lại migration: gỡ ràng buộc mới rồi tạo lại
alter table public.households
  drop constraint if exists households_agency_id_region_code_household_segment_key;

alter table public.households
  add constraint households_agency_id_region_code_household_segment_key
  unique (agency_id, region_code, household_segment);
