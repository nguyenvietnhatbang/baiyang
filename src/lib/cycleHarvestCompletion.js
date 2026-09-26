/**
 * Khi nào chu kỳ coi là «đã thu xong» (tab Chu kỳ đã thu / harvest_done + CT).
 * Thu một phần (kg hoặc cá) → giữ tab Chu kỳ, trừ khi bấm «Chốt kết thúc chu kỳ».
 */

export const CYCLE_MANUAL_CLOSE_NOTE_TAG = '[chot_thu]';

export function cycleNotesHaveManualClose(notes) {
  return String(notes ?? '').includes(CYCLE_MANUAL_CLOSE_NOTE_TAG);
}

export function appendManualCloseNote(existingNotes) {
  const base = String(existingNotes ?? '').trim();
  if (cycleNotesHaveManualClose(base)) return base || CYCLE_MANUAL_CLOSE_NOTE_TAG;
  return base ? `${base}\n${CYCLE_MANUAL_CLOSE_NOTE_TAG}` : CYCLE_MANUAL_CLOSE_NOTE_TAG;
}

/** Gỡ tag chốt thủ công khi mở lại chu kỳ (CC). */
export function removeManualCloseNote(existingNotes) {
  const lines = String(existingNotes ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l !== CYCLE_MANUAL_CLOSE_NOTE_TAG);
  return lines.join('\n');
}

/** Đã bấm «Chốt kết thúc chu kỳ» (không nhầm với đồng bộ phiếu thu cũ). */
export function isCycleManuallyChotThu(cycle) {
  return cycleNotesHaveManualClose(cycle?.notes);
}

/** Chốt thủ công khi chưa có phiếu thu (edge case). */
export function isManuallyClosedNoTickets(cycle, totalActualKg) {
  return isCycleManuallyChotThu(cycle) && (Number(totalActualKg) || 0) === 0;
}

/** Đủ / vượt sản lượng kế hoạch (kg). */
export function isPlannedKgHarvestComplete(cycle, totalActualKg) {
  const planned = Number(cycle?.expected_yield) || 0;
  const actual = Number(totalActualKg ?? cycle?.actual_yield) || 0;
  if (planned <= 0) return false;
  return actual >= planned - 0.01;
}

/** Còn bao nhiêu con (phiếu thu hoặc current_fish). null = chưa xác định. */
export function fishRemainingFromHarvests(cycle, harvests) {
  const ticketFish = (harvests || []).reduce((s, h) => s + (Number(h.fish_count_harvested) || 0), 0);
  const basisFromTotal = (Number(cycle?.total_fish) || 0) + (Number(cycle?.stocked_fish_added) || 0);
  if (ticketFish > 0 && basisFromTotal > 0) return Math.max(0, basisFromTotal - ticketFish);

  const cur = cycle?.current_fish;
  if (cur != null && !Number.isNaN(Number(cur))) return Math.max(0, Number(cur));
  return null;
}

/**
 * Tự động sang tab đã thu: đủ kg kế hoạch VÀ biết chắc hết cá.
 * rem == null (chưa theo dõi được) → KHÔNG tự chốt — tránh CC/CT nhảy qua lại.
 */
export function isCycleAutoFullyHarvested(cycle, totalActualKg, harvests) {
  if (!isPlannedKgHarvestComplete(cycle, totalActualKg)) return false;
  const rem = fishRemainingFromHarvests(cycle, harvests);
  return rem != null && rem <= 0;
}

/**
 * Nguồn sự thật duy nhất cho status CC/CT.
 * CC = đang nuôi / thu dở; CT = trống, chưa thả, hoặc đã chốt thu xong.
 */
export function resolveCycleStatus(cycle, { current_fish, totalActualYield = 0, isFullyDone = false } = {}) {
  if (isFullyDone || isCycleManuallyChotThu(cycle)) return 'CT';
  const fish = current_fish != null ? Number(current_fish) : Number(cycle?.current_fish);
  const hasFish = Number.isFinite(fish) && fish > 0;
  const hasPartialHarvest = (Number(totalActualYield) || 0) > 0;
  if (hasFish || hasPartialHarvest) return 'CC';
  return 'CT';
}

/**
 * Mỗi ao chỉ một chu kỳ CC (khớp unique index + trigger demote).
 * Mutates `patchById` (Map<string, patch>): hạ status các ứng viên phụ xuống CT.
 */
export function enforceSingleCcPatches(cycles, patchById) {
  const byPond = new Map();
  for (const c of cycles || []) {
    const pid = c?.pond_id != null ? String(c.pond_id) : '';
    if (!pid) continue;
    if (!byPond.has(pid)) byPond.set(pid, []);
    byPond.get(pid).push(c);
  }

  const resolvedStatus = (c) => {
    const p = patchById.get(String(c.id));
    return String((p && p.status != null ? p.status : c.status) || 'CT').toUpperCase();
  };

  const score = (c) => {
    const p = patchById.get(String(c.id)) || {};
    const fish = Number(p.current_fish != null ? p.current_fish : c.current_fish) || 0;
    const stock = c.stock_date ? Date.parse(String(c.stock_date).slice(0, 10)) || 0 : 0;
    const created = Date.parse(String(c.created_at || c.created_date || '')) || 0;
    const wasCc = String(c.status || '').toUpperCase() === 'CC' ? 1 : 0;
    const done = Boolean(p.harvest_done != null ? p.harvest_done : c.harvest_done);
    const notDone = done ? 0 : 1;
    return notDone * 1e15 + wasCc * 1e14 + stock * 1e5 + created + fish;
  };

  for (const group of byPond.values()) {
    const wouldBeCc = group.filter((c) => resolvedStatus(c) === 'CC');
    if (wouldBeCc.length <= 1) continue;
    wouldBeCc.sort((a, b) => score(b) - score(a));
    for (const c of wouldBeCc.slice(1)) {
      const id = String(c.id);
      const prev = patchById.get(id) || {};
      patchById.set(id, { ...prev, status: 'CT' });
    }
  }
}

