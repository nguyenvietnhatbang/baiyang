-- =============================================================================
-- Seed demo chuẩn: 4 đại lý, 8 hộ nuôi, 16 ao
--   • 6 ao CC — đã thả, đang nuôi (kế hoạch khóa, nhật ký mẫu)
--   • 5 ao CT — chưa thả (chỉ hồ sơ ao)
--   • 5 ao CT — đã thu hoạch xong (lịch sử: bản ghi thu hoạch + ao nghỉ)
--
-- Điều kiện: supabase-schema.sql (hoặc tương đương), region_codes có '17',
--   migrations stocking_batches + app_settings (nếu dùng).
-- Chạy lại an toàn: ON CONFLICT upsert đại lý / hộ / ao theo mã.
-- =============================================================================

insert into public.seasons (code, name, active)
values ('VU-2026-1', 'Vụ 2026 — lứa 1', true)
on conflict (code) do nothing;

insert into public.stocking_batches (season_id, code, name, sort_order, stock_reference_date)
select s.id, 'D1', 'Đợt mặc định — tháng 1', 0, date '2026-01-15'
from public.seasons s where s.code = 'VU-2026-1'
on conflict (season_id, code) do nothing;

insert into public.stocking_batches (season_id, code, name, sort_order, stock_reference_date)
select s.id, 'D2', 'Đợt 2 — tháng 3', 1, date '2026-03-08'
from public.seasons s where s.code = 'VU-2026-1'
on conflict (season_id, code) do nothing;

do $$
declare
  sid uuid;
  b_d1 uuid;
  b_d2 uuid;
  ag1 uuid; ag2 uuid; ag3 uuid; ag4 uuid;
  h01 uuid; h02 uuid; h03 uuid; h04 uuid; h05 uuid; h06 uuid; h07 uuid; h08 uuid;
  t date := current_date;
