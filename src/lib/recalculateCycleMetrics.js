import { base44 } from '@/api/base44Client';
import { calculateCurrentYield } from '@/lib/calculateYield';

const LIST_LIMIT = 8000;

/** Tính chỉ số chu kỳ từ danh sách nhật ký + phiếu thu (không ghi DB). */
export function metricsPatchFromLogs(cycle, logs, harvests) {
  const logRows = logs || [];
  const harvestRows = harvests || [];

  const totalFeedUsed = logRows.reduce((sum, l) => sum + (Number(l.feed_amount) || 0), 0);
  const totalStockedFish = logRows.reduce((sum, l) => sum + (Number(l.stocked_fish) || 0), 0);
  const totalDeadFish = logRows.reduce((sum, l) => sum + (Number(l.dead_fish) || 0), 0);

  const baselineFish = Number(cycle.total_fish ?? cycle.current_fish ?? 0) || 0;
  const newCurrentFish = Math.max(0, baselineFish + totalStockedFish - totalDeadFish);

  const expectedYield = calculateCurrentYield({
    ...cycle,
    current_fish: newCurrentFish,
  });

  const totalActualYield = harvestRows.reduce((sum, h) => sum + (Number(h.actual_yield) || 0), 0);

  let fcr = null;
  if (totalFeedUsed > 0 && totalActualYield > 0) {
    fcr = Math.round((totalFeedUsed / totalActualYield) * 100) / 100;
  } else if (totalFeedUsed > 0 && expectedYield > 0) {
    fcr = Math.round((totalFeedUsed / expectedYield) * 100) / 100;
  }

  const isHarvested = totalActualYield > 0;

  return {
    total_feed_used: totalFeedUsed,
    current_fish: newCurrentFish,
    expected_yield: expectedYield,
    actual_yield: totalActualYield,
    harvest_done: isHarvested,
    status: isHarvested ? 'CT' : newCurrentFish > 0 ? 'CC' : 'CT',
    fcr,
  };
}

function cycleMetricsDiffer(cycle, patch) {
  const n = (v) => (v == null || v === '' ? null : Number(v));
  if (Math.abs(n(cycle.total_feed_used) - n(patch.total_feed_used)) > 0.001) return true;
  if (Math.abs(n(cycle.current_fish) - n(patch.current_fish)) > 0.5) return true;
  if (Math.abs(n(cycle.expected_yield) - n(patch.expected_yield)) > 0.5) return true;
  if (Math.abs(n(cycle.actual_yield) - n(patch.actual_yield)) > 0.01) return true;
  if (Boolean(cycle.harvest_done) !== Boolean(patch.harvest_done)) return true;
  if (String(cycle.status || '') !== String(patch.status || '')) return true;
  const cf = cycle.fcr;
  const pf = patch.fcr;
  if (cf == null && pf == null) return false;
  if (cf == null || pf == null) return true;
  return Math.abs(Number(cf) - Number(pf)) > 0.0001;
}

export async function recalculateCycleMetrics(cycleId) {
  if (!cycleId) return;

  const cycleRows = await base44.entities.PondCycle.filter({ id: cycleId }, '-updated_at', 1);
  const cycle = cycleRows?.[0];
  if (!cycle) return;

  const logs = await base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', LIST_LIMIT);
  const harvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: cycleId }, '-harvest_date', LIST_LIMIT);

  const patch = metricsPatchFromLogs(cycle, logs, harvests);
  await base44.entities.PondCycle.update(cycleId, patch);
}

/**
 * Cập nhật mọi chu kỳ từ nhật ký + phiếu thu (số cá, thức ăn, SL dự kiến, FCR…).
 */
export async function recalculateAllCycleMetricsFromLogs() {
  const [cycles, allLogs, allHarvests] = await Promise.all([
    base44.entities.PondCycle.list('-updated_date', LIST_LIMIT),
    base44.entities.PondLog.list('-log_date', LIST_LIMIT),
    base44.entities.HarvestRecord.list('-harvest_date', LIST_LIMIT),
  ]);

  const logsByCycle = new Map();
  for (const l of allLogs || []) {
    const cid = l?.pond_cycle_id;
    if (!cid) continue;
    const k = String(cid);
    if (!logsByCycle.has(k)) logsByCycle.set(k, []);
    logsByCycle.get(k).push(l);
  }

  const harvestsByCycle = new Map();
  for (const h of allHarvests || []) {
    const cid = h?.pond_cycle_id;
    if (!cid) continue;
    const k = String(cid);
    if (!harvestsByCycle.has(k)) harvestsByCycle.set(k, []);
    harvestsByCycle.get(k).push(h);
  }

  let updatedCount = 0;
  for (const cycle of cycles || []) {
    const cid = String(cycle.id);
    const patch = metricsPatchFromLogs(cycle, logsByCycle.get(cid) || [], harvestsByCycle.get(cid) || []);
    if (!cycleMetricsDiffer(cycle, patch)) continue;
    await base44.entities.PondCycle.update(cycle.id, patch);
    updatedCount += 1;
  }

  return {
    totalCycles: (cycles || []).length,
    updatedCount,
    logCount: (allLogs || []).length,
  };
}