function rowAsCycle(row) {
  return { ...row, notes: row.cycle_notes ?? row.notes };
}

/** Sản lượng đã thu (kg) — tab Chu kỳ đã thu, cột SL THU. */
export function harvestedTabKgHarvested(row) {
  const v = row?.actual_harvest_display_kg ?? row?.actual_yield;
  const n = Number(v);
  if (v == null || Number.isNaN(n)) return null;
  return n;
}

/** Sản lượng còn phải thu (kg) — tab Chu kỳ đã thu, cột SL CÒN. */
export function harvestedTabKgRemaining(row) {
  const y = row?.yield_need_harvest;
  if (y == null || Number.isNaN(Number(y))) return null;
  return Number(y);
}

/** «SL cần thu» (kg) có giá trị và ≤ 0 — đủ/vượt kế hoạch theo kg. */
export function isYieldNeedHarvestDone(row) {
  const y = row?.yield_need_harvest;
  return y != null && !Number.isNaN(Number(y)) && Number(y) <= 0;
}

/** Chu kỳ hiển thị tab «Chu kỳ đã thu». */
export function shouldShowCycleOnHarvestedTab(row) {
  if (!row?.cycle_id) return false;
  const cycle = rowAsCycle(row);
  const actualKg = Number(row.actual_harvest_display_kg) || Number(row.actual_yield) || 0;
  if (isLegacyAccidentalPartialClose(cycle, actualKg)) return false;
  if (isCycleManuallyChotThu(cycle)) return true;
  if (isYieldNeedHarvestDone(row)) return true;
  const rem = row.fish_remaining;
  if (rem != null && !Number.isNaN(Number(rem)) && Number(rem) <= 0) {
    const hasHarvest = actualKg > 0 || Boolean(row.harvest_done);
    if (hasHarvest) return true;
  }
  return false;
}

/** Dữ liệu cũ: harvest_done+CT do sync nhầm khi thu một phần — không có tag chốt thủ công. */
export function isLegacyAccidentalPartialClose(cycle, totalActualKg) {
  if (isCycleManuallyChotThu(cycle)) return false;
  if (!Boolean(cycle?.harvest_done) || String(cycle?.status ?? '').toUpperCase() !== 'CT') return false;
  const actual = Number(totalActualKg ?? cycle?.actual_yield) || 0;
  if (actual <= 0) return false;
  return !isPlannedKgHarvestComplete(cycle, totalActualKg);
}

/**
 * Patch cập nhật PondCycle sau khi đồng bộ phiếu thu.
 * @param {object} cycle
 * @param {Array<object>} harvests
 */
export function harvestSyncPatchFromRecords(cycle, harvests) {
  const totalActualYield = (harvests || []).reduce((sum, h) => sum + (Number(h.actual_yield) || 0), 0);
  if (isLegacyAccidentalPartialClose(cycle, totalActualYield)) {
    const rem = fishRemainingFromHarvests(cycle, harvests);
    let current_fish = rem != null ? rem : cycle.current_fish;
    let fcr = null;
    if (cycle.total_feed_used && totalActualYield > 0) {
      fcr = Math.round((cycle.total_feed_used / totalActualYield) * 100) / 100;
    }
    return {
      actual_yield: totalActualYield,
      harvest_done: false,
      status: 'CC',
      fcr,
      current_fish,
      notes: cycle.notes,
    };
  }
  const manualChot = isCycleManuallyChotThu(cycle);
  const autoComplete = isCycleAutoFullyHarvested(cycle, totalActualYield, harvests);
  const isFullyDone = manualChot || autoComplete;
  const harvest_done = isFullyDone;

  let fcr = null;
  if (cycle.total_feed_used && totalActualYield > 0) {
    fcr = Math.round((cycle.total_feed_used / totalActualYield) * 100) / 100;
  }

  let current_fish = cycle.current_fish;
  if (isFullyDone) {
    current_fish = 0;
  } else if (totalActualYield > 0) {
    const rem = fishRemainingFromHarvests(cycle, harvests);
    const cur = cycle.current_fish;
    const curN = cur != null && !Number.isNaN(Number(cur)) ? Math.max(0, Number(cur)) : null;
    // rem = total − phiếu; cur có thể đã trừ hao hụt nhật ký — lấy min để không ghi đè số đúng hơn
    if (rem != null && curN != null) current_fish = Math.min(rem, curN);
    else if (rem != null) current_fish = rem;
  }

  const status = resolveCycleStatus(cycle, {
    current_fish,
    totalActualYield,
    isFullyDone,
  });

  const notes = cycle.notes;
  return {
    actual_yield: totalActualYield,
    harvest_done,
    status,
    fcr,
    current_fish,
    ...(notes !== undefined ? { notes } : {}),
  };
}