begin
  select id into sid from public.seasons where code = 'VU-2026-1' limit 1;
  select id into b_d1 from public.stocking_batches where season_id = sid and code = 'D1' limit 1;
  select id into b_d2 from public.stocking_batches where season_id = sid and code = 'D2' limit 1;

  -- Đại lý (4)
  insert into public.agencies (code, name, pond_code_segment, region_code, phone, address, active)
  values
    ('SEED-TB-A1', 'Đại lý Thủy sản Đông Hưng', '01', '17', '0912000101', 'Đông Hưng — Thái Bình', true),
    ('SEED-TB-A2', 'Đại lý CP Feed Thái Bình',   '02', '17', '0912000202', 'Vũ Thư — Thái Bình', true),
    ('SEED-TB-A3', 'Đại lý Minh Phát Aquaculture','03', '17', '0912000303', 'Kiến Xương — Thái Bình', true),
    ('SEED-TB-A4', 'Đại lý Hợp tác xã Tiền Hải', '04', '17', '0912000404', 'Tiền Hải — Thái Bình', true)
  on conflict (code) do update set
    name = excluded.name,
    pond_code_segment = excluded.pond_code_segment,
    region_code = excluded.region_code,
    phone = excluded.phone,
    address = excluded.address,
    active = excluded.active;

  select id into ag1 from public.agencies where code = 'SEED-TB-A1';
  select id into ag2 from public.agencies where code = 'SEED-TB-A2';
  select id into ag3 from public.agencies where code = 'SEED-TB-A3';
  select id into ag4 from public.agencies where code = 'SEED-TB-A4';

  -- Hộ (8): 2 hộ / đại lý
  insert into public.households (agency_id, region_code, household_segment, name, address, active) values
    (ag1, '17', '001', 'Hộ Nguyễn Văn Thành', 'Thôn 1 — Đông Hưng', true),
    (ag1, '17', '002', 'Hộ Phạm Thị Lan',       'Thôn 3 — Đông Hưng', true),
    (ag2, '17', '001', 'Hộ Trần Đức Minh',     'Xã Tân Bình — Vũ Thư', true),
    (ag2, '17', '002', 'Hộ Lê Thu Hà',         'Xã Song Lãng — Vũ Thư', true),
    (ag3, '17', '001', 'Hộ Hoàng Quốc Tuấn',   'Ấp Trung — Kiến Xương', true),
    (ag3, '17', '002', 'Hộ Vũ Thị Mai',        'Ấp Nam — Kiến Xương', true),
    (ag4, '17', '001', 'Hộ Đỗ Văn Hùng',       'Xã Nam Trung — Tiền Hải', true),
    (ag4, '17', '002', 'Hộ Bùi Thị Hương',     'Xã Đông Trung — Tiền Hải', true)
  on conflict (agency_id, household_segment) do update set
    name = excluded.name, address = excluded.address, active = excluded.active;

  select id into h01 from public.households where agency_id = ag1 and household_segment = '001';
  select id into h02 from public.households where agency_id = ag1 and household_segment = '002';
  select id into h03 from public.households where agency_id = ag2 and household_segment = '001';
  select id into h04 from public.households where agency_id = ag2 and household_segment = '002';
  select id into h05 from public.households where agency_id = ag3 and household_segment = '001';
  select id into h06 from public.households where agency_id = ag3 and household_segment = '002';
  select id into h07 from public.households where agency_id = ag4 and household_segment = '001';
  select id into h08 from public.households where agency_id = ag4 and household_segment = '002';

  -- ========== 16 ao: upsert theo code ==========
  -- (1) CC — A1/H001/01
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, density, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date,
    expected_harvest_date, expected_yield,
    actual_yield, harvest_done, total_feed_used, fcr,
    ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-01-001-01', h01, 'Hộ Nguyễn Văn Thành', 'SEED-TB-A1', sid, b_d1,
    1850, 2.0, 'Ao đông nam ruộng lúa', 'CC',
    t - 72, 72000, 64800, 7.5, 11, 38.9, 90, 820,
    false, t - 72 + 118,
    t + 38, 4780,
    null, false, 6120, 1.42,
    6.6, 8.4, 25, 32,
    'Đang nuôi lứa chính; TA CP 801.',
    'POND:17-01-001-01:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, density = excluded.density,
    survival_rate = excluded.survival_rate, target_weight = excluded.target_weight,
    initial_plan_locked = excluded.initial_plan_locked, initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    harvest_done = excluded.harvest_done, total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (2) CT — A1/H001/02
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    initial_plan_locked, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-01-001-02', h01, 'Hộ Nguyễn Văn Thành', 'SEED-TB-A1', null, null,
    920, 1.6, 'Ao mới cải tạo, chờ xả nước', 'CT',
    false, 6.5, 8.5, 25, 32,
    'Chưa thả; dự kiến kế hoạch sau khi bơm nước biển ổn định.',
    'POND:17-01-001-02:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = null, total_fish = null, current_fish = null, expected_yield = null, expected_harvest_date = null,
    initial_plan_locked = excluded.initial_plan_locked, notes = excluded.notes, qr_code = excluded.qr_code,
    updated_at = timezone('utc', now());

  -- (3) CC — A1/H002/01
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-01-002-01', h02, 'Hộ Phạm Thị Lan', 'SEED-TB-A1', sid, b_d1,
    1320, 1.85, 'Cạnh kênh thủy lợi', 'CC',
    t - 55, 55000, 52300, 8.0, 12, 91, 800,
    false, t - 55 + 105, t + 42, 3820,
    false, 4980, 1.38, 6.5, 8.5, 25, 32,
    'Theo dõi pH buổi sáng; đã giảm ăn 5% tuần trước.',
    'POND:17-01-002-01:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, survival_rate = excluded.survival_rate,
    target_weight = excluded.target_weight, initial_plan_locked = excluded.initial_plan_locked,
    initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    harvest_done = excluded.harvest_done, total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (4) CT — A1/H002/02
  insert into public.ponds (
    code, household_id, owner_name, agency_code, area, depth, location, status,
    initial_plan_locked, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-01-002-02', h02, 'Hộ Phạm Thị Lan', 'SEED-TB-A1', 760, 1.5, 'Ao phụ — dự phòng vụ sau', 'CT',
    false, 6.5, 8.5, 25, 32, 'Chưa thả.', 'POND:17-01-002-02:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    season_id = null, stocking_batch_id = null, stock_date = null, total_fish = null, current_fish = null,
    expected_yield = null, expected_harvest_date = null, initial_plan_locked = excluded.initial_plan_locked,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (5) CC — A2/H001/01
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-02-001-01', h03, 'Hộ Trần Đức Minh', 'SEED-TB-A2', sid, b_d1,
    2100, 2.2, 'Ao trung tâm trại', 'CC',
    t - 88, 88000, 78200, 7.2, 10, 88, 850,
    false, t - 88 + 125, t + 12, 5950,
    false, 8200, 1.52, 6.7, 8.3, 25, 32,
    'Ao lớn; FCR hơi cao do giai đoạn chuyển thức ăn.',
    'POND:17-02-001-01:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, survival_rate = excluded.survival_rate,
    target_weight = excluded.target_weight, initial_plan_locked = excluded.initial_plan_locked,
    initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    harvest_done = excluded.harvest_done, total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (6) HIST — A2/H001/02
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    actual_yield, harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-02-001-02', h03, 'Hộ Trần Đức Minh', 'SEED-TB-A2', sid, b_d1,
    1650, 1.9, 'Ao đã thu xong — vệ sinh ao', 'CT',
    t - 195, 62000, 0, 7.5, 11, 90, 780,
    false, t - 195 + 120, t - 45, 4100,
    3920, true, 5850, 1.35, 6.5, 8.5, 25, 32,
    'Đã thu 2 lần; tổng thực tế gần KH. Ao nghỉ chờ sun drying.',
    'POND:17-02-001-02:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, survival_rate = excluded.survival_rate,
    target_weight = excluded.target_weight, initial_plan_locked = excluded.initial_plan_locked,
    initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    actual_yield = excluded.actual_yield, harvest_done = excluded.harvest_done,
    total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (7) CC — A2/H002/01
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-02-002-01', h04, 'Hộ Lê Thu Hà', 'SEED-TB-A2', sid, b_d1,
    1180, 1.75, 'Gần đường liên xã', 'CC',
    t - 40, 48000, 46500, 8.2, 13, 92, 790,
    false, t - 40 + 100, t + 55, 3350,
    false, 4100, 1.28, 6.5, 8.5, 25, 32,
    'Sinh trưởng tốt; chưa dùng kháng sinh vụ này.',
    'POND:17-02-002-01:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, survival_rate = excluded.survival_rate,
    target_weight = excluded.target_weight, initial_plan_locked = excluded.initial_plan_locked,
    initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    harvest_done = excluded.harvest_done, total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (8) HIST — A2/H002/02
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    actual_yield, harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-02-002-02', h04, 'Hộ Lê Thu Hà', 'SEED-TB-A2', sid, b_d1,
    990, 1.55, 'Ao nhỏ — đã kết thúc vụ', 'CT',
    t - 210, 41000, 0, 88, 760,
    false, t - 210 + 115, t - 60, 2580,
    2410, true, 3680, 1.33, 6.5, 8.5, 25, 32,
    'Thu một lần; đạt chỉ tiêu an toàn thực phẩm.',
    'POND:17-02-002-02:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    survival_rate = excluded.survival_rate, target_weight = excluded.target_weight,
    initial_plan_locked = excluded.initial_plan_locked, initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    actual_yield = excluded.actual_yield, harvest_done = excluded.harvest_done,
    total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (9) CT — A3/H001/01
  insert into public.ponds (
    code, household_id, owner_name, agency_code, area, depth, location, status,
    initial_plan_locked, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-03-001-01', h05, 'Hộ Hoàng Quốc Tuấn', 'SEED-TB-A3', 1420, 1.9, 'Ao mới lót bạt', 'CT',
    false, 6.5, 8.5, 25, 32, 'Chưa thả — chờ nước trong.', 'POND:17-03-001-01:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    season_id = null, stocking_batch_id = null, stock_date = null, total_fish = null, current_fish = null,
    expected_yield = null, expected_harvest_date = null, initial_plan_locked = excluded.initial_plan_locked,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (10) HIST — A3/H001/02
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    actual_yield, harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-03-001-02', h05, 'Hộ Hoàng Quốc Tuấn', 'SEED-TB-A3', sid, b_d1,
    1280, 1.8, 'Đã thu — chuẩn bị cải tạo', 'CT',
    t - 178, 58000, 0, 7.8, 12, 89, 810,
    false, t - 178 + 122, t - 28, 4210,
    4055, true, 5980, 1.31, 6.5, 8.5, 25, 32,
    'Hai đợt thu; lot đã duyệt approved.',
    'POND:17-03-001-02:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, survival_rate = excluded.survival_rate,
    target_weight = excluded.target_weight, initial_plan_locked = excluded.initial_plan_locked,
    initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    actual_yield = excluded.actual_yield, harvest_done = excluded.harvest_done,
    total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (11) CC — A3/H002/01 (D1)
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-03-002-01', h06, 'Hộ Vũ Thị Mai', 'SEED-TB-A3', sid, b_d1,
    1540, 2.05, 'Ao chính — mặt nước rộng', 'CC',
    t - 63, 68000, 65500, 7.6, 11, 90, 805,
    false, t - 63 + 112, t + 22, 4450,
    false, 5200, 1.29, 6.5, 8.5, 25, 32,
    'Đợt D1; theo dõi DO buổi sáng.',
    'POND:17-03-002-01:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, survival_rate = excluded.survival_rate,
    target_weight = excluded.target_weight, initial_plan_locked = excluded.initial_plan_locked,
    initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    harvest_done = excluded.harvest_done, total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (12) CC — A3/H002/02 (D2 — cùng vụ, đợt khác)
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, seed_size, seed_weight, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values (
    '17-03-002-02', h06, 'Hộ Vũ Thị Mai', 'SEED-TB-A3', sid, b_d2,
    1100, 1.7, 'Ao thả muộn — đợt 2', 'CC',
    t - 28, 52000, 51800, 8.0, 14, 91, 795,
    false, t - 28 + 108, t + 68, 2980,
    false, 2100, 1.22, 6.5, 8.5, 25, 32,
    'Thả sau Tết; tốc độ ăn đang tăng.',
    'POND:17-03-002-02:seedstd'
  )
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    seed_size = excluded.seed_size, seed_weight = excluded.seed_weight, survival_rate = excluded.survival_rate,
    target_weight = excluded.target_weight, initial_plan_locked = excluded.initial_plan_locked,
    initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    harvest_done = excluded.harvest_done, total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (13)(14) CT — A4
  insert into public.ponds (
    code, household_id, owner_name, agency_code, area, depth, location, status,
    initial_plan_locked, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values
    ('17-04-001-01', h07, 'Hộ Đỗ Văn Hùng', 'SEED-TB-A4', 890, 1.45, 'Ao vuông nhỏ', 'CT',
     false, 6.5, 8.5, 25, 32, 'Chưa thả.', 'POND:17-04-001-01:seedstd'),
    ('17-04-001-02', h07, 'Hộ Đỗ Văn Hùng', 'SEED-TB-A4', 1050, 1.6, 'Ao dự phòng', 'CT',
     false, 6.5, 8.5, 25, 32, 'Đang sấy đáy.', 'POND:17-04-001-02:seedstd')
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    season_id = null, stocking_batch_id = null, stock_date = null, total_fish = null, current_fish = null,
    expected_yield = null, expected_harvest_date = null, initial_plan_locked = excluded.initial_plan_locked,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- (15)(16) HIST — A4/H002
  insert into public.ponds (
    code, household_id, owner_name, agency_code, season_id, stocking_batch_id,
    area, depth, location, status,
    stock_date, total_fish, current_fish, survival_rate, target_weight,
    initial_plan_locked, initial_expected_harvest_date, expected_harvest_date, expected_yield,
    actual_yield, harvest_done, total_feed_used, fcr, ph_min, ph_max, temp_min, temp_max, notes, qr_code
  ) values
    ('17-04-002-01', h08, 'Hộ Bùi Thị Hương', 'SEED-TB-A4', sid, b_d1,
     1380, 1.95, 'Đã thu — xả nước', 'CT',
     t - 188, 70000, 0, 87, 800,
     false, t - 188 + 118, t - 35, 4880,
     4705, true, 7100, 1.36, 6.5, 8.5, 25, 32,
     'Vụ trước; hiện ao trống.', 'POND:17-04-002-01:seedstd'),
    ('17-04-002-02', h08, 'Hộ Bùi Thị Hương', 'SEED-TB-A4', sid, b_d1,
     1010, 1.58, 'Ao nhỏ — lịch sử thu', 'CT',
     t - 165, 45000, 0, 90, 770,
     false, t - 165 + 110, t - 22, 3020,
     2890, true, 4310, 1.34, 6.5, 8.5, 25, 32,
     'Thu gần đây; chờ vụ mới.', 'POND:17-04-002-02:seedstd')
  on conflict (code) do update set
    household_id = excluded.household_id, owner_name = excluded.owner_name, agency_code = excluded.agency_code,
    season_id = excluded.season_id, stocking_batch_id = excluded.stocking_batch_id,
    area = excluded.area, depth = excluded.depth, location = excluded.location, status = excluded.status,
    stock_date = excluded.stock_date, total_fish = excluded.total_fish, current_fish = excluded.current_fish,
    survival_rate = excluded.survival_rate, target_weight = excluded.target_weight,
    initial_plan_locked = excluded.initial_plan_locked, initial_expected_harvest_date = excluded.initial_expected_harvest_date,
    expected_harvest_date = excluded.expected_harvest_date, expected_yield = excluded.expected_yield,
    actual_yield = excluded.actual_yield, harvest_done = excluded.harvest_done,
    total_feed_used = excluded.total_feed_used, fcr = excluded.fcr,
    notes = excluded.notes, qr_code = excluded.qr_code, updated_at = timezone('utc', now());

  -- Nhật ký mẫu (3 ngày gần đây) cho 6 ao CC — chạy lại: xóa log seed cũ rồi nạp lại
  delete from public.pond_logs
  where notes = 'Seed chuẩn — quan trắc tự động'
    and pond_code in (
      '17-01-001-01', '17-01-002-01', '17-02-001-01', '17-02-002-01', '17-03-002-01', '17-03-002-02'
    );

  insert into public.pond_logs (pond_id, pond_code, log_date, ph, temperature, "do", nh3, feed_code, feed_amount, dead_fish, water_color, medicine_used, notes)
  select p.id, p.code, (t - offs)::date,
    phv, tempv, dov, nh3v, fcode, famt, dfc, wcol, null, 'Seed chuẩn — quan trắc tự động'
  from public.ponds p
  cross join (values
    (0, 7.15::numeric, 28.1::numeric, 5.6::numeric, 0.028::numeric, 'CP801'::text, 118::numeric, 0::numeric, 'Xanh nhạt'::text),
    (1, 7.22::numeric, 27.8::numeric, 5.4::numeric, 0.035::numeric, 'CP801', 125::numeric, 2::numeric, 'Xanh nhạt'),
    (2, 7.08::numeric, 28.4::numeric, 5.9::numeric, 0.022::numeric, 'CP802', 132::numeric, 0::numeric, 'Nâu vàng')
  ) as x(offs, phv, tempv, dov, nh3v, fcode, famt, dfc, wcol)
  where p.code in (
    '17-01-001-01', '17-01-002-01', '17-02-001-01', '17-02-002-01', '17-03-002-01', '17-03-002-02'
  );

  -- Thu hoạch lịch sử (5 ao): xóa cũ theo lot seed rồi insert
  delete from public.harvest_records where lot_code like 'SEED-LOT-%';

  insert into public.harvest_records (
    pond_id, pond_code, owner_name, agency_code, harvest_date,
    planned_yield, actual_yield, fish_count_harvested, avg_weight_harvest,
    dead_fish_count, reject_fish_count, water_quality_ok, antibiotic_residue_ok,
    heavy_metal_ok, pesticide_ok, action_taken, price_per_kg, total_value, lot_code, notes
  )
  select p.id, p.code, p.owner_name, p.agency_code, t - 52,
    p.expected_yield, 2100, 2650, 0.79, 12, 3, true, true, true, true, 'approved', 52.5, 110250, 'SEED-LOT-H1', 'Đợt thu 1'
  from public.ponds p where p.code = '17-02-001-02';

  insert into public.harvest_records (
    pond_id, pond_code, owner_name, agency_code, harvest_date,
    planned_yield, actual_yield, fish_count_harvested, avg_weight_harvest,
    water_quality_ok, antibiotic_residue_ok, action_taken, price_per_kg, total_value, lot_code, notes
  )
  select p.id, p.code, p.owner_name, p.agency_code, t - 38,
    p.expected_yield, 1820, 2280, 0.798, true, true, 'approved', 51.0, 92820, 'SEED-LOT-H2', 'Đợt thu 2 — xong vụ'
  from public.ponds p where p.code = '17-02-001-02';

  insert into public.harvest_records (
    pond_id, pond_code, owner_name, agency_code, harvest_date,
    planned_yield, actual_yield, fish_count_harvested, avg_weight_harvest,
    water_quality_ok, antibiotic_residue_ok, action_taken, price_per_kg, total_value, lot_code, notes
  )
  select p.id, p.code, p.owner_name, p.agency_code, t - 58,
    p.expected_yield, 2410, 3180, 0.758, true, true, 'approved', 50.5, 121705, 'SEED-LOT-H3', 'Thu một lần'
  from public.ponds p where p.code = '17-02-002-02';

  insert into public.harvest_records (
    pond_id, pond_code, owner_name, agency_code, harvest_date,
    planned_yield, actual_yield, fish_count_harvested, avg_weight_harvest,
    water_quality_ok, antibiotic_residue_ok, action_taken, price_per_kg, total_value, lot_code, notes
  )
  select p.id, p.code, p.owner_name, p.agency_code, t - 40,
    round(p.expected_yield * 0.55), 2280, 2900, 0.786, true, true, 'approved', 53.0, 120840, 'SEED-LOT-H4A', 'Đợt 1'
  from public.ponds p where p.code = '17-03-001-02';

  insert into public.harvest_records (
    pond_id, pond_code, owner_name, agency_code, harvest_date,
    planned_yield, actual_yield, fish_count_harvested, avg_weight_harvest,
    water_quality_ok, antibiotic_residue_ok, action_taken, price_per_kg, total_value, lot_code, notes
  )
  select p.id, p.code, p.owner_name, p.agency_code, t - 28,
    round(p.expected_yield * 0.45), 1775, 2210, 0.804, true, true, 'approved', 52.8, 93720, 'SEED-LOT-H4B', 'Đợt 2'
  from public.ponds p where p.code = '17-03-001-02';

  insert into public.harvest_records (
    pond_id, pond_code, owner_name, agency_code, harvest_date,
    planned_yield, actual_yield, fish_count_harvested, avg_weight_harvest,
    water_quality_ok, antibiotic_residue_ok, action_taken, price_per_kg, total_value, lot_code, notes
  )
  select p.id, p.code, p.owner_name, p.agency_code, t - 35,
    p.expected_yield, 2680, 3350, 0.799, true, true, 'approved', 51.2, 137216, 'SEED-LOT-H5', 'Thu chính'
  from public.ponds p where p.code = '17-04-002-01';

  insert into public.harvest_records (
    pond_id, pond_code, owner_name, agency_code, harvest_date,
    planned_yield, actual_yield, fish_count_harvested, avg_weight_harvest,
    water_quality_ok, antibiotic_residue_ok, action_taken, price_per_kg, total_value, lot_code, notes
  )
  select p.id, p.code, p.owner_name, p.agency_code, t - 30,
    p.expected_yield, 2890, 3620, 0.798, true, true, 'approved', 50.8, 146812, 'SEED-LOT-H6', 'Xong vụ'
  from public.ponds p where p.code = '17-04-002-02';

  update public.app_settings set harvest_alert_days = 7 where id = 1;

  raise notice 'Seed chuẩn: 4 đại lý SEED-TB-A1…A4, 8 hộ, 16 ao (17-01-001-01 … 17-04-002-02).';
end $$;
