import { format, startOfDay } from 'date-fns';
import { parseHarvestDateInput } from '@/lib/harvestDateParse';

/** Chuỗi yyyy-MM-dd từ ISO, dd/MM/yyyy, v.v.; null nếu không parse được. */
export function cycleRowDateYyyyMmDd(row, field) {
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
