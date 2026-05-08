/**
 * BÁO CÁO 1: KẾ HOẠCH BAN ĐẦU (GỐC)
 *
 * Bố cục dạng ma trận theo tháng: mỗi tháng tách 3 cột CC/CT/TH.
 */
import { Fragment } from 'react';
import { originalHarvestDateForReport } from '@/lib/planReportHelpers';
import { uniquePhysicalPondCount, uniquePhysicalPondTotalArea } from '@/lib/reportPondDedupe';
import { calculateYieldFromPond, calcOriginalYieldKg } from '@/lib/calculateYield';
import { getFactoryPlanKgByMonth } from '@/lib/appSettingsHelpers';

/** Alias — tránh ReferenceError nếu bundle cũ / nhánh code còn gọi tên cũ */
const calcOriginalYield = (p) => calcOriginalYieldKg(p);

const MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

function systemCodeFromAgencyCode(agencyCode) {
  const digits = String(agencyCode || '').replace(/\D/g, '');
  return digits ? digits : String(agencyCode || '').trim();
}

function parseDate(dateValue) {
  if (!dateValue) return null;
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

export default function ReportOriginal({ ponds, agencies, dateFrom, dateTo, appSettings, agencyNameByCode }) {
  const fromDate = parseDate(dateFrom);
  const toDate = parseDate(dateTo);
  const factoryPlan = getFactoryPlanKgByMonth(appSettings);
  const monthIdx = (() => {
    const set = new Set();
    ponds.forEach((p) => {
      const d = originalHarvestDateForReport(p);
      if (!d) return;
      if (!isInDateRange(d, fromDate, toDate)) return;
      const y = calculateYieldFromPond(p);
      if (y > 0) set.add(new Date(d).getMonth());
    });
    return [...set].sort((a, b) => a - b);
  })();

  const rangeMonths = monthIdxFromRange(fromDate, toDate);
  const visibleMonthIdx = rangeMonths && rangeMonths.length > 0 ? rangeMonths : (monthIdx.length > 0 ? monthIdx : [new Date().getMonth()]);

  const allAgencyRows = agencies.map((agency) => {
    const agencyPonds = ponds.filter((p) => p.agency_code === agency);
    
    const pondCount = uniquePhysicalPondCount(agencyPonds);
    const totalArea = uniquePhysicalPondTotalArea(agencyPonds);

    // Đếm theo chu kỳ (mỗi chu kỳ = 1 dòng dữ liệu kế hoạch)
    const cc = agencyPonds.filter((p) => p.status === 'CC');
    const ct = agencyPonds.filter((p) => p.status === 'CT');
    const totalCC = cc.reduce((s, p) => {
      const d = originalHarvestDateForReport(p);
      return s + (isInDateRange(d, fromDate, toDate) ? calculateYieldFromPond(p) : 0);
    }, 0);
    const totalCT = ct.reduce((s, p) => {
      const d = originalHarvestDateForReport(p);
      return s + (isInDateRange(d, fromDate, toDate) ? calculateYieldFromPond(p) : 0);
    }, 0);
    const totalAll = totalCC + totalCT;

    const monthCC = visibleMonthIdx.map((i) =>
      cc.reduce((s, p) => {
        const d = originalHarvestDateForReport(p);
        return s + (d && isInDateRange(d, fromDate, toDate) && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
      }, 0)
    );
    const monthCT = visibleMonthIdx.map((i) =>
      ct.reduce((s, p) => {
        const d = originalHarvestDateForReport(p);
        return s + (d && isInDateRange(d, fromDate, toDate) && new Date(d).getMonth() === i ? calculateYieldFromPond(p) : 0);
      }, 0)
    );

    const monthTH = monthCC.map((v, i) => v + monthCT[i]);

    const agencyName = agencyNameByCode instanceof Map ? (agencyNameByCode.get(String(agency)) || agency) : agency;
    return { agency, agencyName, ponds: agencyPonds, pondCount, totalArea, totalCC, totalCT, totalAll, monthCC, monthCT, monthTH };
  });

  const grandTotalCC = allAgencyRows.reduce((s, r) => s + r.totalCC, 0);
  const grandTotalCT = allAgencyRows.reduce((s, r) => s + r.totalCT, 0);
  const grandTotalAll = grandTotalCC + grandTotalCT;
  const grandTotalPonds = allAgencyRows.reduce((s, r) => s + r.pondCount, 0);
  const grandTotalArea = allAgencyRows.reduce((s, r) => s + r.totalArea, 0);
  const grandMonthCC = visibleMonthIdx.map((_, i) => allAgencyRows.reduce((s, r) => s + (r.monthCC[i] || 0), 0));
  const grandMonthCT = visibleMonthIdx.map((_, i) => allAgencyRows.reduce((s, r) => s + (r.monthCT[i] || 0), 0));
  const grandMonthTH = grandMonthCC.map((v, i) => v + grandMonthCT[i]);
  const factoryMonthTH = visibleMonthIdx.map((mi) => Number(factoryPlan[mi] || 0));
  const deltaMonthTH = grandMonthTH.map((v, i) => v - factoryMonthTH[i]);
  const factoryTotalTH = factoryMonthTH.reduce((s, x) => s + (Number(x) || 0), 0);
  const deltaTotalTH = grandTotalAll - factoryTotalTH;

  const renderNumCell = (value, { bold = false, border = false, cls = '' } = {}) => (
    <td className={`px-2 py-2 text-right text-xs ${bold ? 'font-bold' : ''} ${cls} ${border ? 'border-r border-border' : ''}`}>
      {Number(value) > 0 ? Number(value).toLocaleString() : ''}
    </td>
  );

  const renderSignedCell = (value, { border = false } = {}) => {
    const n = Number(value || 0);
    const cls = n >= 0 ? 'text-green-700' : 'text-red-700';
    return (
      <td className={`px-2 py-2 text-right text-xs font-bold ${cls} ${border ? 'border-r border-border' : ''}`}>
        {n !== 0 ? Math.round(n).toLocaleString() : ''}
      </td>
    );
  };

  return (
    <div>
      <div className="px-5 py-3.5 bg-muted/30 border-b border-border text-sm text-muted-foreground font-semibold">
        Bảng sắp xếp theo dạng tháng: mỗi tháng gồm <strong>CC</strong>, <strong>CT</strong>, <strong>TH</strong> (tổng).
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="text-center px-3 py-3 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Mã hệ thống
              </th>
              <th className="text-left px-3 py-3 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Hệ thống
              </th>
              <th className="text-center px-3 py-3 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Số lượng ao nuôi
              </th>
              <th className="text-center px-3 py-3 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Diện tích (m²)
              </th>
              {visibleMonthIdx.map((mi) => (
                <th key={mi} className="text-center px-2 py-3 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" colSpan={3}>
                  {MONTHS[mi]}
                </th>
              ))}
              <th className="text-center px-2 py-3 font-extrabold text-slate-700 uppercase whitespace-nowrap" colSpan={3}>Tổng</th>
            </tr>
            <tr className="bg-muted/40 border-b border-border">
              {visibleMonthIdx.map((mi) => (
                <Fragment key={mi}>
                  <th className="text-right px-2 py-2.5 font-bold text-blue-700 whitespace-nowrap">CC</th>
                  <th className="text-right px-2 py-2.5 font-bold text-slate-600 whitespace-nowrap">CT</th>
                  <th className="text-right px-2 py-2.5 font-extrabold text-slate-900 whitespace-nowrap border-r border-border">TH</th>
                </Fragment>
              ))}
              <th className="text-right px-2 py-2.5 font-bold text-blue-700 whitespace-nowrap">CC</th>
              <th className="text-right px-2 py-2.5 font-bold text-slate-600 whitespace-nowrap">CT</th>
              <th className="text-right px-2 py-2.5 font-extrabold text-slate-900 whitespace-nowrap">TH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allAgencyRows.length === 0 ? (
              <tr>
                <td colSpan={4 + visibleMonthIdx.length * 3 + 3} className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              allAgencyRows.map((r) => (
                <tr key={r.agency} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-700 border-r border-border whitespace-nowrap">
                    {systemCodeFromAgencyCode(r.agency)}
                  </td>
                  <td className="px-3 py-2.5 text-left font-semibold text-primary border-r border-border whitespace-nowrap">
                    {r.agencyName}
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-border">{r.pondCount > 0 ? r.pondCount : ''}</td>
                  <td className="px-3 py-2.5 text-right border-r border-border">{r.totalArea > 0 ? r.totalArea.toLocaleString() : ''}</td>
                  {visibleMonthIdx.map((mi, i) => (
                    <Fragment key={mi}>
                      {renderNumCell(r.monthCC[i])}
                      {renderNumCell(r.monthCT[i])}
                      {renderNumCell(r.monthTH[i], { bold: true, border: true })}
                    </Fragment>
                  ))}
                  {renderNumCell(r.totalCC)}
                  {renderNumCell(r.totalCT)}
                  {renderNumCell(r.totalAll, { bold: true })}
                </tr>
              ))
            )}

            <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
              <td className="px-3 py-3 text-center font-bold text-foreground border-r border-border">—</td>
              <td className="px-3 py-3 text-left font-bold text-foreground border-r border-border">Tổng</td>
              <td className="px-3 py-3 text-center border-r border-border">{grandTotalPonds}</td>
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
              {renderNumCell(grandTotalAll, { bold: true })}
            </tr>

            <tr className="bg-amber-50/40 border-t border-border">
              <td className="px-3 py-2.5 text-center font-bold text-foreground border-r border-border">—</td>
              <td className="px-3 py-2.5 text-left font-bold text-foreground border-r border-border whitespace-nowrap">
                Sản lượng Nhà máy giao
              </td>
              <td className="px-3 py-2.5 text-center border-r border-border">—</td>
              <td className="px-3 py-2.5 text-right border-r border-border">—</td>
              {visibleMonthIdx.map((mi, i) => (
                <Fragment key={mi}>
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
                  <td className="px-2 py-2 text-right text-xs font-bold text-amber-700 border-r border-border">
                    {factoryMonthTH[i] > 0 ? factoryMonthTH[i].toLocaleString() : ''}
                  </td>
                </Fragment>
              ))}
              <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
              <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
              <td className="px-2 py-2 text-right text-xs font-bold text-amber-700">{factoryTotalTH > 0 ? factoryTotalTH.toLocaleString() : ''}</td>
            </tr>

            <tr className="bg-amber-50/40">
              <td className="px-3 py-2.5 text-center font-bold text-foreground border-r border-border">—</td>
              <td className="px-3 py-2.5 text-left font-bold text-foreground border-r border-border whitespace-nowrap">
                Cân đối
              </td>
              <td className="px-3 py-2.5 text-center border-r border-border">—</td>
              <td className="px-3 py-2.5 text-right border-r border-border">—</td>
              {visibleMonthIdx.map((mi, i) => (
                <Fragment key={mi}>
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
                  {renderSignedCell(deltaMonthTH[i], { border: true })}
                </Fragment>
              ))}
              <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
              <td className="px-2 py-2 text-right text-xs text-muted-foreground" />
              {renderSignedCell(deltaTotalTH)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
