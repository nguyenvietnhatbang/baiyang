import { harvestedTabKgHarvested, harvestedTabKgRemaining } from '@/lib/cycleHarvestCompletion';

const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : '');

export const POND_EXPORT_COLUMNS = [
  { header: 'Mã ao', key: 'code', width: 14 },
  { header: 'Chủ hộ', key: 'owner_name', width: 18 },
  { header: 'Đại lý', key: 'agency_code', width: 10 },
  { header: 'Trạng thái', accessor: (p) => p.active_cycle?.status || 'CT', width: 8 },
  { header: 'Cá hiện tại', accessor: (p) => num(p.active_cycle?.current_fish ?? p.active_cycle?.total_fish), width: 12 },
  { header: 'Trọng lượng cá (g)', accessor: (p) => num(p.export_avg_weight), width: 14 },
  { header: 'SL dự kiến (kg)', accessor: (p) => num(p.active_cycle?.expected_yield), width: 14 },
  { header: 'Diện tích (m²)', accessor: (p) => num(p.area), width: 12 },
  { header: 'Độ sâu (m)', accessor: (p) => num(p.depth), width: 10 },
  { header: 'Địa điểm', key: 'location', width: 24 },
];

const CYCLE_BASE_COLUMNS = [
  { header: 'Đại lý', key: 'agency_code', width: 10 },
  { header: 'Chủ hộ', key: 'owner_name', width: 18 },
  { header: 'Mã ao', key: 'pond_code', width: 14 },
  { header: 'Chu kỳ', key: 'cycle_name', width: 16 },
  { header: 'TT', key: 'status', width: 6 },
  { header: 'Ngày thả', key: 'stock_date', width: 12 },
  { header: 'Cá ban đầu', accessor: (r) => num(r.total_fish), width: 12 },
  { header: 'Thả thêm', accessor: (r) => num(r.stocked_fish_added), width: 10 },
  { header: 'Cá hiện tại', accessor: (r) => num(r.current_fish), width: 12 },
  { header: 'Trọng lượng cá (g)', accessor: (r) => num(r.avg_weight), width: 14 },
  { header: 'SL DK (kg)', accessor: (r) => num(r.expected_yield), width: 12 },
];

export const CYCLE_EXPORT_COLUMNS_ACTIVE = [
  ...CYCLE_BASE_COLUMNS,
  { header: 'SL thu (kg)', accessor: (r) => num(r.actual_harvest_display_kg ?? r.actual_yield), width: 12 },
  { header: 'SL cần (kg)', accessor: (r) => num(r.yield_need_harvest), width: 12 },
  { header: 'Thu DK', key: 'expected_harvest_date', width: 12 },
  { header: 'Thức ăn (kg)', accessor: (r) => num(r.total_feed_used), width: 12 },
  { header: 'FCR', accessor: (r) => num(r.fcr), width: 8 },
];

export const CYCLE_EXPORT_COLUMNS_HARVESTED = [
  ...CYCLE_BASE_COLUMNS,
  { header: 'SL thu (kg)', accessor: (r) => num(harvestedTabKgHarvested(r)), width: 12 },
  { header: 'SL còn (kg)', accessor: (r) => num(harvestedTabKgRemaining(r)), width: 12 },
  { header: 'Ngày thu TT', key: 'latest_harvest_date', width: 12 },
  { header: 'Thức ăn (kg)', accessor: (r) => num(r.total_feed_used), width: 12 },
  { header: 'FCR', accessor: (r) => num(r.fcr), width: 8 },
];

export const POND_LOG_EXPORT_COLUMNS = [
  { header: 'Ngày', key: 'log_date', width: 12 },
  { header: 'Mã ao', key: 'pond_code', width: 12 },
  { header: 'Đại lý', key: 'agency_code', width: 10 },
  { header: 'Chu kỳ', key: 'cycle_label', width: 16 },
  { header: 'Hao hụt (con)', accessor: (l) => num(l.dead_fish), width: 12 },
  { header: 'Thả thêm (con)', accessor: (l) => num(l.stocked_fish), width: 12 },
  { header: 'Thức ăn (kg)', accessor: (l) => num(l.feed_amount), width: 12 },
  { header: 'Mã TA', key: 'feed_code', width: 10 },
  { header: 'pH', accessor: (l) => num(l.ph), width: 8 },
  { header: 'T°', accessor: (l) => num(l.temperature), width: 8 },
  { header: 'DO', accessor: (l) => num(l.do), width: 8 },
  { header: 'NH3', accessor: (l) => num(l.nh3), width: 8 },
  { header: 'NO2', accessor: (l) => num(l.no2), width: 8 },
  { header: 'H2S', accessor: (l) => num(l.h2s), width: 8 },
  { header: 'Màu NC', key: 'water_color', width: 10 },
  { header: 'Trọng lượng cá (g)', accessor: (l) => num(l.avg_weight), width: 14 },
  { header: 'Thuốc', key: 'medicine_used', width: 16 },
  { header: 'Ghi chú', accessor: (l) => l.notes || l.disease_notes || '', width: 20 },
];

