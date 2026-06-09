/** Bảng Chu kỳ — full width, cột số/date gọn, cột chữ hấp thụ phần trống. */

export const cycleTable = {
  root: 'w-full text-sm border-collapse table-fixed',
  th: 'px-2 py-1.5 text-[11px] leading-tight font-bold text-muted-foreground uppercase tracking-tight',
  thRight: 'text-right',
  thCenter: 'text-center',
  td: 'px-2 py-1.5 text-sm leading-snug',
  tdNum: 'px-2 py-1.5 text-sm leading-snug text-right tabular-nums',
  tdTruncate: 'px-2 py-1.5 text-sm leading-snug truncate',
  checkCol: 'px-1.5 py-1.5',
  actionsCol: 'px-1 py-1.5',
};

/** Trọng số tương đối (tổng được chuẩn hóa 100%). */
const COL_WEIGHT = {
  _check: 2,
  agency_code: 4,
  owner_name: 18,
  pond_code: 10,
  cycle_name: 8,
  status: 5,
  stock_date: 7,
  total_fish: 6,
  stocked_fish_added: 6,
  current_fish: 6,
  avg_weight: 7,
  expected_yield: 6,
  actual_yield: 6,
  yield_need_harvest: 6,
  fish_harvested: 6,
  fish_remaining: 6,
  expected_harvest_date: 8,
  total_feed_used: 6,
  fcr: 4,
  alerts: 6,
  _actions: 3,
};

const NUMERIC_KEYS = new Set([
  'total_fish',
  'stocked_fish_added',
  'current_fish',
  'avg_weight',
  'expected_yield',
  'actual_yield',
  'yield_need_harvest',
  'fish_harvested',
  'fish_remaining',
  'total_feed_used',
]);

/**
 * @param {Array<{ key: string }>} columnDefs
 * @param {Record<string, boolean>} visibleCols
 * @param {{ showCheck?: boolean, showActions?: boolean }} opts
 * @returns {Array<{ key: string, pct: number }>}
 */
export function cycleColgroupPlan(columnDefs, visibleCols, { showCheck = true, showActions = true } = {}) {
  const keys = [];
  if (showCheck) keys.push('_check');
  for (const c of columnDefs) {
    if (c.key === 'actions') continue;
    if (visibleCols[c.key]) keys.push(c.key);
  }
  if (showActions && visibleCols.actions) keys.push('_actions');
  const weights = keys.map((k) => COL_WEIGHT[k] ?? 5);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return keys.map((k, i) => ({ key: k, pct: (weights[i] / sum) * 100 }));
}

export function cycleThClass(key, align = 'left') {
  const alignCls = align === 'right' ? cycleTable.thRight : align === 'center' ? cycleTable.thCenter : 'text-left';
  return [cycleTable.th, alignCls, 'whitespace-nowrap'].join(' ');
}

export function cycleTdClass(key, { numeric = false, truncate = false } = {}) {
  const base = truncate ? cycleTable.tdTruncate : numeric ? cycleTable.tdNum : cycleTable.td;
  return [base, 'whitespace-nowrap'].join(' ');
}

export function cycleTdOpts(key) {
  return {
    numeric: NUMERIC_KEYS.has(key),
    truncate: key === 'owner_name' || key === 'cycle_name' || key === 'pond_code',
  };
}
