import { calcOriginalYieldKg, calculateCurrentYield } from '@/lib/calculateYield';

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
 * Ngày thu hoạch hiển thị / lọc: ưu tiên dữ liệu điều chỉnh (expected_harvest_date);
 * không có điều chỉnh (trống) thì lấy ngày dự kiến gốc (initial_expected_harvest_date).
 */
export function plannedHarvestDateForDisplay(pond) {
  if (!pond) return null;
  const adj = pond.expected_harvest_date;
  if (adj != null && String(adj).trim() !== '') return adj;
  const ini = pond.initial_expected_harvest_date;
  if (ini != null && String(ini).trim() !== '') return ini;
  return null;
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
