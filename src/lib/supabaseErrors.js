function errorBlob(error) {
  const e = /** @type {any} */ (error);
  return [e?.message, e?.details, e?.hint, e?.constraint].filter(Boolean).join(' ').toLowerCase();
}

/** Ràng buộc cũ: unique (agency_id, household_segment) — bỏ qua khu vực. */
export function isOldHouseholdAgencySegmentConstraint(error) {
  const blob = errorBlob(error);
  if (blob.includes('households_agency_id_household_segment_key')) return true;
  return (
    blob.includes('household_segment') &&
    blob.includes('agency_id') &&
    !blob.includes('region_code')
  );
}

const HOUSEHOLD_UNIQUE_MIGRATION =
  'scripts/migrations/20260519_households_unique_agency_region_segment.sql';

/** Lỗi khi tạo/sửa hộ nuôi (23505). */
export function formatHouseholdSaveError(error) {
  if (!error) return formatSupabaseError(error);
  const code = /** @type {any} */ (error).code;
  if (code !== '23505') return formatSupabaseError(error);

  if (isOldHouseholdAgencySegmentConstraint(error)) {
    return (
      'Database chưa đúng quy tắc: chỉ được coi trùng khi trùng cả Mã hộ + Khu vực + Đại lý. ' +
      'Hiện DB vẫn chặn theo (Đại lý + Mã hộ). Admin mở Supabase → SQL Editor, chạy file ' +
      `${HOUSEHOLD_UNIQUE_MIGRATION} (hoặc npm run migrate:household-unique).`
    );
  }

  const blob = errorBlob(error);
  if (blob.includes('region_code') || blob.includes('households_agency_id_region_code')) {
    return (
      'Bộ (Mã hộ + Khu vực + Đại lý) đã tồn tại. Cùng mã hộ ở đại lý hoặc khu vực khác vẫn được phép.'
    );
  }

  return (
    'Lỗi trùng khi lưu hộ. Nếu chắc chắn bộ (Mã hộ + Khu vực + Đại lý) chưa có, ' +
    `database có thể đang dùng ràng buộc cũ — chạy migration ${HOUSEHOLD_UNIQUE_MIGRATION}.`
  );
}

/** @param {import('@supabase/supabase-js').PostgrestError | Error | null | undefined} error */
export function formatSupabaseError(error) {
  if (!error) return 'Lỗi không xác định';
  const code = /** @type {any} */ (error).code;
  const msg = error.message || '';
  if (msg === 'Invalid login credentials' || msg.includes('Invalid login')) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (code === '23505') {
    const hint = errorBlob(error);
    if (hint.includes('household')) {
      return formatHouseholdSaveError(error);
    }
    return 'Dữ liệu bị trùng (mã đã tồn tại trên hệ thống). Vui lòng chọn mã khác.';
  }
  if (code === '42501' || msg.includes('policy')) {
    return 'Không có quyền thực hiện thao tác này.';
  }
  return msg || 'Có lỗi xảy ra khi lưu dữ liệu.';
}