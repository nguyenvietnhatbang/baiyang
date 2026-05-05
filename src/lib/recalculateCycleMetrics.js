import { base44 } from '@/api/base44Client';
import { calculateCurrentYield } from '@/lib/calculateYield';

export async function recalculateCycleMetrics(cycleId) {
  if (!cycleId) return;

  const cycleRows = await base44.entities.PondCycle.filter({ id: cycleId }, '-updated_at', 1);
  const cycle = cycleRows?.[0];
  if (!cycle) return;

  const logs = await base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', 2500);
  const harvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: cycleId }, '-harvest_date', 2500);

  const totalFeedUsed = logs.reduce((sum, l) => sum + (Number(l.feed_amount) || 0), 0);
  const totalDeadFish = logs.reduce((sum, l) => sum + (Number(l.dead_fish) || 0), 0);

  const baselineFish = Number(cycle.total_fish ?? cycle.current_fish ?? 0) || 0;
  const newCurrentFish = Math.max(0, baselineFish - totalDeadFish);

  const expectedYield = calculateCurrentYield({
    ...cycle,
    current_fish: newCurrentFish,
  });

  const totalActualYield = harvests.reduce((sum, h) => sum + (Number(h.actual_yield) || 0), 0);

  let fcr = null;
  if (totalFeedUsed > 0 && totalActualYield > 0) {
    fcr = Math.round((totalFeedUsed / totalActualYield) * 100) / 100;
  } else if (totalFeedUsed > 0 && expectedYield > 0) {
    fcr = Math.round((totalFeedUsed / expectedYield) * 100) / 100;
  }

  await base44.entities.PondCycle.update(cycleId, {
    total_feed_used: totalFeedUsed,
    current_fish: newCurrentFish,
    expected_yield: expectedYield,
    actual_yield: totalActualYield,
    harvest_done: totalActualYield > 0,
    status: totalActualYield > 0 ? 'CT' : (newCurrentFish > 0 ? 'CC' : 'CT'),
    fcr,
  });
}
