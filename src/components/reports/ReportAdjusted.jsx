/**
 * BÁO CÁO 2: KẾ HOẠCH ĐIỀU CHỈNH
 *
 * Bố cục dạng ma trận theo tháng: mỗi tháng tách 3 cột CC/CT/TH.
 */
import { Fragment } from 'react';
import { originalHarvestDateForReport, plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { uniquePhysicalPondCount, uniquePhysicalPondTotalArea } from '@/lib/reportPondDedupe';

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

function calcOriginalYield(p) {
  if (!p.total_fish || !p.survival_rate || !p.target_weight) return 0;
  return Math.round((p.total_fish * (p.survival_rate / 100) * p.target_weight) / 1000);
}

export default function ReportAdjusted({ ponds, agencies }) {
  const monthIdx = (() => {
    const set = new Set();
    ponds.forEach((p) => {
      const adjustedDate = plannedHarvestDateForDisplay(p);
      if (adjustedDate && (p.expected_yield || 0) > 0) {
        set.add(new Date(adjustedDate).getMonth());
      }
      const d0 = originalHarvestDateForReport(p);
      if (d0 && calcOriginalYield(p) > 0) set.add(new Date(d0).getMonth());
    });
    return [...set].sort((a, b) => a - b);
  })();

  const visibleMonthIdx = monthIdx.length > 0 ? monthIdx : [new Date().getMonth()];

  const rows = agencies.map((agency) => {
    const agencyPonds = ponds.filter((p) => p.agency_code === agency);
    
    const pondCount = uniquePhysicalPondCount(agencyPonds);
    const totalArea = uniquePhysicalPondTotalArea(agencyPonds);

    // Đếm theo chu kỳ (mỗi chu kỳ = 1 dòng dữ liệu kế hoạch)
    const cc = agencyPonds.filter((p) => p.status === 'CC');
    const ct = agencyPonds.filter((p) => p.status === 'CT');
    const totalCC = cc.reduce((s, p) => s + (p.expected_yield || 0), 0);
    const totalCT = ct.reduce((s, p) => s + (p.expected_yield || 0), 0);
    const totalTH = totalCC + totalCT;

    const monthCC = visibleMonthIdx.map((i) =>
      cc.reduce((s, p) => {
        const d = plannedHarvestDateForDisplay(p);
        return s + (d && new Date(d).getMonth() === i ? p.expected_yield || 0 : 0);
      }, 0)
    );
    const monthCT = visibleMonthIdx.map((i) =>
      ct.reduce((s, p) => {
        const d = plannedHarvestDateForDisplay(p);
        return s + (d && new Date(d).getMonth() === i ? p.expected_yield || 0 : 0);
      }, 0)
    );
    const monthTH = monthCC.map((v, i) => v + monthCT[i]);

    return { agency, ponds: agencyPonds, pondCount, totalArea, totalCC, totalCT, totalTH, monthCC, monthCT, monthTH };
  });

  const grandTotalPonds = rows.reduce((s, r) => s + r.pondCount, 0);
  const grandTotalArea = rows.reduce((s, r) => s + r.totalArea, 0);
  const grandTotalCC = rows.reduce((s, r) => s + r.totalCC, 0);
  const grandTotalCT = rows.reduce((s, r) => s + r.totalCT, 0);
  const grandTotalTH = grandTotalCC + grandTotalCT;
  const grandMonthCC = visibleMonthIdx.map((_, i) => rows.reduce((s, r) => s + (r.monthCC[i] || 0), 0));
  const grandMonthCT = visibleMonthIdx.map((_, i) => rows.reduce((s, r) => s + (r.monthCT[i] || 0), 0));
  const grandMonthTH = grandMonthCC.map((v, i) => v + grandMonthCT[i]);

  const renderKgCell = (value, highlight = false) => (
    <td className={`px-2 py-2 text-right text-xs ${highlight ? 'font-bold text-foreground' : 'text-foreground'}`}>
      {value > 0 ? value.toLocaleString() : ''}
    </td>
  );

  return (
    <div>
      <div className="px-5 py-3 bg-muted/30 border-b border-border text-xs text-muted-foreground">
        Bảng sắp xếp theo dạng tháng: mỗi tháng gồm <strong>CC</strong>, <strong>CT</strong>, <strong>TH</strong> (tổng) cho kế hoạch điều chỉnh.
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
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Diện tích (m²)
              </th>
              {visibleMonthIdx.map((mi) => (
                <th key={mi} className="text-center px-2 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border" colSpan={3}>
                  {MONTHS[mi]}
                </th>
              ))}
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap" colSpan={3}>Tổng KH ĐC</th>
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3 + visibleMonthIdx.length * 3 + 3} className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.agency} className="hover:bg-muted/20">
                  <td className="sticky left-0 bg-card px-4 py-2.5 font-semibold text-primary border-r border-border whitespace-nowrap">{r.agency}</td>
                  <td className="px-3 py-2.5 text-center">{r.pondCount > 0 ? r.pondCount : ''}</td>
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
                  {renderKgCell(r.totalTH, true)}
                </tr>
              ))
            )}

            <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
              <td className="sticky left-0 bg-primary/5 px-4 py-3 font-bold text-foreground border-r border-border">TỔNG CỘNG</td>
              <td className="px-3 py-3 text-center">{grandTotalPonds}</td>
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
              <td className="px-2 py-3 text-right text-xs font-bold text-foreground">{grandTotalTH > 0 ? grandTotalTH.toLocaleString() : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
