/** @param {import('@supabase/supabase-js').PostgrestError | Error | null | undefined} error */
export function formatSupabaseError(error) {
  if (!error) return 'Lỗi không xác định';
  const code = /** @type {any} */ (error).code;
  const msg = error.message || '';
  if (msg === 'Invalid login credentials' || msg.includes('Invalid login')) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  if (code === '23505') {
    return 'Dữ liệu bị trùng (mã đã tồn tại trên hệ thống). Vui lòng chọn mã khác.';
  }
  if (code === '42501' || msg.includes('policy')) {
    return 'Không có quyền thực hiện thao tác này.';
  }
  return msg || 'Có lỗi xảy ra khi lưu dữ liệu.';
}
