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

/** Giá trị QR ao: `POND:<mã ao>` (hoặc chỉ mã ao). */
export function parsePondCodeFromQr(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (t.startsWith('POND:')) {
    const code = t.slice(5).trim();
    return code || null;
  }
  return t;
}
