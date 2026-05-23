import { format, startOfDay } from 'date-fns';
import { parseHarvestDateInput } from '@/lib/harvestDateParse';
import { originalHarvestDateForReport, plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';

/** Chuỗi yyyy-MM-dd từ ngày nhập (tránh lệch tháng do `new Date('yyyy-MM-dd')` UTC). */
export function dateYmdFromValue(value) {
  const d = parseHarvestDateInput(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  return format(startOfDay(d), 'yyyy-MM-dd');
}

export function parseableStockDateYmd(cycle) {
  if (!cycle) return null;
  return dateYmdFromValue(cycle.stock_date);
}

export function plannedHarvestDateYmdForReport(cycle) {
  return dateYmdFromValue(plannedHarvestDateForDisplay(cycle));
}

/**
 * Đủ căn cứ ghi KH thu theo tháng trên báo cáo:
 * - Có ngày thả (stock_date)
 * - Có ngày thu dự kiến (đã lưu hoặc ước từ ngày thả)
 * - Ngày thu không trước ngày thả
 */
export function cycleHarvestPlanEligibleForMonthReport(cycle) {
  const stockYmd = parseableStockDateYmd(cycle);
  const harvestYmd = plannedHarvestDateYmdForReport(cycle);
  if (!stockYmd || !harvestYmd) return false;
  if (harvestYmd < stockYmd) return false;
  return true;
}

export function originalHarvestDateYmdForReport(cycle) {
  return dateYmdFromValue(originalHarvestDateForReport(cycle));
}

/**
 * KH gốc theo tháng: có ngày thả parse được, có ngày thu gốc (initial/expected), ngày thu ≥ ngày thả.
 */
export function cycleOriginalPlanEligibleForMonthReport(cycle) {
  const stockYmd = parseableStockDateYmd(cycle);
  const harvestYmd = originalHarvestDateYmdForReport(cycle);
  if (!stockYmd || !harvestYmd) return false;
  if (harvestYmd < stockYmd) return false;
  return true;
}

export function originalHarvestMonthYearForReport(cycle) {
  if (!cycleOriginalPlanEligibleForMonthReport(cycle)) return null;
  return calendarMonthYearFromYmd(originalHarvestDateYmdForReport(cycle));
}

export function originalHarvestMonthIndexForReport(cycle) {
  const my = originalHarvestMonthYearForReport(cycle);
  return my ? my.month : null;
}

export function calendarMonthYearFromYmd(ymd) {
  const d = parseHarvestDateInput(ymd);
  if (!d || Number.isNaN(d.getTime())) return null;
  return { month: d.getMonth(), year: d.getFullYear() };
}

export function harvestMonthYearForReport(cycle) {
  if (!cycleHarvestPlanEligibleForMonthReport(cycle)) return null;
  return calendarMonthYearFromYmd(plannedHarvestDateYmdForReport(cycle));
}

export function stockMonthYearForReport(cycle) {
  const stockYmd = parseableStockDateYmd(cycle);
  if (!stockYmd) return null;
  return calendarMonthYearFromYmd(stockYmd);
}

/** Tháng (0–11) của ngày thu dự kiến — null nếu không đủ căn cứ thả. */
export function harvestMonthIndexForReport(cycle) {
  const my = harvestMonthYearForReport(cycle);
  return my ? my.month : null;
}

/** Tháng (0–11) của ngày thả — null nếu không có ngày thả. */
export function stockMonthIndexForReport(cycle) {
  const my = stockMonthYearForReport(cycle);
  return my ? my.month : null;
}

export function harvestMatchesFilterYear(cycle, yearFilter) {
  const my = harvestMonthYearForReport(cycle);
  if (!my) return false;
  const y = Number(yearFilter);
  if (!Number.isFinite(y)) return true;
  return my.year === y;
}

export function harvestMatchesFilterMonthYear(cycle, yearFilter, monthIndex) {
  const my = harvestMonthYearForReport(cycle);
  if (!my) return false;
  const y = Number(yearFilter);
  const mi = Number(monthIndex);
  if (!Number.isFinite(y) || !Number.isFinite(mi)) return false;
  return my.year === y && my.month === mi;
}

/** Phiếu thu: tháng/năm theo ngày thu hoạch thực tế trên phiếu. */
export function harvestTicketMonthYear(harvestDate) {
  const d = parseHarvestDateInput(harvestDate);
  if (!d || Number.isNaN(d.getTime())) return null;
  return { month: d.getMonth(), year: d.getFullYear() };
}

export function harvestTicketMatchesFilterYear(harvestDate, yearFilter) {
  const my = harvestTicketMonthYear(harvestDate);
  if (!my) return false;
  const y = Number(yearFilter);
  if (!Number.isFinite(y)) return true;
  return my.year === y;
}

export function harvestTicketMatchesFilterMonthYear(harvestDate, yearFilter, monthIndex) {
  const my = harvestTicketMonthYear(harvestDate);
  if (!my) return false;
  const y = Number(yearFilter);
  const mi = Number(monthIndex);
  if (!Number.isFinite(y) || !Number.isFinite(mi)) return false;
  return my.year === y && my.month === mi;
}

export function harvestTicketMatchesDateRange(harvestDate, fromStr, toStr) {
  const ymd = dateYmdFromValue(harvestDate);
  if (!ymd) return false;
  const from = (fromStr || '').trim().slice(0, 10);
  const to = (toStr || '').trim().slice(0, 10);
  if (!from && !to) return true;
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}
