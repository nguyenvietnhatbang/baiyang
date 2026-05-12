import { useMemo } from 'react';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { formatDateDisplay } from '@/lib/dateFormat';
import { harvestRecordsForCycleRow, latestActualHarvestDate } from '@/lib/reportPondDedupe';

function systemCodeFromAgencyCode(agencyCode) {
  const digits = String(agencyCode || '').replace(/\D/g, '');
  return digits ? digits : String(agencyCode || '').trim();
}

export default function ReportDailyProductionPlan({ ponds, harvests, agencyNameByCode }) {
  const pondRowCountByPondId = useMemo(() => {
    const m = new Map();
    for (const r of ponds || []) {
      const k = r.pond_id != null ? String(r.pond_id) : '';
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [ponds]);

  const rows = useMemo(() => {
    const active = (ponds || []).filter((p) => p?.status === 'CC' || plannedHarvestDateForDisplay(p));
    const mapped = active.map((p) => {
      const cyclesOnPond = pondRowCountByPondId.get(String(p.pond_id)) || 1;
      const pondHarvests = harvestRecordsForCycleRow(p, harvests, { cyclesOnSamePond: cyclesOnPond });
      const plannedKg = Number(p.expected_yield) || 0;
      const fromRecords = pondHarvests.reduce((s, h) => s + (Number(h.actual_yield) || 0), 0);
      const fromCycle = Number(p.actual_yield) || 0;
      /** Phiếu thu + đồng bộ trên chu kỳ (lấy max để không mất số khi lệch phiếu / RLS) */
      const actualKg = Math.max(fromRecords, fromCycle);
      const feedKg = Number(p.total_feed_used) || 0;
      const denom = actualKg > 0 ? actualKg : plannedKg;
      const fcrRaw = p.fcr != null ? Number(p.fcr) : (feedKg > 0 && denom > 0 ? feedKg / denom : null);
      const fcr = fcrRaw != null && Number.isFinite(fcrRaw) ? Math.round(fcrRaw * 100) / 100 : null;

      const agency = p.agency_code || '(Chưa phân)';
      const sysName = agencyNameByCode instanceof Map ? (agencyNameByCode.get(String(agency)) || agency) : agency;

      return {
        id: p.id || p.pond_cycle_id || `${p.code || ''}-${p.pond_id || ''}`,
        agency,
        sysCode: systemCodeFromAgencyCode(agency),
        sysName,
        owner: p.owner_name || '—',
        pond: p.code || p.pond_code || '—',
        cycle: p.name || p.cycle_name || '—',
        area: p.area != null ? Number(p.area) : null,
        plannedDate: plannedHarvestDateForDisplay(p),
        actualDate: latestActualHarvestDate(pondHarvests),
        plannedKg,
        actualKg,
        feedKg,
        fcr,
        note: p.notes || '',
      };
    });

    return mapped.sort((a, b) => {
      const bySys = String(a.agency).localeCompare(String(b.agency), 'vi');
      if (bySys !== 0) return bySys;
      const byOwner = String(a.owner).localeCompare(String(b.owner), 'vi');
      if (byOwner !== 0) return byOwner;
      return String(a.pond).localeCompare(String(b.pond), 'vi');
    });
  }, [ponds, harvests, agencyNameByCode, pondRowCountByPondId]);

  const total = useMemo(() => {
    const plannedKg = rows.reduce((s, r) => s + (r.plannedKg || 0), 0);
    const actualKg = rows.reduce((s, r) => s + (r.actualKg || 0), 0);
    const feedKg = rows.reduce((s, r) => s + (r.feedKg || 0), 0);
    const fcr = actualKg > 0 && feedKg > 0 ? Math.round((feedKg / actualKg) * 100) / 100 : null;
    return { plannedKg, actualKg, feedKg, fcr };
  }, [rows]);

  return (
    <div className="overflow-x-auto max-w-full pb-2 [&_table]:border-2 [&_table]:border-slate-400 [&_th]:border-2 [&_th]:border-slate-400 [&_td]:border-2 [&_td]:border-slate-400 dark:[&_table]:border-slate-500 dark:[&_th]:border-slate-500 dark:[&_td]:border-slate-500">
      <table className="w-full min-w-max text-sm font-semibold border-collapse">
        <thead>
          <tr className="bg-muted/60 border-b border-border">
            {[
              'Mã hệ thống',
              'Hệ thống',
              'Hộ nuôi',
              'Ao nuôi',
              'Chu kỳ',
              'Diện tích',
              'Kế hoạch thu (ngày thu kế)',
              'Ngày thu thực tế',
              'Sản lượng Kế hoạch',
              'Sản lượng thực tế',
              'Tổng lượng thức ăn',
              'FCR',
              'Ghi chú',
            ].map((h) => (
              <th key={h} className="px-2 py-2 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border last:border-r-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/20">
              <td className="px-2 py-2 text-center font-bold">{r.sysCode}</td>
              <td className="px-2 py-2 font-bold text-primary">{r.sysName}</td>
              <td className="px-2 py-2 font-semibold whitespace-nowrap">{r.owner}</td>
              <td className="px-2 py-2 font-bold text-primary whitespace-nowrap">{r.pond}</td>
              <td className="px-2 py-2 whitespace-nowrap">{r.cycle}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{r.area != null ? r.area.toLocaleString() : '—'}</td>
              <td className="px-2 py-2 text-center whitespace-nowrap">{formatDateDisplay(r.plannedDate)}</td>
              <td className="px-2 py-2 text-center whitespace-nowrap">{formatDateDisplay(r.actualDate)}</td>
              <td className="px-2 py-2 text-right font-bold whitespace-nowrap">{r.plannedKg > 0 ? r.plannedKg.toLocaleString() : '—'}</td>
              <td className="px-2 py-2 text-right font-extrabold text-green-700 whitespace-nowrap">{r.actualKg > 0 ? r.actualKg.toLocaleString() : '—'}</td>
              <td className="px-2 py-2 text-right font-bold whitespace-nowrap">{r.feedKg > 0 ? r.feedKg.toLocaleString() : '—'}</td>
              <td className="px-2 py-2 text-center font-bold whitespace-nowrap">{r.fcr != null ? r.fcr.toLocaleString() : '—'}</td>
              <td className="px-2 py-2 whitespace-nowrap max-w-[16rem] truncate" title={r.note || ''}>{r.note || ''}</td>
            </tr>
          ))}

          <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
            <td className="px-2 py-2.5 text-center" colSpan={8}>Tổng</td>
            <td className="px-2 py-2.5 text-right font-extrabold whitespace-nowrap">{total.plannedKg > 0 ? total.plannedKg.toLocaleString() : ''}</td>
            <td className="px-2 py-2.5 text-right font-extrabold text-green-700 whitespace-nowrap">{total.actualKg > 0 ? total.actualKg.toLocaleString() : ''}</td>
            <td className="px-2 py-2.5 text-right font-extrabold whitespace-nowrap">{total.feedKg > 0 ? total.feedKg.toLocaleString() : ''}</td>
            <td className="px-2 py-2.5 text-center font-extrabold whitespace-nowrap">{total.fcr != null ? total.fcr.toLocaleString() : ''}</td>
            <td className="px-2 py-2.5" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
