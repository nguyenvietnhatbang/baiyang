import { format, startOfDay } from 'date-fns';
import { parseHarvestDateInput } from '@/lib/harvestDateParse';

/** Chuỗi yyyy-MM-dd từ ISO, dd/MM/yyyy, v.v.; null nếu không parse được. */
export function cycleRowDateYyyyMmDd(row, field) {
  if (field === 'actual_harvest') {
    const raw = row.latest_harvest_date;
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const p = parseHarvestDateInput(raw);
    if (!p || Number.isNaN(p.getTime())) return null;
    return format(startOfDay(p), 'yyyy-MM-dd');
  }
  const raw = field === 'stock' ? row.stock_date : row.expected_harvest_date;
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const p = parseHarvestDateInput(raw);
  if (!p || Number.isNaN(p.getTime())) return null;
  return format(startOfDay(p), 'yyyy-MM-dd');
}
/**
 * Lọc theo khoảng ngày (inclusive). fromStr / toStr dạng yyyy-MM-dd hoặc rỗng.
 * Không có từ/đến → không lọc theo ngày.
 */
export function rowMatchesCycleDateRange(row, field, fromStr, toStr) {
  const from = (fromStr || '').trim().slice(0, 10);
  const to = (toStr || '').trim().slice(0, 10);
  if (!from && !to) return true;
  const d = cycleRowDateYyyyMmDd(row, field);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** yyyy-MM-dd từ phiếu thu (một dòng harvest). */
export function harvestTicketDateYmd(harvestDate) {
  if (harvestDate == null || String(harvestDate).trim() === '') return null;
  const s = String(harvestDate).trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const p = parseHarvestDateInput(harvestDate);
  if (!p || Number.isNaN(p.getTime())) return null;
  return format(startOfDay(p), 'yyyy-MM-dd');
}

/**
 * Có ít nhất một phiếu thu trong tháng (0–11) của năm calendar.
 * harvestDatesYmd: mảng yyyy-MM-dd (mỗi phiếu một ngày).
 */
export function rowHasHarvestInMonth(harvestDatesYmd, yearFilter, monthIndex) {
  if (monthIndex === 'all' || monthIndex == null || monthIndex === '') return true;
  const y = Number(yearFilter);
  const m = Number(monthIndex);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) return true;
  const list = Array.isArray(harvestDatesYmd) ? harvestDatesYmd : [];
  return list.some((d) => {
    if (!d || d.length < 7) return false;
    const dy = Number(d.slice(0, 4));
    const dm = Number(d.slice(5, 7)) - 1;
    return dy === y && dm === m;
  });
}
