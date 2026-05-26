import {
  harvestTicketMatchesFilterMonthYear,
  harvestTicketMatchesFilterYear,
  harvestTicketMonthYear,
} from '@/lib/reportMonthHelpers';

/** Mã đại lý / hệ thống thống nhất khi so khớp (02 = 2). */
export function normalizeReportAgencyCode(code) {
  const digits = String(code ?? '').replace(/\D/g, '');
  if (digits) return digits.padStart(2, '0');
  return String(code ?? '').trim();
}

export function buildCycleAgencyByCycleId(cycleRows) {
  const m = new Map();
  for (const r of cycleRows || []) {
    const id = r?.pond_cycle_id != null ? String(r.pond_cycle_id) : '';
    if (!id) continue;
    const ac = normalizeReportAgencyCode(r.agency_code);
    if (ac) m.set(id, ac);
  }
  return m;
}

/** Đại lý của phiếu thu: ưu tiên chu kỳ gắn phiếu, không thì agency_code trên phiếu. */
export function harvestAgencyForReport(harvest, cycleAgencyByCycleId) {
  const cid = harvest?.pond_cycle_id != null ? String(harvest.pond_cycle_id) : '';
  if (cid && cycleAgencyByCycleId?.has(cid)) {
    return cycleAgencyByCycleId.get(cid);
  }
  return normalizeReportAgencyCode(harvest?.agency_code);
}

/**
 * Cộng kg thực hiện theo đại lý + tháng (0–11) từ danh sách phiếu đã lọc.
 * Mỗi phiếu chỉ cộng một lần — không lặp theo số dòng chu kỳ.
 */
export function sumActualKgByAgencyMonth(harvests, cycleRows, { yearFilter, monthFilter = 'all' }) {
  const cycleAgency = buildCycleAgencyByCycleId(cycleRows);
  const byAgency = new Map();

  for (const h of harvests || []) {
    const agency = harvestAgencyForReport(h, cycleAgency);
    if (!agency) continue;
    if (!harvestTicketMatchesFilterYear(h.harvest_date, yearFilter)) continue;
    const ty = harvestTicketMonthYear(h.harvest_date);
    if (!ty) continue;
    if (monthFilter !== 'all' && ty.month !== Number(monthFilter)) continue;

    if (!byAgency.has(agency)) {
      byAgency.set(agency, Array.from({ length: 12 }, () => 0));
    }
    byAgency.get(agency)[ty.month] += Number(h.actual_yield) || 0;
  }

  return byAgency;
}
