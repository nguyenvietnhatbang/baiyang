/** Ngưỡng gợi ý — đồng bộ giữa văn phòng (PondLogTab) và hiện trường (FieldLogPage). */
export const POND_LOG_ENV_RANGES = {
  ph: { min: 6.5, max: 8.5, label: 'pH' },
  temperature: { min: 25, max: 32, label: 'Nhiệt độ (°C)' },
  do: { min: 5, max: 12, label: 'DO (mg/L)' },
  nh3: { min: 0, max: 0.3, label: 'NH3 (mg/L)' },
  no2: { min: 0, max: 0.05, label: 'NO2 (mg/L)' },
  h2s: { min: 0, max: 0.02, label: 'H2S (mg/L)' },
};

export function pondLogEnvOutOfRange(key, value) {
  if (value === '' || value == null) return false;
  const r = POND_LOG_ENV_RANGES[key];
  if (!r) return false;
  const n = Number(value);
  if (Number.isNaN(n)) return false;
  return n < r.min || n > r.max;
}