export const HARVEST_EXPORT_COLUMNS = [
  { header: 'Ngày thu', key: 'harvest_date', width: 12 },
  { header: 'Mã lô', key: 'lot_code', width: 16 },
  { header: 'SL thực (kg)', accessor: (r) => num(r.actual_yield), width: 12 },
  { header: 'SL KH (kg)', accessor: (r) => num(r.planned_yield), width: 12 },
  { header: 'Số cá thu', accessor: (r) => num(r.fish_count_harvested), width: 12 },
  { header: 'TL TB (g)', accessor: (r) => num(r.avg_weight_harvest), width: 12 },
  { header: 'Ghi chú', key: 'notes', width: 20 },
];

export const POND_CYCLES_DIALOG_EXPORT_COLUMNS = [
  { header: 'Chu kỳ', key: 'export_label', width: 18 },
  { header: 'Trạng thái', key: 'status', width: 8 },
  { header: 'SL dự kiến (kg)', accessor: (c) => num(c.expected_yield), width: 14 },
  { header: 'Cá hiện tại', accessor: (c) => num(c.current_fish ?? c.total_fish), width: 12 },
  { header: 'Ngày thả', key: 'stock_date', width: 12 },
];

export const HOUSEHOLD_POND_EXPORT_COLUMNS = [
  { header: 'Mã ao', key: 'code', width: 14 },
  { header: 'Trạng thái', accessor: (p) => p.status || p.active_cycle?.status || 'CT', width: 10 },
  { header: 'Diện tích (m²)', accessor: (p) => num(p.area), width: 12 },
  { header: 'Cá hiện tại', accessor: (p) => num(p.current_fish ?? p.active_cycle?.current_fish), width: 12 },
  { header: 'Trọng lượng cá (g)', accessor: (p) => num(p.export_avg_weight), width: 14 },
];

export const FIELD_POND_EXPORT_COLUMNS = [
  { header: 'Mã ao', key: 'code', width: 14 },
  { header: 'Chủ hộ', key: 'owner_name', width: 18 },
  { header: 'Đại lý', key: 'agency_code', width: 10 },
  { header: 'Trạng thái', key: 'status', width: 8 },
  { header: 'Diện tích (m²)', accessor: (p) => num(p.area), width: 12 },
  { header: 'Số cá', accessor: (p) => num(p.current_fish), width: 12 },
  { header: 'Trọng lượng cá (g)', accessor: (p) => num(p.export_avg_weight), width: 14 },
  { header: 'SL dự kiến (kg)', accessor: (p) => num(p.expected_yield), width: 14 },
  { header: 'Thu dự kiến', key: 'expected_harvest_date', width: 12 },
  { header: 'FCR', accessor: (p) => num(p.fcr), width: 8 },
  { header: 'Địa điểm', key: 'location', width: 24 },
];

export const DAILY_PRODUCTION_PLAN_EXPORT_COLUMNS = [
  { header: 'Mã hệ thống', key: 'sysCode', width: 12 },
  { header: 'Hệ thống', key: 'sysName', width: 18 },
  { header: 'Hộ nuôi', key: 'owner', width: 18 },
  { header: 'Ao nuôi', key: 'pond', width: 14 },
  { header: 'Chu kỳ', key: 'cycle', width: 16 },
  { header: 'Diện tích (m²)', accessor: (r) => num(r.area), width: 12 },
  { header: 'Kế hoạch thu', key: 'plannedDate', width: 12 },
  { header: 'Ngày thu thực tế', key: 'actualDate', width: 12 },
  { header: 'SL KH (kg)', accessor: (r) => num(r.plannedKg), width: 14 },
  { header: 'SL thực tế (kg)', accessor: (r) => num(r.actualKg), width: 14 },
  { header: 'Thức ăn (kg)', accessor: (r) => num(r.feedKg), width: 12 },
  { header: 'FCR', accessor: (r) => num(r.fcr), width: 8 },
  { header: 'Ghi chú', key: 'note', width: 20 },
];

export const REPORT_SUMMARY_MATRIX_EXPORT_COLUMNS = [
  { header: 'Mã hệ thống', key: 'sysCode', width: 12 },
  { header: 'Hệ thống', key: 'agencyName', width: 18 },
  { header: 'Tháng', key: 'month', width: 10 },
  { header: 'Kế hoạch (kg)', accessor: (r) => num(r.planned), width: 14 },
  { header: 'Thực hiện (kg)', accessor: (r) => num(r.actual), width: 14 },
];
