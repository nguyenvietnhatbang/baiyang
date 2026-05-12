import { base44 } from '@/api/base44Client';
import { computeFcr } from '@/lib/fcr';

const LIST_LIMIT = 8000;

/**
 * Đồng bộ PondCycle từ HarvestRecord:
 * - Tổng actual_yield, harvest_done, FCR (khi có thu), status CT khi đã có thu (và current_fish = 0).
 * - Gộp phiếu theo pond_cycle_id; phiếu không có chu kỳ nhưng có ao → chỉ gán khi ao có đúng 1 chu kỳ.
 */
export async function syncPondCyclesWithHarvests() {
  const allCycles = await base44.entities.PondCycle.list('-updated_date', LIST_LIMIT);
  const allHarvests = await base44.entities.HarvestRecord.list('-harvest_date', LIST_LIMIT);

  const cyclesByPond = new Map();
  for (const c of allCycles) {
    const pid = c.pond_id != null ? String(c.pond_id) : '';
    if (!pid) continue;
    if (!cyclesByPond.has(pid)) cyclesByPond.set(pid, []);
    cyclesByPond.get(pid).push(c);
  }

  const byCycleId = new Map();
  for (const h of allHarvests) {
    const cid = h.pond_cycle_id != null ? String(h.pond_cycle_id) : '';
    if (!cid) continue;
    if (!byCycleId.has(cid)) byCycleId.set(cid, []);
    byCycleId.get(cid).push(h);
  }

  for (const h of allHarvests) {
    if (h.pond_cycle_id) continue;
    const pid = h.pond_id != null ? String(h.pond_id) : '';
    if (!pid) continue;
    const siblings = cyclesByPond.get(pid) || [];
    if (siblings.length !== 1) continue;
    const onlyId = String(siblings[0].id);
    if (!byCycleId.has(onlyId)) byCycleId.set(onlyId, []);
    byCycleId.get(onlyId).push(h);
  }

  let updatedCount = 0;

  for (const cycle of allCycles) {
    const hs = byCycleId.get(String(cycle.id)) || [];
    const totalActualYield = hs.reduce((sum, x) => sum + (Number(x.actual_yield) || 0), 0);
    const isHarvested = totalActualYield > 0;

    let fcr = null;
    if (cycle.total_feed_used && totalActualYield > 0) {
      fcr = computeFcr(cycle.total_feed_used, totalActualYield);
    }

    const nextStatus = isHarvested ? 'CT' : cycle.status;
    const patch = {
      actual_yield: totalActualYield,
      harvest_done: isHarvested,
      fcr,
      status: nextStatus,
      ...(isHarvested ? { current_fish: 0 } : {}),
    };

    const yMatch = Math.abs(Number(cycle.actual_yield || 0) - totalActualYield) < 0.01;
    const dMatch = Boolean(cycle.harvest_done) === isHarvested;
    const fMatch =
      (cycle.fcr == null && fcr == null) ||
      (cycle.fcr != null &&
        fcr != null &&
        Math.abs(Number(cycle.fcr) - Number(fcr)) < 0.0001);
    const sMatch = cycle.status === nextStatus;
    const fishOk = !isHarvested || Number(cycle.current_fish || 0) === 0;

    if (yMatch && dMatch && fMatch && sMatch && fishOk) continue;

    await base44.entities.PondCycle.update(cycle.id, patch);
    updatedCount++;
  }

  return {
    totalCycles: allCycles.length,
    updatedCount,
    totalHarvests: allHarvests.length,
  };
}

async function getPondCycleById(id) {
  if (!id) return null;
  const rows = await base44.entities.PondCycle.filter({ id }, '-updated_at', 1);
  return rows?.[0] || null;
}

/**
 * Tính toán lại FCR cho một chu kỳ cụ thể
 */
export async function recalculateFcrForCycle(cycleId) {
  const cycle = await getPondCycleById(cycleId);
  if (!cycle) {
    throw new Error(`Không tìm thấy chu kỳ ${cycleId}`);
  }

  const harvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: cycleId });
  const totalActualYield = harvests.reduce((sum, h) => sum + (h.actual_yield || 0), 0);

  let fcr = null;
  if (cycle.total_feed_used && totalActualYield > 0) {
    fcr = computeFcr(cycle.total_feed_used, totalActualYield);
  }

  await base44.entities.PondCycle.update(cycleId, {
    actual_yield: totalActualYield,
    harvest_done: totalActualYield > 0,
    fcr,
    status: totalActualYield > 0 ? 'CT' : cycle.status,
  });

  return { cycleId, actual_yield: totalActualYield, fcr };
}
