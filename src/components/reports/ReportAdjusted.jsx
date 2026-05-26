/**
 * BÁO CÁO 2: KẾ HOẠCH ĐIỀU CHỈNH
 *
 * Bố cục dạng ma trận theo tháng: mỗi tháng tách 3 cột CC/CT/TH.
 */
import { Fragment } from 'react';
import { originalHarvestDateForReport, plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { parseHarvestDateInput } from '@/lib/harvestDateParse';
import {
  cycleHarvestPlanEligibleForMonthReport,
  harvestMonthIndexForReport,
} from '@/lib/reportMonthHelpers';
import { countCycleRows, uniquePhysicalPondTotalArea } from '@/lib/reportPondDedupe';
import { calculateYieldFromPond } from '@/lib/calculateYield';
import { getFactoryPlanKgByMonth } from '@/lib/appSettingsHelpers';
import {
  reportBanner,
  reportNumCellClass,
  reportTable,
  reportTableScroll,
  reportTdCenter,
  reportTdLeft,
  reportTdTotalLabel,
  reportTh,
  reportThLeft,
  reportThSub,
} from '@/components/reports/reportTableClasses';
import { cn } from '@/lib/utils';

const MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

function systemCodeFromAgencyCode(agencyCode) {
  const digits = String(agencyCode || '').replace(/\D/g, '');
  return digits ? digits : String(agencyCode || '').trim();
}

function parseDate(dateValue) {
  if (dateValue == null || dateValue === '') return null;
  if (typeof dateValue === 'string') {
    const d = parseHarvestDateInput(dateValue.trim());
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isInDateRange(dateValue, fromDate, toDate) {
  const d = parseDate(dateValue);
  if (!d) return false;
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}

function monthIdxFromRange(fromDate, toDate) {
  if (!fromDate || !toDate || fromDate > toDate) return null;
  if (fromDate.getFullYear() !== toDate.getFullYear()) return Array.from({ length: 12 }, (_, i) => i);
  const start = fromDate.getMonth();
  const end = toDate.getMonth();
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function ReportAdjusted({ ponds, agencies, dateFrom, dateTo, appSettings, agencyNameByCode }) {
  const fromDate = parseDate(dateFrom);
  const toDate = parseDate(dateTo);
  const factoryPlan = getFactoryPlanKgByMonth(appSettings);
  const monthIdx = (() => {
    const set = new Set();
    ponds.forEach((p) => {
      const adjustedDate = plannedHarvestDateForDisplay(p);
      if (
        cycleHarvestPlanEligibleForMonthReport(p) &&
        (p.expected_yield || 0) > 0 &&
        adjustedDate &&
        isInDateRange(adjustedDate, fromDate, toDate)
      ) {
        const mi = harvestMonthIndexForReport(p);
        if (mi != null) set.add(mi);
      }
      const d0 = originalHarvestDateForReport(p);
      if (d0 && calculateYieldFromPond(p) > 0 && isInDateRange(d0, fromDate, toDate)) set.add(new Date(d0).getMonth());
    });
    return [...set].sort((a, b) => a - b);
  })();

  const rangeMonths = monthIdxFromRange(fromDate, toDate);
  const visibleMonthIdx = rangeMonths && rangeMonths.length > 0 ? rangeMonths : (monthIdx.length > 0 ? monthIdx : [new Date().getMonth()]);

  const rows = agencies.map((agency) => {
    const agencyPonds = ponds.filter((p) => p.agency_code === agency);
    
    const cycleCount = countCycleRows(agencyPonds);
    const totalArea = uniquePhysicalPondTotalArea(agencyPonds);

    // Đếm theo chu kỳ (mỗi chu kỳ = 1 dòng dữ liệu kế hoạch)
    const cc = agencyPonds.filter((p) => p.status === 'CC');
    const ct = agencyPonds.filter((p) => p.status === 'CT');
    const totalCC = cc.reduce((s, p) => {
      if (!cycleHarvestPlanEligibleForMonthReport(p)) return s;
      const d = plannedHarvestDateForDisplay(p);
      return s + (isInDateRange(d, fromDate, toDate) ? p.expected_yield || 0 : 0);
    }, 0);
    const totalCT = ct.reduce((s, p) => {
      if (!cycleHarvestPlanEligibleForMonthReport(p)) return s;
      const d = plannedHarvestDateForDisplay(p);
      return s + (isInDateRange(d, fromDate, toDate) ? p.expected_yield || 0 : 0);
    }, 0);
    const totalTH = totalCC + totalCT;

    const monthCC = visibleMonthIdx.map((i) =>
      cc.reduce((s, p) => {
        if (!cycleHarvestPlanEligibleForMonthReport(p)) return s;
        const d = plannedHarvestDateForDisplay(p);
        const mi = harvestMonthIndexForReport(p);
        return s + (d && isInDateRange(d, fromDate, toDate) && mi === i ? p.expected_yield || 0 : 0);
      }, 0)
    );
    const monthCT = visibleMonthIdx.map((i) =>
      ct.reduce((s, p) => {
        if (!cycleHarvestPlanEligibleForMonthReport(p)) return s;
        const d = plannedHarvestDateForDisplay(p);
        const mi = harvestMonthIndexForReport(p);
        return s + (d && isInDateRange(d, fromDate, toDate) && mi === i ? p.expected_yield || 0 : 0);
      }, 0)
    );
    const monthTH = monthCC.map((v, i) => v + monthCT[i]);

    const agencyName = agencyNameByCode instanceof Map ? (agencyNameByCode.get(String(agency)) || agency) : agency;
    return { agency, agencyName, ponds: agencyPonds, cycleCount, totalArea, totalCC, totalCT, totalTH, monthCC, monthCT, monthTH };
  });

  const grandTotalCycles = rows.reduce((s, r) => s + r.cycleCount, 0);
  const grandTotalArea = rows.reduce((s, r) => s + r.totalArea, 0);
  const grandTotalCC = rows.reduce((s, r) => s + r.totalCC, 0);
  const grandTotalCT = rows.reduce((s, r) => s + r.totalCT, 0);
  const grandTotalTH = grandTotalCC + grandTotalCT;
  const grandMonthCC = visibleMonthIdx.map((_, i) => rows.reduce((s, r) => s + (r.monthCC[i] || 0), 0));
  const grandMonthCT = visibleMonthIdx.map((_, i) => rows.reduce((s, r) => s + (r.monthCT[i] || 0), 0));
  const grandMonthTH = grandMonthCC.map((v, i) => v + grandMonthCT[i]);
  const factoryMonthTH = visibleMonthIdx.map((mi) => Number(factoryPlan[mi] || 0));
  const deltaMonthTH = grandMonthTH.map((v, i) => v - factoryMonthTH[i]);
  const factoryTotalTH = factoryMonthTH.reduce((s, x) => s + (Number(x) || 0), 0);
  const deltaTotalTH = grandTotalTH - factoryTotalTH;

  const renderNumCell = (value, { bold = false, border = false, cls = '' } = {}) => (
    <td className={reportNumCellClass({ bold, border, extra: cls })}>
      {Number(value) > 0 ? Number(value).toLocaleString() : ''}
    </td>
  );

  const renderSignedCell = (value, { border = false } = {}) => {
    const n = Number(value || 0);
    const cls = n >= 0 ? 'text-green-700' : 'text-red-700';
    return (
      <td className={reportNumCellClass({ bold: true, border, extra: cls })}>
        {n !== 0 ? Math.round(n).toLocaleString() : ''}
      </td>
    );
  };

  return (
    <div>
      <div className={reportBanner}>
        Bảng sắp xếp theo dạng tháng: mỗi tháng gồm <strong>CC</strong>, <strong>CT</strong>, <strong>TH</strong> (tổng) cho kế hoạch điều chỉnh. Cột theo tháng chỉ tính khi có{' '}
        <strong>ngày thả hợp lệ</strong>, có <strong>ngày thu dự kiến</strong> (đã lưu hoặc ước từ thả) và ngày thu không trước ngày thả.
      </div>

      <div className={reportTableScroll}>
        <table className={reportTable}>
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className={cn(reportTh, 'border-r border-border')} rowSpan={2}>
                Mã hệ thống
              </th>
              <th className={cn(reportThLeft, 'border-r border-border')} rowSpan={2}>
                Hệ thống
              </th>
              <th className={cn(reportTh, 'border-r border-border')} rowSpan={2}>
                Số chu kỳ
              </th>
              <th className={cn(reportTh, 'border-r border-border')} rowSpan={2}>
                Diện tích (m²)
              </th>
              {visibleMonthIdx.map((mi) => (
                <th key={mi} className={cn(reportTh, 'border-r border-border')} colSpan={3}>
                  {MONTHS[mi]}
                </th>
              ))}
              <th className={reportTh} colSpan={3}>Tổng</th>
            </tr>
            <tr className="bg-muted/40 border-b border-border">
              {visibleMonthIdx.map((mi) => (
                <Fragment key={mi}>
                  <th className={cn(reportThSub, 'text-right text-blue-700')}>CC</th>
                  <th className={cn(reportThSub, 'text-right text-slate-600')}>CT</th>
                  <th className={cn(reportThSub, 'text-right text-slate-900 border-r border-border')}>TH</th>
                </Fragment>
              ))}
              <th className={cn(reportThSub, 'text-right text-blue-700')}>CC</th>
              <th className={cn(reportThSub, 'text-right text-slate-600')}>CT</th>
              <th className={cn(reportThSub, 'text-right text-slate-900')}>TH</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4 + visibleMonthIdx.length * 3 + 3} className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.agency} className="hover:bg-muted/20">
                  <td className={cn(reportTdCenter, 'border-r border-border')}>
                    {systemCodeFromAgencyCode(r.agency)}
                  </td>
                  <td className={cn(reportTdLeft, 'border-r border-border')}>{r.agencyName}</td>
                  <td className={cn(reportTdCenter, 'border-r border-border')}>{r.cycleCount > 0 ? r.cycleCount : ''}</td>
                  <td className={cn(reportTdCenter, 'text-right border-r border-border')}>{r.totalArea > 0 ? r.totalArea.toLocaleString() : ''}</td>
                  {visibleMonthIdx.map((mi, i) => (
                    <Fragment key={mi}>
                      {renderNumCell(r.monthCC[i])}
                      {renderNumCell(r.monthCT[i])}
                      {renderNumCell(r.monthTH[i], { bold: true, border: true })}
                    </Fragment>
                  ))}
                  {renderNumCell(r.totalCC)}
                  {renderNumCell(r.totalCT)}
                  {renderNumCell(r.totalTH, { bold: true })}
                </tr>
              ))
            )}

            <tr className="bg-primary/5 border-t-2 border-primary/20">
              <td className={cn(reportTdTotalLabel, 'text-center border-r border-border')}>—</td>
              <td className={cn(reportTdTotalLabel, 'border-r border-border')}>Tổng</td>
              <td className="px-3 py-3 text-center border-r border-border">{grandTotalCycles}</td>
              <td className="px-3 py-3 text-right border-r border-border">{grandTotalArea > 0 ? grandTotalArea.toLocaleString() : ''}</td>
              {visibleMonthIdx.map((mi, i) => (
                <Fragment key={mi}>
                  {renderNumCell(grandMonthCC[i])}
                  {renderNumCell(grandMonthCT[i])}
                  {renderNumCell(grandMonthTH[i], { bold: true, border: true })}
                </Fragment>
              ))}
              {renderNumCell(grandTotalCC)}
              {renderNumCell(grandTotalCT)}
              {renderNumCell(grandTotalTH, { bold: true })}
            </tr>

            <tr className="bg-amber-50/40 border-t border-border">
              <td className={cn(reportTdTotalLabel, 'text-center border-r border-border')}>—</td>
              <td className={cn(reportTdTotalLabel, 'border-r border-border')}>
                Sản lượng Nhà máy giao
              </td>
              <td className="px-3 py-2.5 text-center border-r border-border">—</td>
              <td className="px-3 py-2.5 text-right border-r border-border">—</td>
              {visibleMonthIdx.map((mi, i) => (
                <Fragment key={mi}>
                  <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
                  <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
                  <td className={reportNumCellClass({ bold: true, border: true, extra: 'text-amber-700' })}>
                    {factoryMonthTH[i] > 0 ? factoryMonthTH[i].toLocaleString() : ''}
                  </td>
                </Fragment>
              ))}
              <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
              <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
              <td className={reportNumCellClass({ bold: true, extra: 'text-amber-700' })}>{factoryTotalTH > 0 ? factoryTotalTH.toLocaleString() : ''}</td>
            </tr>

            <tr className="bg-amber-50/40">
              <td className={cn(reportTdTotalLabel, 'text-center border-r border-border')}>—</td>
              <td className={cn(reportTdTotalLabel, 'border-r border-border')}>
                Cân đối
              </td>
              <td className="px-3 py-2.5 text-center border-r border-border">—</td>
              <td className="px-3 py-2.5 text-right border-r border-border">—</td>
              {visibleMonthIdx.map((mi, i) => (
                <Fragment key={mi}>
                  <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
                  <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
                  {renderSignedCell(deltaMonthTH[i], { border: true })}
                </Fragment>
              ))}
              <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
              <td className={reportNumCellClass({ extra: 'text-muted-foreground' })} />
              {renderSignedCell(deltaTotalTH)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
