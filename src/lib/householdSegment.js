/**
 * Mã hộ = phần số hộ trong mã ao (nhóm thứ 3: khu vực–đại lý–hộ–STT ao).
 * Giữ nguyên độ dài (vd. 006, 1001), không cắt còn 3 số.
 */

const MAX_SEGMENT_LEN = 16;

function hasPondStyleDelimiters(t) {
  return /[-./\s]/.test(t);
}

/** Lấy nhóm mã hộ từ chuỗi có dấu phân cách kiểu mã ao. */
function segmentFromPondStyleString(t) {
  const groups = String(t).match(/\d+/g) || [];
  if (groups.length < 3 || !hasPondStyleDelimiters(t)) return null;
  return groups[2].slice(0, MAX_SEGMENT_LEN);
}

export function normalizeHouseholdSegment(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  const fromCode = segmentFromPondStyleString(t);
  if (fromCode) return fromCode;
  return t.replace(/\D/g, '').slice(0, MAX_SEGMENT_LEN);
}

export function householdSegmentWhileTyping(value) {
  const t = String(value ?? '');
  const fromCode = segmentFromPondStyleString(t);
  if (fromCode) return fromCode;
  return t.replace(/\D/g, '').slice(0, MAX_SEGMENT_LEN);
}

export function householdSegmentFromInput(value) {
  return normalizeHouseholdSegment(value);
}

export function formatHouseholdSegmentDisplay(segment) {
  if (segment == null || String(segment).trim() === '') return '—';
  const seg = normalizeHouseholdSegment(segment);
  return seg || String(segment).trim();
}

/** Khóa duy nhất: đại lý + khu vực + mã hộ (mã hộ một mình có thể trùng). */
export function householdTripleKey(agencyId, regionCode, segment) {
  const seg = householdSegmentFromInput(segment);
  const region = String(regionCode ?? '').trim();
  const agency = agencyId != null && String(agencyId).trim() !== '' ? String(agencyId) : '';
  if (!agency || !region || !seg) return '';
  return `${agency}|${region}|${seg}`;
}

export function isDuplicateHouseholdTriple(households, { agencyId, regionCode, segment, excludeId }) {
  const key = householdTripleKey(agencyId, regionCode, segment);
  if (!key) return false;
  return (households || []).some((r) => {
    if (excludeId != null && r.id === excludeId) return false;
    return householdTripleKey(r.agency_id, r.region_code, r.household_segment) === key;
  });
}
