/** Chu kỳ thả (pond_cycles) gắn với ao vật lý — flatten cho UI/báo cáo. */

const CYCLE_FIELDS = [
  'season_id',
  'stocking_batch_id',
  'status',
  'stock_date',
  'total_fish',
  'current_fish',
  'seed_size',
  'seed_weight',
  'density',
  'survival_rate',
  'target_weight',
  'expected_harvest_date',
  'initial_plan_locked',
  'initial_expected_harvest_date',
  'expected_yield',
  'actual_yield',
  'harvest_done',
  'total_feed_used',
  'fcr',
  'last_medicine_date',
  'withdrawal_days',
  'withdrawal_end_date',
  'notes',
  'name',
];

/**
 * Chu kỳ đang nuôi (CC), không thì chu kỳ mới nhất theo ngày thả / tạo.
 * @param {Array<object>|undefined|null} cycles
 * @returns {object|null}
 */
/** Nhãn hiển thị một chu kỳ (tên / ngày thả / Chu kỳ n). */
export function cycleDisplayLabel(c, idx = 0) {
  if (!c) return '—';
  const n = c?.name?.trim();
  return n || (c?.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${idx + 1}`);
}

/** Nhãn chu kỳ gắn với một dòng nhật ký (theo pond.pond_cycles). */
export function cycleLabelForPondLog(log, pond) {
  if (!log?.pond_cycle_id || !pond?.pond_cycles?.length) return '—';
  const cycles = pond.pond_cycles;
  const i = cycles.findIndex((x) => String(x.id) === String(log.pond_cycle_id));
  if (i < 0) return '—';
  return cycleDisplayLabel(cycles[i], i);
}

export function pickActiveCycle(cycles) {
  if (!cycles || cycles.length === 0) return null;
  const cc = cycles.find((c) => c.status === 'CC');
  if (cc) return cc;
  return [...cycles].sort((a, b) => {
    const da = String(a.stock_date || a.created_at || '');
    const db = String(b.stock_date || b.created_at || '');
    if (da !== db) return db.localeCompare(da);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  })[0];
}

export function spreadCycleFields(cycle) {
  const o = {};
  if (!cycle) return o;
  for (const k of CYCLE_FIELDS) {
    if (cycle[k] !== undefined) o[k] = cycle[k];
  }
  return o;
}

/**
 * @param {object} row — hàng Supabase ponds + pond_cycles[] + households?
 */
export function flattenPondRow(row) {
  if (!row) return null;
  const rawCycles = row.pond_cycles;
  const cycles = Array.isArray(rawCycles) ? [...rawCycles] : [];
  cycles.sort((a, b) => {
    const da = String(a.stock_date || a.created_at || '');
    const db = String(b.stock_date || b.created_at || '');
    if (da !== db) return db.localeCompare(da);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
  const active_cycle = pickActiveCycle(cycles);
  const { pond_cycles, households, ...pondBase } = row;
  const owner_name = pondBase.owner_name || households?.name || '';
  return {
    ...pondBase,
    households,
    owner_name,
    pond_cycles: cycles,
    active_cycle,
    ...spreadCycleFields(active_cycle),
  };
}
