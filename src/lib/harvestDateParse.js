import { parse, parseISO } from 'date-fns';

/**
 * Parse ngày từ API / form: ISO (yyyy-MM-dd…), dd/MM/yyyy, d/M/yyyy, dd-MM-yyyy; bỏ BOM và khoảng trắng.
 * @param {unknown} value
 * @returns {Date|null}
 */
export function parseHarvestDateInput(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s0 = String(value).replace(/\uFEFF/g, '').trim().replace(/\s+/g, '');
  if (!s0) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s0)) {
    const d = parseISO(s0.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s0)) {
    const d = parse(s0, 'd/M/yyyy', new Date());
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s0)) {
    const d = parse(s0, 'd-M-yyyy', new Date());
    if (!Number.isNaN(d.getTime())) return d;
  }

  const iso = parseISO(s0);
  if (!Number.isNaN(iso.getTime())) return iso;
  return null;
}
