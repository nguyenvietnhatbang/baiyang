/** Đăng nhập hiện trường: SĐT VN → chuỗi số; xác thực qua bảng field_accounts (RPC), không Auth email. */

/**
 * @param {string} raw
 * @returns {string} ví dụ 84987654321
 */
export function normalizeVnPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('84')) return d;
  if (d.startsWith('0')) return `84${d.slice(1)}`;
  if (d.length >= 9) return `84${d}`;
  return d;
}

export function isFieldRole(role) {
  return role === 'agency' || role === 'household_owner';
}

/**
 * Giá trị QR ao: `POND:<mã ao>` (không phân biệt hoa thường), hoặc chỉ mã,
 * hoặc URL có chứa POND:… / tham số pond|code.
 */
export function parsePondCodeFromQr(text) {
  let t = String(text || '').trim();
  if (!t) return null;
  t = t.split(/\r?\n/)[0].trim();
  if (!t) return null;

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const q = u.searchParams.get('pond') || u.searchParams.get('code') || u.searchParams.get('pond_code');
      if (q) return parsePondCodeFromQr(q);
    } catch {
      /* ignore */
    }
    const m = t.match(/POND:([^&#\s]+)/i);
    if (m) {
      try {
        return decodeURIComponent(m[1].trim()) || null;
      } catch {
        return m[1].trim() || null;
      }
    }
  }

  if (/^POND:/i.test(t)) {
    const code = t.replace(/^POND:/i, '').trim();
    return code || null;
  }
  return t;
}

/** So khớp mã ao (trim + không phân biệt hoa thường). */
export function pondCodesEqual(a, b) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}
