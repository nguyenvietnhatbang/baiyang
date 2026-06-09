import { harvestedTabKgHarvested, harvestedTabKgRemaining } from '@/lib/cycleHarvestCompletion';

const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : '');

export const POND_EXPORT_COLUMNS = [
  { header: 'Mã ao', key: 'code', width: 14 },
  { header: 'Chủ hộ', key: 'owner_name', width: 18 },
  { header: 'Đại lý', key: 'agency_code', width: 10 },
  { header: 'Trạng thái', accessor: (p) => p.active_cycle?.status || 'CT', width: 8 },
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
