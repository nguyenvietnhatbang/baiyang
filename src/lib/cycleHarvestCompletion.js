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
  const basis = (Number(cycle?.total_fish) || 0) + (Number(cycle?.stocked_fish_added) || 0);
  const ticketFish = (harvests || []).reduce((s, h) => s + (Number(h.fish_count_harvested) || 0), 0);
  if (ticketFish > 0 && basis > 0) return Math.max(0, basis - ticketFish);
  const cur = cycle?.current_fish;
  if (cur != null && !Number.isNaN(Number(cur))) return Math.max(0, Number(cur));
  return null;
}

/** Tự động sang tab đã thu: đủ kg kế hoạch và hết cá (nếu theo dõi được). */
export function isCycleAutoFullyHarvested(cycle, totalActualKg, harvests) {
  if (!isPlannedKgHarvestComplete(cycle, totalActualKg)) return false;
  const rem = fishRemainingFromHarvests(cycle, harvests);
  return rem == null || rem <= 0;
}

function rowAsCycle(row) {
  return { ...row, notes: row.cycle_notes ?? row.notes };
}

/** Chu kỳ hiển thị tab «Chu kỳ đã thu». */
export function shouldShowCycleOnHarvestedTab(row) {
  if (!row?.cycle_id) return false;
  const cycle = rowAsCycle(row);
  const actualKg = Number(row.actual_harvest_display_kg) || Number(row.actual_yield) || 0;
  if (isLegacyAccidentalPartialClose(cycle, actualKg)) return false;
  if (isCycleManuallyChotThu(cycle)) return true;
  const planned = Number(row.expected_yield) || 0;
  const actual = Number(row.actual_harvest_display_kg) || Number(row.actual_yield) || 0;
  if (planned <= 0) return false;
  if (actual < planned - 0.01) return false;
  const rem = row.fish_remaining;
  if (rem != null && !Number.isNaN(Number(rem)) && Number(rem) > 0) return false;
  if (rem != null && Number(rem) <= 0) return true;
  const cur = row.current_fish;
  if (cur != null && !Number.isNaN(Number(cur)) && Number(cur) > 0) return false;
  return true;
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
    if (rem != null) current_fish = rem;
  }

  let status = cycle.status || 'CT';
  if (isFullyDone) {
    status = 'CT';
  } else if (totalActualYield > 0) {
    status = 'CC';
  }

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
