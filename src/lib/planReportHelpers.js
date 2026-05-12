import { addDays, format, startOfDay } from 'date-fns';
import { calcOriginalYieldKg, calculateCurrentYield } from '@/lib/calculateYield';
import { parseHarvestDateInput } from '@/lib/harvestDateParse';

/** Số ngày nuôi mặc định để ước ngày thu khi chưa nhập «Thu hoạch dự kiến» trên chu kỳ (có ngày thả + đang nuôi/có cá). */
export const DEFAULT_ESTIMATED_GROWOUT_DAYS = 150;

function storedPlannedHarvestDateOnly(pond) {
  if (!pond) return null;
  const adj = pond.expected_harvest_date ?? pond.expectedHarvestDate;
  if (adj != null && String(adj).trim() !== '') return adj;
  const ini = pond.initial_expected_harvest_date ?? pond.initialExpectedHarvestDate;
  if (ini != null && String(ini).trim() !== '') return ini;
  return null;
}

/**
 * Ước yyyy-MM-dd = ngày thả + {@link DEFAULT_ESTIMATED_GROWOUT_DAYS} khi DB chưa có ngày thu DK.
 * Chỉ khi có ngày thả parse được và (CC hoặc có cá đăng ký).
 */
export function estimatedHarvestDateFromStockOnly(cycle) {
  if (!cycle) return null;
  const status = String(cycle.status ?? '').toUpperCase();
  const fish = Number(cycle.total_fish || cycle.current_fish || 0);
  if (status !== 'CC' && !(fish > 0)) return null;
  const d0 = parseHarvestDateInput(cycle.stock_date);
  if (!d0 || Number.isNaN(d0.getTime())) return null;
  return format(startOfDay(addDays(startOfDay(d0), DEFAULT_ESTIMATED_GROWOUT_DAYS)), 'yyyy-MM-dd');
}

/** true nếu đang dùng ước từ ngày thả (không có expected/initial trên DB). */
export function isPlannedHarvestDateEstimated(cycle) {
  return !storedPlannedHarvestDateOnly(cycle) && Boolean(estimatedHarvestDateFromStockOnly(cycle));
}

/**
 * SL kế hoạch ban đầu (kg) — công thức đăng ký: total_fish × tỷ lệ sống × TL mục tiêu.
 * Dùng báo cáo «KH thu & sản lượng» (cột so sánh với thực tế), không lấy expected_yield đã chỉnh.
 */
export function plannedYieldOriginalKg(cycle) {
  if (!cycle) return null;
  const n = calcOriginalYieldKg(cycle);
  return n > 0 ? n : null;
}

/** Ngày thu dùng cho báo cáo / biểu đồ KH gốc (ưu tiên snapshot sau khi khóa). */
export function originalHarvestDateForReport(pond) {
  if (!pond) return null;
  return pond.initial_expected_harvest_date || pond.expected_harvest_date || null;
}

/**
 * Ngày thu hoạch hiển thị / lọc: ưu tiên điều chỉnh → gốc; nếu trống thì ước từ ngày thả + {@link DEFAULT_ESTIMATED_GROWOUT_DAYS} (khi hợp lệ).
 */
export function plannedHarvestDateForDisplay(pond) {
  const s = storedPlannedHarvestDateOnly(pond);
  if (s) return s;
  return estimatedHarvestDateFromStockOnly(pond);
}

/**
 * SL dự kiến trên bảng Chu kỳ (cột kế hoạch): ưu tiên `expected_yield` trên chu kỳ
 * (cập nhật khi điều chỉnh số cá qua nhật ký); không có thì ước theo cá hiện tại, rồi KH ban đầu (total_fish).
 * Cột «Sản lượng cần phải thu» = max(0, cột này − sản lượng đã thu).
 */
export function plannedYieldAdjustedForTable(cycle) {
  if (!cycle) return null;
  const raw = cycle.expected_yield;
  if (raw != null && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0) {
    return Math.round(Number(raw));
  }
  const cur = calculateCurrentYield(cycle);
  if (Number.isFinite(cur) && cur > 0) return Math.round(cur);
  const orig = calcOriginalYieldKg(cycle);
  if (orig > 0) return Math.round(orig);
  return null;
}

/**
 * SL dự kiến (kg) hiển thị: nếu expected_yield trùng công thức theo số cá hiện tại → coi như chưa chỉnh SL,
 * hiển thị kế hoạch ban đầu (đăng ký total_fish). Nếu expected_yield lệch công thức đó → hiển thị số điều chỉnh.
 */
export function plannedYieldForDisplay(cycle) {
  if (!cycle) return null;
  const orig = calcOriginalYieldKg(cycle);
  const natural = calculateCurrentYield(cycle);
  const raw = cycle.expected_yield;
  const stored = raw == null || raw === '' ? null : Number(raw);
  const storedOk = stored != null && Number.isFinite(stored) && stored >= 0;
  const stR = Math.round(stored || 0);
  const natR = Math.round(natural);
  const origR = Math.round(orig);

  if (storedOk && (natural <= 0 || stR !== natR)) return stR;
  if (origR > 0) return origR;
  if (storedOk && stR > 0) return stR;
  if (natR > 0) return natR;
  return null;
}
