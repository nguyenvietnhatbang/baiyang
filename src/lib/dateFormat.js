import { format, parseISO } from 'date-fns';

/**
 * Display date as dd/MM/yyyy.
 * Accepts ISO date string (yyyy-MM-dd), ISO datetime, Date, or falsy.
 */
export function formatDateDisplay(value) {
  if (!value) return '—';
  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return '—';
    return format(value, 'dd/MM/yyyy');
  }
  const s = String(value).trim();
  if (!s) return '—';

  // Already dd/MM/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  try {
    // Handles yyyy-MM-dd and full ISO strings
    const d = s.length >= 10 ? parseISO(s.slice(0, 10)) : parseISO(s);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'dd/MM/yyyy');
  } catch {
    return '—';
  }
}

