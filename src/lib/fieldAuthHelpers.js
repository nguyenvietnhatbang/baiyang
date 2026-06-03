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

/** Chuỗi đưa vào QR / cột qr_code: luôn `POND:<mã>` (không hậu tố). */
export function pondQrPayload(code) {
  const c = String(code ?? '').trim();
  if (!c) return '';
  return `POND:${c}`;
}

/** Lấy mã ao sau tiền tố POND: (bỏ hậu tố kiểu `:timestamp` trong DB cũ). */
function pondCodeAfterPondPrefix(rest) {
  const r = String(rest ?? '').trim();
  if (!r) return null;
  const first = r.split(':')[0].trim();
  return first || null;
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
      let chunk = m[1].trim();
      try {
        chunk = decodeURIComponent(chunk);
      } catch {
        /* giữ nguyên */
      }
      return pondCodeAfterPondPrefix(chunk);
    }
  }

  if (/^POND:/i.test(t)) {
    const rest = t.replace(/^POND:/i, '').trim();
    return pondCodeAfterPondPrefix(rest);
  }
  return t;
}

/** So khớp mã ao (trim + không phân biệt hoa thường). */
export function pondCodesEqual(a, b) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

function pondHouseholdId(pond) {
  return pond?.household_id ?? pond?.households?.id ?? null;
}

/** Ao có nằm trong phạm vi tài khoản hiện trường (đại lý / chủ hộ) không. */
export function isPondInFieldUserScope(user, pond) {
  if (!user || !pond) return false;
  if (user.role === 'household_owner') {
    if (!user.household_id) return false;
    const hid = pondHouseholdId(pond);
    return hid != null && String(hid) === String(user.household_id);
  }
  if (user.role === 'agency') {
    if (user.agency_code && pond.agency_code) {
      return String(pond.agency_code) === String(user.agency_code);
    }
    const hhAgency = pond?.households?.agency_id;
    if (user.agency_id && hhAgency) {
      return String(hhAgency) === String(user.agency_id);
    }
    return false;
  }
  return false;
}

export function filterPondsForFieldUser(user, ponds) {
  if (!user) return [];
  return (ponds || []).filter((p) => isPondInFieldUserScope(user, p));
}

/** Hộ nuôi có nằm trong phạm vi đại lý / chủ hộ không. */
export function isHouseholdInFieldUserScope(user, household) {
  if (!user || !household) return false;
  if (user.role === 'household_owner') {
    if (!user.household_id) return false;
    return String(household.id) === String(user.household_id);
  }
  if (user.role === 'agency') {
    if (!user.agency_id) return false;
    return String(household.agency_id) === String(user.agency_id);
  }
  return false;
}

export function filterHouseholdsForFieldUser(user, households) {
  if (!user || !isFieldRole(user.role)) return households || [];
  return (households || []).filter((h) => isHouseholdInFieldUserScope(user, h));
}

/** Danh sách ao thuộc phạm vi phụ trách của user hiện trường. */
export async function loadPondsForFieldUser(user) {
  const { base44 } = await import('@/api/base44Client');
  const allPonds = await base44.entities.Pond.listWithHouseholds('code', 500);
  if (!user) return [];

  if (user.role === 'household_owner' && user.household_id) {
    return (allPonds || []).filter((p) => String(pondHouseholdId(p)) === String(user.household_id));
  }

  if (user.role === 'agency' && user.agency_id) {
    const hh = await base44.entities.Household.filter({ agency_id: user.agency_id }, 'name', 500);
    const hhIds = new Set((hh || []).map((h) => String(h.id)));
    return (allPonds || []).filter((p) => {
      const hid = pondHouseholdId(p);
      return hid && hhIds.has(String(hid));
    });
  }

  return filterPondsForFieldUser(user, allPonds || []);
}
