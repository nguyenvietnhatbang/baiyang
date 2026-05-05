/**
 * BÁO CÁO 1: KẾ HOẠCH BAN ĐẦU (GỐC)
 *
 * Bố cục dạng ma trận theo tháng: mỗi tháng tách 3 cột CC/CT/TH.
 */
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { originalHarvestDateForReport } from '@/lib/planReportHelpers';
import { uniquePhysicalPondCount, uniquePhysicalPondTotalArea } from '@/lib/reportPondDedupe';
import { calculateYieldFromPond, calcOriginalYieldKg } from '@/lib/calculateYield';

/** Alias — tránh ReferenceError nếu bundle cũ / nhánh code còn gọi tên cũ */
const calcOriginalYield = (p) => calcOriginalYieldKg(p);

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

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

export default function ReportOriginal({ ponds, agencies, dateFrom, dateTo }) {
  const fromDate = parseDate(dateFrom);
  const toDate = parseDate(dateTo);
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
    const uniquePonds = [];
    const seenPondIds = new Set();
    agencyPonds.forEach((p) => {
      const pid = p.pond_id || p.id;
      if (!pid || seenPondIds.has(pid)) return;
      seenPondIds.add(pid);
      uniquePonds.push({ id: pid, code: p.pond_code || p.code || '—' });
    });
    
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

    return { agency, ponds: agencyPonds, uniquePonds, pondCount, totalArea, totalCC, totalCT, totalAll, monthCC, monthCT, monthTH };
  });

  const grandTotalCC = allAgencyRows.reduce((s, r) => s + r.totalCC, 0);
  const grandTotalCT = allAgencyRows.reduce((s, r) => s + r.totalCT, 0);
  const grandTotalAll = grandTotalCC + grandTotalCT;
  const grandTotalPonds = allAgencyRows.reduce((s, r) => s + r.pondCount, 0);
  const grandTotalArea = allAgencyRows.reduce((s, r) => s + r.totalArea, 0);
  const grandMonthCC = visibleMonthIdx.map((_, i) => allAgencyRows.reduce((s, r) => s + (r.monthCC[i] || 0), 0));
  const grandMonthCT = visibleMonthIdx.map((_, i) => allAgencyRows.reduce((s, r) => s + (r.monthCT[i] || 0), 0));
  const grandMonthTH = grandMonthCC.map((v, i) => v + grandMonthCT[i]);

  const renderKgCell = (value, highlight = false) => (
    <td className={`px-2 py-2 text-right text-xs ${highlight ? 'font-bold text-foreground' : 'text-foreground'}`}>
      {value > 0 ? value.toLocaleString() : ''}
    </td>
  );

  return (
    <div>
      <div className="px-5 py-3 bg-muted/30 border-b border-border text-xs text-muted-foreground">
        Bảng sắp xếp theo dạng tháng: mỗi tháng gồm <strong>CC</strong>, <strong>CT</strong>, <strong>TH</strong> (tổng).
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th
                className="sticky left-0 bg-muted/60 text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap border-r border-border"
                rowSpan={2}
              >
                Hệ thống
              </th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Số ao
              </th>
              <th
                className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border"
                rowSpan={2}
              >
                Tên ao
              </th>
              <th
                className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border"
                rowSpan={2}
              >
                Nhật ký
              </th>
              <th
                className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border"
                rowSpan={2}
              >
                Diện tích (m²)
              </th>
              {visibleMonthIdx.map((mi) => (
                <th key={mi} className="text-center px-2 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border" colSpan={3}>
                  {MONTHS[mi]}
                </th>
              ))}
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap" colSpan={3}>
                Tổng KH
              </th>
            </tr>
            <tr className="bg-muted/40 border-b border-border">
              {visibleMonthIdx.map((mi) => (
                <Fragment key={mi}>
                  <th className="text-right px-2 py-2 font-medium text-blue-600 whitespace-nowrap">CC</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">CT</th>
                  <th className="text-right px-2 py-2 font-medium text-foreground whitespace-nowrap border-r border-border">TH</th>
                </Fragment>
              ))}
              <th className="text-right px-2 py-2 font-medium text-blue-600 whitespace-nowrap">CC</th>
              <th className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">CT</th>
              <th className="text-right px-2 py-2 font-medium text-foreground whitespace-nowrap">TH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allAgencyRows.length === 0 ? (
              <tr>
                <td colSpan={5 + visibleMonthIdx.length * 3 + 3} className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              allAgencyRows.map((r) => (
                <tr key={r.agency} className="hover:bg-muted/20">
                  <td className="sticky left-0 bg-card px-4 py-2.5 font-semibold text-primary border-r border-border whitespace-nowrap">{r.agency}</td>
                  <td className="px-3 py-2.5 text-center">{r.pondCount > 0 ? r.pondCount : ''}</td>
                  <td className="px-3 py-2.5 text-left border-r border-border max-w-[18rem]">
                    <div className="truncate" title={r.uniquePonds.map((p) => p.code).join(', ')}>
                      {r.uniquePonds.map((p) => p.code).join(', ') || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center border-r border-border">
                    {r.uniquePonds[0]?.id ? (
                      <Link className="text-primary hover:underline font-medium" to={`/ponds/${r.uniquePonds[0].id}?tab=log`}>
                        Xem
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right border-r border-border">{r.totalArea > 0 ? r.totalArea.toLocaleString() : ''}</td>
                  {visibleMonthIdx.map((mi, i) => (
                    <Fragment key={mi}>
                      {renderKgCell(r.monthCC[i])}
                      {renderKgCell(r.monthCT[i])}
                      <td className="px-2 py-2 text-right text-xs font-semibold text-foreground border-r border-border">
                        {r.monthTH[i] > 0 ? r.monthTH[i].toLocaleString() : ''}
                      </td>
                    </Fragment>
                  ))}
                  {renderKgCell(r.totalCC)}
                  {renderKgCell(r.totalCT)}
                  {renderKgCell(r.totalAll, true)}
                </tr>
              ))
            )}

            <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
              <td className="sticky left-0 bg-primary/5 px-4 py-3 font-bold text-foreground border-r border-border">TỔNG CỘNG</td>
              <td className="px-3 py-3 text-center">{grandTotalPonds}</td>
              <td className="px-3 py-3 border-r border-border">—</td>
              <td className="px-3 py-3 text-center border-r border-border">—</td>
              <td className="px-3 py-3 text-right border-r border-border">{grandTotalArea > 0 ? grandTotalArea.toLocaleString() : ''}</td>
              {visibleMonthIdx.map((mi, i) => (
                <Fragment key={mi}>
                  {renderKgCell(grandMonthCC[i])}
                  {renderKgCell(grandMonthCT[i])}
                  <td className="px-2 py-3 text-right text-xs font-bold text-foreground border-r border-border">
                    {grandMonthTH[i] > 0 ? grandMonthTH[i].toLocaleString() : ''}
                  </td>
                </Fragment>
              ))}
              {renderKgCell(grandTotalCC)}
              {renderKgCell(grandTotalCT)}
              <td className="px-2 py-3 text-right text-xs font-bold text-foreground">{grandTotalAll > 0 ? grandTotalAll.toLocaleString() : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
