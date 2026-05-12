import { format, startOfDay } from 'date-fns';
import { parseHarvestDateInput } from '@/lib/harvestDateParse';

/**
 * Display date as dd/MM/yyyy.
 * Dùng cùng logic parse với cảnh báo thu / lọc (dd/MM, d/M, gạch ngang, ISO, có khoảng trắng).
 */
export function formatDateDisplay(value) {
  if (value == null || value === '') return '—';
  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return '—';
    return format(startOfDay(value), 'dd/MM/yyyy');
  }
  const d = parseHarvestDateInput(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return format(startOfDay(d), 'dd/MM/yyyy');
}

