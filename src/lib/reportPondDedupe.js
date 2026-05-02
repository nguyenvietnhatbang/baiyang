/**
 * Hỗ trợ báo cáo: các hàng "ponds" là chu kỳ (flatten từ pond_cycles),
 * còn số ao vật lý và diện tích chỉ nên đến 1 lần / ao.
 */

/** @param {Array<{ pond_id?: string }>} cycleRows */
export function uniquePhysicalPondCount(cycleRows) {
  const ids = new Set((cycleRows || []).map((p) => p.pond_id).filter(Boolean));
  return ids.size;
}

/** Diện tích tổng: mỗi pond_id cộng area một lần (lấy hàng đầu gặp). */
export function uniquePhysicalPondTotalArea(cycleRows) {
  const seen = new Set();
  let sum = 0;
  for (const row of cycleRows || []) {
    const id = row.pond_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    sum += Number(row.area) || 0;
  }
  return sum;
}

/**
 * Phiếu thu khớp một dòng chu kỳ (ưu tiên pond_cycle_id).
 * @param {object} cycleRow
 * @param {Array} harvests
 */
export function harvestRecordsForCycleRow(cycleRow, harvests) {
  return (harvests || []).filter((h) => {
    if (h.pond_cycle_id && cycleRow.pond_cycle_id) {
      return h.pond_cycle_id === cycleRow.pond_cycle_id;
    }
    if (h.pond_id && cycleRow.pond_id) return h.pond_id === cycleRow.pond_id;
    if (h.pond_code && cycleRow.pond_code) return h.pond_code === cycleRow.pond_code;
    return false;
  });
}

export function totalActualYieldForCycleRow(cycleRow, harvests) {
  return harvestRecordsForCycleRow(cycleRow, harvests).reduce((s, h) => s + (h.actual_yield || 0), 0);
}

/** Ngày thu thực tế gần nhất (max harvest_date, chuỗi yyyy-MM-dd). */
export function latestActualHarvestDate(pondHarvests) {
  const dates = (pondHarvests || []).map((h) => h.harvest_date).filter(Boolean);
  if (!dates.length) return null;
  return dates.reduce((a, b) => (String(a) >= String(b) ? a : b));
}
