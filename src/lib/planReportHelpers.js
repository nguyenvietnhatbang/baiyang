/** Ngày thu dùng cho báo cáo / biểu đồ KH gốc (ưu tiên snapshot sau khi khóa). */
export function originalHarvestDateForReport(pond) {
  if (!pond) return null;
  return pond.initial_expected_harvest_date || pond.expected_harvest_date || null;
}

/** Ngày thu dự kiến hiển thị cho vận hành (ưu tiên kế hoạch điều chỉnh, fallback kế hoạch gốc). */
export function plannedHarvestDateForDisplay(pond) {
  if (!pond) return null;
  return pond.expected_harvest_date || pond.initial_expected_harvest_date || null;
}
