import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { parseHarvestDateInput } from '@/lib/harvestDateParse';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';

export { parseHarvestDateInput };

/** @param {{ harvest_alert_days?: number | string } | null | undefined} settings */
export function getHarvestAlertDays(settings) {
  const raw = settings?.harvest_alert_days;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && String(raw).trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0) return 7;
  const v = Math.min(365, Math.floor(n));
  // 0 ngày trong cài đặt → coi như tắt cửa sổ «SẮP THU»; dùng mặc định 7 để cột Cảnh báo vẫn có ý nghĩa.
  return v < 1 ? 7 : v;
}

/**
 * Chênh số ngày dương lịch: ngày dự kiến thu − hôm nay (âm = đã quá ngày).
 * Dùng startOfDay để tránh lệch múi giờ với chuỗi yyyy-MM-dd.
 */
export function calendarDaysUntilHarvest(expectedDateStr, today = new Date()) {
  if (expectedDateStr == null || expectedDateStr === '') return null;
  if (expectedDateStr instanceof Date) {
    if (Number.isNaN(expectedDateStr.getTime())) return null;
    return differenceInCalendarDays(startOfDay(expectedDateStr), startOfDay(today));
  }
  const parsed = parseHarvestDateInput(expectedDateStr);
  if (!parsed) return null;
  const d = startOfDay(parsed);
  if (Number.isNaN(d.getTime())) return null;
  return differenceInCalendarDays(d, startOfDay(today));
}

/** Ngày thu dự kiến ≤ hôm nay (lịch): `diff` từ `calendarDaysUntilHarvest` ≤ 0. */
export function isHarvestDateOnOrBeforeToday(diff) {
  return diff !== null && diff <= 0;
}

/**
 * Ngày thu còn trong tương lai nhưng trong N ngày tới (lịch): 1…N ngày sau hôm nay.
 * Dùng cột «Cảnh báo» / mobile: «SẮP THU» — khác với «THU» (đã tới hoặc quá hạn ngày dự kiến).
 */
export function isHarvestDateWithinUpcomingDays(diff, alertDays) {
  const n = typeof alertDays === 'number' ? alertDays : Number(alertDays);
  if (diff === null || !Number.isFinite(n) || n < 1) return false;
  return diff > 0 && diff <= Math.min(365, Math.floor(n));
}

/**
 * Chu kỳ đã xong thu (tắt cảnh báo THU): đủ kg kế hoạch, SL cần thu ≤ 0, hoặc hết cá (theo phiếu/ước).
 *
 * Không dùng `harvest_done` một mình: đồng bộ phiếu thu (`harvestRecordSync`) đặt harvest_done = true
 * chỉ cần totalActualYield > 0 (thu một phần) — sẽ làm tắt nhầm mọi cảnh báo.
 */
export function isCycleHarvestCompleteForAlerts(row) {
  if (!row) return false;
  const yNeed = row.yield_need_harvest;
  if (yNeed != null && Number.isFinite(Number(yNeed)) && Number(yNeed) <= 0) return true;
  const planned = Number(row.expected_yield) || 0;
  const actual = Number(row.actual_harvest_display_kg) || Number(row.actual_yield) || 0;
  if (planned > 0 && actual >= planned) return true;
  const remFish = row.fish_remaining;
  if (remFish != null && Number.isFinite(Number(remFish)) && Number(remFish) <= 0) {
    const yNeedKg = row.yield_need_harvest;
    if (yNeedKg != null && Number.isFinite(Number(yNeedKg)) && Number(yNeedKg) > 0) {
      return false;
    }
    if (planned > 0) return true;
    if (actual > 0) return true;
  }
  return false;
}

/**
 * @param {object} pond - PondCycle object với actual_yield và harvest_done
 * @param {number} totalHarvestedKg — sum(actual_yield) for pond (fallback)
 * @param {number} alertDays
 * @returns {'harvested'|'upcoming'|'not_ready'}
 */
export function classifyHarvestStatus(pond, totalHarvestedKg, alertDays) {
  const planned = pond.expected_yield || 0;
  const plannedHarvestDate = plannedHarvestDateForDisplay(pond);

  // Ưu tiên sử dụng actual_yield từ PondCycle
  const actualYield = pond.actual_yield || totalHarvestedKg;

  // Kiểm tra nếu đã thu hoạch. Chú ý: Trạng thái 'CT' có thể là "Chưa thả" hoặc "Đã thu".
  // Chỉ coi là đã thu khi harvest_done = true hoặc đã có phiếu thu hoạch thực tế.
  if (pond.harvest_done || (actualYield > 0 && planned > 0 && actualYield >= planned)) {
    return 'harvested';
  }
  if (!plannedHarvestDate) {
    return 'not_ready';
  }
  const today = new Date();
  const diff = calendarDaysUntilHarvest(plannedHarvestDate, today);
  if (diff != null && diff <= alertDays) {
    return 'upcoming';
  }
  return 'not_ready';
}

export function harvestStatusLabel(status) {
  if (status === 'harvested') return 'Đã thu';
  if (status === 'upcoming') return 'Sắp thu';
  return 'Chưa thu';
}
