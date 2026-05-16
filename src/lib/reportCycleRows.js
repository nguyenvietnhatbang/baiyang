import { cycleDisplayLabel } from '@/lib/pondCycleHelpers';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { countCycleRows as countRows, harvestRecordsForCycleRow } from '@/lib/reportPondDedupe';

export { countRows as countCycleRows };

/**
 * Mỗi phần tử = một chu kỳ (pond_cycles), kèm thông tin ao/hộ.
 * Báo cáo luôn dùng mảng này — không gộp theo ao.
 */
export function flattenPondsToCycleRows(ponds) {
  return (ponds || []).flatMap((pond) => {
    const cycles = Array.isArray(pond.pond_cycles) ? pond.pond_cycles : [];
    if (cycles.length === 0) return [];
    return cycles.map((cycle, idx) => {
      const cycleLabel = cycleDisplayLabel(cycle, idx);
      return {
        ...pond,
        ...cycle,
        id: cycle.id,
        pond_id: pond.id,
        pond_code: pond.code,
        code: pond.code,
        cycle_label: cycleLabel,
        cycle_name: cycle.name || cycleLabel,
        pond_cycle_id: cycle.id,
        expected_harvest_date: plannedHarvestDateForDisplay(cycle),
      };
    });
  });
}

/** pond_id → số chu kỳ đang có trong phạm vi báo cáo */
export function cycleCountByPondId(cycleRows) {
  const m = new Map();
  for (const r of cycleRows || []) {
    const k = r.pond_id != null ? String(r.pond_id) : '';
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/**
 * Phiếu thu thuộc phạm vi chu kỳ đang xem.
 * Chỉ gán theo ao khi đúng một chu kỳ của ao đó nằm trong phạm vi.
 */
export function filterHarvestsForCycleScope(harvests, cycleRows) {
  const cycleIds = new Set(
    (cycleRows || []).map((r) => String(r.pond_cycle_id)).filter((id) => id && id !== 'undefined')
  );
  const pondIds = new Set(
    (cycleRows || []).map((r) => String(r.pond_id)).filter((id) => id && id !== 'undefined')
  );
  const pondCodes = new Set(
    (cycleRows || []).map((r) => r.pond_code).filter(Boolean).map((c) => String(c).trim())
  );
  const perPond = cycleCountByPondId(cycleRows);

  return (harvests || []).filter((h) => {
    const cid = h.pond_cycle_id != null ? String(h.pond_cycle_id) : '';
    const pid = h.pond_id != null ? String(h.pond_id) : '';
    const pc = h.pond_code != null ? String(h.pond_code).trim() : '';

    if (cid && cycleIds.has(cid)) return true;

    const n = pid ? perPond.get(pid) || 0 : 0;
    if (n !== 1) return false;

    if (pid && pondIds.has(pid)) return true;
    if (pc && pondCodes.has(pc)) return true;
    return false;
  });
}

/** Tổng kg thu thực tế — cộng theo từng chu kỳ, không nhân đôi theo ao. */
export function sumActualYieldForCycleRows(cycleRows, harvests) {
  const perPond = cycleCountByPondId(cycleRows);
  return (cycleRows || []).reduce((sum, row) => {
    const n = perPond.get(String(row.pond_id)) || 1;
    const fromRecords = harvestRecordsForCycleRow(row, harvests, { cyclesOnSamePond: n }).reduce(
      (s, h) => s + (Number(h.actual_yield) || 0),
      0
    );
    const fromCycle = Number(row.actual_yield) || 0;
    return sum + Math.max(fromRecords, fromCycle);
  }, 0);
}
