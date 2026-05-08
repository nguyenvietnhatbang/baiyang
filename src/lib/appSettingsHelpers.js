/** 
 * @param {{ 
 *   default_ph_min?: number; 
 *   default_ph_max?: number; 
 *   default_temp_min?: number; 
 *   default_temp_max?: number;
 *   default_do_min?: number;
 *   default_do_max?: number;
 *   default_nh3_min?: number;
 *   default_nh3_max?: number;
 *   default_no2_min?: number;
 *   default_no2_max?: number;
 *   default_h2s_min?: number;
 *   default_h2s_max?: number;
 * } | null | undefined} settings 
 */
export function getWaterThresholdDefaults(settings) {
  const d = (v, fallback) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    ph_min: d(settings?.default_ph_min, 6.5),
    ph_max: d(settings?.default_ph_max, 8.5),
    temp_min: d(settings?.default_temp_min, 25),
    temp_max: d(settings?.default_temp_max, 32),
    do_min: d(settings?.default_do_min, 5),
    do_max: d(settings?.default_do_max, 12),
    nh3_min: d(settings?.default_nh3_min, 0),
    nh3_max: d(settings?.default_nh3_max, 0.3),
    no2_min: d(settings?.default_no2_min, 0),
    no2_max: d(settings?.default_no2_max, 0.05),
    h2s_min: d(settings?.default_h2s_min, 0),
    h2s_max: d(settings?.default_h2s_max, 0.02),
  };
}

/**
 * Kế hoạch nhà máy theo tháng (kg). Chuẩn hoá thành mảng 12 phần tử [T1..T12].
 * @param {{ factory_plan_kg_by_month?: unknown } | null | undefined} settings
 */
export function getFactoryPlanKgByMonth(settings) {
  const raw = settings?.factory_plan_kg_by_month;
  const out = Array.from({ length: 12 }, () => 0);
  if (!raw) return out;
  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? safeParseJsonArray(raw) : null);
  if (!arr) return out;
  for (let i = 0; i < 12; i += 1) {
    const v = Number(arr[i]);
    out[i] = Number.isFinite(v) && v >= 0 ? v : 0;
  }
  return out;
}

function safeParseJsonArray(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
