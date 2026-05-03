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
