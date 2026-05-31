import { base44 } from '@/api/base44Client';
import { harvestSyncPatchFromRecords } from '@/lib/cycleHarvestCompletion';

const LIST_LIMIT = 8000;

/**
 * Đồng bộ PondCycle từ HarvestRecord:
 * - Tổng actual_yield, harvest_done, FCR (khi có thu), status CT khi đã có thu (và current_fish = 0).
 * - Giữ chốt thủ công: harvest_done + CT + không phiếu thu → không bỏ trạng thái đã thu khi đồng bộ.
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
    const patch = harvestSyncPatchFromRecords(cycle, hs);

    const yMatch = Math.abs(Number(cycle.actual_yield || 0) - patch.actual_yield) < 0.01;
    const dMatch = Boolean(cycle.harvest_done) === Boolean(patch.harvest_done);
    const fMatch =
      (cycle.fcr == null && patch.fcr == null) ||
      (cycle.fcr != null &&
        patch.fcr != null &&
        Math.abs(Number(cycle.fcr) - Number(patch.fcr)) < 0.0001);
    const sMatch = cycle.status === patch.status;
    const fishOk =
      patch.current_fish == null ||
      Math.abs(Number(cycle.current_fish || 0) - Number(patch.current_fish || 0)) < 0.5;

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
  const patch = harvestSyncPatchFromRecords(cycle, harvests);
  await base44.entities.PondCycle.update(cycleId, patch);
  return { cycleId, actual_yield: patch.actual_yield, fcr: patch.fcr };
}
