/** @param {{ default_ph_min?: number; default_ph_max?: number; default_temp_min?: number; default_temp_max?: number } | null | undefined} settings */
export function getWaterThresholdDefaults(settings) {
  const d = (v, fallback) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    ph_min: d(settings?.default_ph_min, 6.5),
    ph_max: d(settings?.default_ph_max, 8.5),
    temp_min: d(settings?.default_temp_min, 25),
    temp_max: d(settings?.default_temp_max, 32),
  };
}
