import { useMemo } from 'react';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { formatDateDisplay } from '@/lib/dateFormat';
import { harvestRecordsForCycleRow, latestActualHarvestDate } from '@/lib/reportPondDedupe';
import {
  reportTable,
  reportTableScroll,
  reportTd,
  reportTdCenter,
  reportTdLeft,
  reportTdCode,
  reportTdRight,
  reportTdBoldRight,
  reportTh,
  reportThLast,
} from './reportTableClasses';
import { cn } from '@/lib/utils';

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
      const actualKg = Math.max(fromRecords, fromCycle);
      const feedKg = Number(p.total_feed_used) || 0;
      const denom = actualKg > 0 ? actualKg : plannedKg;
      const fcrRaw = p.fcr != null ? Number(p.fcr) : (feedKg > 0 && denom > 0 ? feedKg / denom : null);
      const fcr = fcrRaw != null && Number.isFinite(fcrRaw) ? Math.round(fcrRaw * 100) / 100 : null;

      const agency = p.agency_code || '(Chưa phân)';
      const sysName = agencyNameByCode instanceof Map ? (agencyNameByCode.get(String(agency)) || agency) : agency;

      return {
        id: p.pond_cycle_id || p.id || `${p.pond_code || p.code || ''}-${p.pond_id || ''}`,
        agency,
        sysCode: systemCodeFromAgencyCode(agency),
        sysName,
        owner: p.owner_name || '—',
        pond: p.pond_code || p.code || '—',
        cycle: p.cycle_label || p.cycle_name || p.name || '—',
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

  const headers = [
    'Mã hệ thống',
    'Hệ thống',
    'Hộ nuôi',
    'Ao nuôi',
    'Chu kỳ',
    'Diện tích',
    'Kế hoạch thu (ngày thu kế)',
    'Ngày thu thực tế',
    'Sản lượng Kế hoạch (ban đầu)',
    'Sản lượng thực tế',
    'Tổng lượng thức ăn',
    'FCR',
    'Ghi chú',
  ];

  return (
    <div className={reportTableScroll}>
      <table className={reportTable}>
        <thead>
          <tr className="bg-muted/60 border-b border-border">
            {headers.map((h, i) => (
              <th
                key={h}
                className={i < headers.length - 1 ? reportTh : cn(reportThLast, 'border-r-0')}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/20">
              <td className={reportTdCenter}>{r.sysCode}</td>
              <td className={reportTdLeft}>{r.sysName}</td>
              <td className={reportTdLeft}>{r.owner}</td>
              <td className={reportTdCode}>{r.pond}</td>
              <td className={reportTdCenter}>{r.cycle}</td>
              <td className={reportTdRight}>{r.area != null ? r.area.toLocaleString() : '—'}</td>
              <td className={reportTdCenter}>{formatDateDisplay(r.plannedDate)}</td>
              <td className={reportTdCenter}>{formatDateDisplay(r.actualDate)}</td>
              <td className={reportTdRight}>{r.plannedKg > 0 ? r.plannedKg.toLocaleString() : '—'}</td>
              <td className={reportTdRight}>{r.actualKg > 0 ? r.actualKg.toLocaleString() : '—'}</td>
              <td className={reportTdRight}>{r.feedKg > 0 ? r.feedKg.toLocaleString() : '—'}</td>
              <td className={reportTdCenter}>{r.fcr != null ? r.fcr.toLocaleString() : '—'}</td>
              <td className={cn(reportTd, 'max-w-[16rem] truncate')} title={r.note || ''}>
                {r.note || ''}
              </td>
            </tr>
          ))}

          <tr className="bg-primary/5 border-t-2 border-primary/20">
            <td className={cn(reportTdCenter, 'report-table-total')} colSpan={8}>
              Tổng
            </td>
            <td className={reportTdBoldRight}>{total.plannedKg > 0 ? total.plannedKg.toLocaleString() : ''}</td>
            <td className={reportTdBoldRight}>{total.actualKg > 0 ? total.actualKg.toLocaleString() : ''}</td>
            <td className={reportTdBoldRight}>{total.feedKg > 0 ? total.feedKg.toLocaleString() : ''}</td>
            <td className={cn(reportTdCenter, 'report-table-total')}>
              {total.fcr != null ? total.fcr.toLocaleString() : ''}
            </td>
            <td className={reportTd} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
