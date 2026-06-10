/** Đăng nhập hiện trường: SĐT VN → chuỗi số; xác thực qua bảng field_accounts (RPC), không Auth email. */

/**
 * Chuẩn hóa SĐT VN về dạng nội bộ: 0 + 9 chữ số (vd. 0386436558).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeVnPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('84') && d.length >= 11) return `0${d.slice(2)}`;
  if (d.startsWith('0')) return d;
  if (d.length >= 9) return `0${d}`;
  return d;
}

/** Các biến thể SĐT để tra cứu DB (hỗ trợ bản ghi cũ lưu 84… hoặc 0…). */
export function vnPhoneLookupVariants(raw) {
  const canonical = normalizeVnPhone(raw);
  if (!canonical) return [];
  const digits = canonical.replace(/\D/g, '');
  const set = new Set([canonical, digits]);
  if (digits.startsWith('0') && digits.length >= 10) {
    set.add(`84${digits.slice(1)}`);
    set.add(digits.slice(1));
  }
  if (digits.startsWith('84') && digits.length >= 11) {
    set.add(`0${digits.slice(2)}`);
    set.add(digits.slice(2));
  }
  return [...set].filter(Boolean);
}

export function isFieldRole(role) {
  return role === 'agency' || role === 'household_owner' || role === 'manager';
}

export function isAdminUser(user) {
  return user?.role === 'admin';
}

/** Chỉ admin được sửa / xóa dữ liệu gốc (ao, chu kỳ, hộ…); vai trò khác chỉ thêm và xem. */
export function canUserEditDelete(user) {
  return isAdminUser(user);
}

/** Ghi nhật ký mới — admin, giám sát vùng, chủ hộ, đại lý (trong phạm vi). */
export function canUserCreatePondLog(user) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return isFieldRole(user.role);
}

/** Sửa dòng nhật ký đã lưu — admin và giám sát vùng; chủ hộ / đại lý không. */
export function canUserEditPondLog(user) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return user.role === 'manager';
}

/** Xóa nhật ký — chỉ admin. */
export function canUserDeletePondLog(user) {
  return isAdminUser(user);
}

export function canUserCreatePondLogForPond(user, pond) {
  if (!user || !pond) return false;
  if (isAdminUser(user)) return true;
  if (!canUserCreatePondLog(user)) return false;
  return isPondInFieldUserScope(user, pond);
}

export function canUserEditPondLogForPond(user, pond) {
  if (!user || !pond) return false;
  if (!canUserEditPondLog(user)) return false;
  if (isAdminUser(user)) return true;
  return isPondInFieldUserScope(user, pond);
}

export const FIELD_ROLE_LABELS = {
  agency: 'Đại lý',
  household_owner: 'Chủ hộ',
  manager: 'Giám sát vùng',
};

/** Mã khu vực được phân công (vai trò Quản lý). */
export function userAssignedRegionCodes(user) {
  const raw = user?.region_codes;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => String(c).trim()).filter(Boolean);
}

function pondRegionCode(pond) {
  return pond?.households?.region_code ?? pond?.region_code ?? null;
}

const DEFAULT_POND_APP_ORIGIN = 'https://baiyang-one.vercel.app';

/** Chuỗi đưa vào QR / cột qr_code: luôn `POND:<mã>` (không hậu tố). */
export function pondQrPayload(code) {
  const c = String(code ?? '').trim();
  if (!c) return '';
  return `POND:${c}`;
}

export function pondDetailQrUrl(pond, baseHref = DEFAULT_POND_APP_ORIGIN) {
  const code = String(pond?.code ?? '').trim();
  if (!code) return '';

  const params = new URLSearchParams();
  params.set('tab', 'log');
  params.set('pond_code', code);
  const path = `/ponds/${encodeURIComponent(code)}?${params.toString()}`;
  const base = String(baseHref || '').trim();

  if (!base) return path;

  try {
    return new URL(path, base).toString();
  } catch {
    return `${base.replace(/\/+$/, '')}${path}`;
  }
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
      const parts = u.pathname.split('/').filter(Boolean);
      const pondIdx = parts.findIndex((part) => part.toLowerCase() === 'ponds');
      const pathCode = pondIdx >= 0 ? parts[pondIdx + 1] : '';
      if (pathCode) return parsePondCodeFromQr(decodeURIComponent(pathCode));
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
  if (user.role === 'manager') {
    const codes = userAssignedRegionCodes(user);
    if (codes.length === 0) return false;
    const rc = pondRegionCode(pond);
    return rc != null && codes.includes(String(rc));
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
  if (user.role === 'manager') {
    const codes = userAssignedRegionCodes(user);
    if (codes.length === 0 || !household.region_code) return false;
    return codes.includes(String(household.region_code));
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

  if (user.role === 'manager') {
    const codes = new Set(userAssignedRegionCodes(user));
    if (codes.size === 0) return [];
    return (allPonds || []).filter((p) => {
      const rc = pondRegionCode(p);
      return rc && codes.has(String(rc));
    });
  }

  return filterPondsForFieldUser(user, allPonds || []);
}
