/**
 * BÁO CÁO 1: KẾ HOẠCH BAN ĐẦU (GỐC)
 *
 * - Tổng hợp theo đại lý + mở rộng xem từng ao (cùng mô hình báo cáo Thu)
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { originalHarvestDateForReport } from '@/lib/planReportHelpers';

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

function calcOriginalYield(p) {
  if (!p.total_fish || !p.survival_rate || !p.target_weight) return 0;
  return Math.round((p.total_fish * (p.survival_rate / 100) * p.target_weight) / 1000);
}

function MonthCell({ value }) {
  return (
    <td className={`px-2 py-2.5 text-right text-xs ${value > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground/40'}`}>
      {value > 0 ? value.toLocaleString() : '—'}
    </td>
  );
}

export default function ReportOriginal({ ponds, agencies }) {
  const [collapsed, setCollapsed] = useState({});

  const activeMonthIdx = (() => {
    const set = new Set();
    ponds.forEach((p) => {
      const d = originalHarvestDateForReport(p);
      if (!d) return;
      const y = calcOriginalYield(p);
      if (y > 0) set.add(new Date(d).getMonth());
    });
    return [...set].sort((a, b) => a - b);
  })();

  const toggleAgency = (agency) => {
    setCollapsed((prev) => ({ ...prev, [agency]: !prev[agency] }));
  };

  const allAgencyRows = agencies.map((agency) => {
    const ap = ponds.filter((p) => p.agency_code === agency);
    const cc = ap.filter((p) => p.status === 'CC');
    const ct = ap.filter((p) => p.status === 'CT');
    const totalCC = cc.reduce((s, p) => s + calcOriginalYield(p), 0);
    const totalCT = ct.reduce((s, p) => s + calcOriginalYield(p), 0);
    const totalAll = totalCC + totalCT;

    const monthCC = activeMonthIdx.map((i) =>
      cc.reduce((s, p) => {
        const d = originalHarvestDateForReport(p);
        return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
      }, 0)
    );
    const monthCT = activeMonthIdx.map((i) =>
      ct.reduce((s, p) => {
        const d = originalHarvestDateForReport(p);
        return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
      }, 0)
    );

    return { agency, ap, cc, ct, totalCC, totalCT, totalAll, monthCC, monthCT };
  });

  const grandTotalCC = allAgencyRows.reduce((s, r) => s + r.totalCC, 0);
  const grandTotalCT = allAgencyRows.reduce((s, r) => s + r.totalCT, 0);
  const grandTotalAll = grandTotalCC + grandTotalCT;
  const grandMonthCC = activeMonthIdx.map((_, i) => allAgencyRows.reduce((s, r) => s + (r.monthCC[i] || 0), 0));
  const grandMonthCT = activeMonthIdx.map((_, i) => allAgencyRows.reduce((s, r) => s + (r.monthCT[i] || 0), 0));

  return (
    <div>
      <div className="px-5 py-3 bg-muted/30 border-b border-border flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
          <strong>CC</strong> — Ao đang có cá (đã thả)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-400 inline-block" />
          <strong>CT</strong> — Ao kế hoạch quay vòng (chưa thả)
        </span>
        <span className="text-muted-foreground">
          SL gốc = số cá thả × tỉ lệ sống × TL kỳ vọng — <strong>bấm dòng đại lý</strong> để xem từng ao (dòng ao: cột 2–4 là chủ hộ, trạng thái, diện tích).
        </span>
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
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap" colSpan={3}>
                Số ao
              </th>
              <th
                className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-l border-border"
                colSpan={2}
              >
                KH Gốc (kg)
              </th>
              <th
                className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-l border-border"
                colSpan={Math.max(1, activeMonthIdx.length)}
              >
                Sản lượng kế hoạch theo tháng (kg)
              </th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-l border-border">
                Tổng KH (kg)
              </th>
            </tr>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-center px-3 py-2 font-medium text-blue-600 whitespace-nowrap">CC</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">CT</th>
              <th className="text-center px-3 py-2 font-medium text-foreground whitespace-nowrap">Tổng</th>
              <th className="text-right px-3 py-2 font-medium text-blue-600 whitespace-nowrap border-l border-border">CC</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">CT</th>
              {activeMonthIdx.map((mi) => (
                <th
                  key={mi}
                  className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap border-l border-border/50"
                >
                  {MONTHS[mi]}
                </th>
              ))}
              <th className="text-right px-3 py-2 font-medium text-foreground whitespace-nowrap border-l border-border">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allAgencyRows.length === 0 ? (
              <tr>
                <td colSpan={7 + Math.max(1, activeMonthIdx.length)} className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              allAgencyRows.flatMap((r) => {
                const isOpen = collapsed[r.agency] === true;
                const agencyRow = (
                  <tr
                    key={`ag-${r.agency}`}
                    className="bg-muted/40 cursor-pointer hover:bg-muted/60 border-t border-border"
                    onClick={() => toggleAgency(r.agency)}
                  >
                    <td className="sticky left-0 bg-muted/40 px-4 py-2.5 font-bold text-primary border-r border-border whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span>{r.agency}</span>
                        <span className="text-muted-foreground font-normal">({r.ap.length} ao)</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-blue-600 font-semibold">{r.cc.length}</td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">{r.ct.length}</td>
                    <td className="px-3 py-2.5 text-center font-medium">{r.ap.length}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600 font-semibold border-l border-border">
                      {r.totalCC > 0 ? r.totalCC.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{r.totalCT > 0 ? r.totalCT.toLocaleString() : '—'}</td>
                    {activeMonthIdx.map((mi, i) => {
                      const total = r.monthCC[i] + r.monthCT[i];
                      return (
                        <td key={mi} className="px-2 py-2.5 text-right border-l border-border/50">
                          {total > 0 ? (
                            <div>
                              <div className="font-semibold text-foreground">{total.toLocaleString()}</div>
                              {r.monthCC[i] > 0 && <div className="text-blue-500 text-[10px]">CC: {r.monthCC[i].toLocaleString()}</div>}
                              {r.monthCT[i] > 0 && <div className="text-slate-400 text-[10px]">CT: {r.monthCT[i].toLocaleString()}</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right font-bold text-foreground border-l border-border">
                      {r.totalAll > 0 ? r.totalAll.toLocaleString() : '—'}
                    </td>
                  </tr>
                );

                const pondRows =
                  isOpen &&
                  r.ap.map((p) => {
                    const y = calcOriginalYield(p);
                    const d = originalHarvestDateForReport(p);
                    const mi = d ? new Date(d).getMonth() : -1;
                    return (
                      <tr key={p.id} className="hover:bg-muted/20 bg-card">
                        <td className="sticky left-0 bg-card px-4 py-2 pl-10 font-semibold text-primary border-r border-border whitespace-nowrap">
                          {p.code}
                        </td>
                        <td className="px-3 py-2.5 text-left text-muted-foreground text-[11px] max-w-[8rem] truncate" title={p.owner_name}>
                          {p.owner_name || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {p.status === 'CC' ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">CC</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">CT</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground">{p.area != null ? `${p.area} m²` : '—'}</td>
                        <td className="px-3 py-2.5 text-right text-blue-600 border-l border-border">
                          {p.status === 'CC' && y > 0 ? y.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {p.status === 'CT' && y > 0 ? y.toLocaleString() : '—'}
                        </td>
                        {activeMonthIdx.map((mIdx) => (
                          <MonthCell key={mIdx} value={mIdx === mi ? y : 0} />
                        ))}
                        <td className="px-3 py-2.5 text-right font-medium border-l border-border">{y > 0 ? y.toLocaleString() : '—'}</td>
                      </tr>
                    );
                  });

                return [agencyRow, ...(pondRows || [])];
              })
            )}

            <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
              <td className="sticky left-0 bg-primary/5 px-4 py-3 font-bold text-foreground border-r border-border">TỔNG CỘNG</td>
              <td className="px-3 py-3 text-center text-blue-600">{allAgencyRows.reduce((s, row) => s + row.cc.length, 0)}</td>
              <td className="px-3 py-3 text-center">{allAgencyRows.reduce((s, row) => s + row.ct.length, 0)}</td>
              <td className="px-3 py-3 text-center">{ponds.length}</td>
              <td className="px-3 py-3 text-right text-blue-600 border-l border-border">{grandTotalCC.toLocaleString()}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{grandTotalCT.toLocaleString()}</td>
              {activeMonthIdx.map((mi, i) => {
                const total = grandMonthCC[i] + grandMonthCT[i];
                return (
                  <td key={mi} className="px-2 py-3 text-right border-l border-border/50">
                    {total > 0 ? (
                      <div>
                        <div className="font-bold text-foreground">{total.toLocaleString()}</div>
                        {grandMonthCC[i] > 0 && (
                          <div className="text-blue-500 text-[10px] font-normal">CC: {grandMonthCC[i].toLocaleString()}</div>
                        )}
                        {grandMonthCT[i] > 0 && (
                          <div className="text-slate-400 text-[10px] font-normal">CT: {grandMonthCT[i].toLocaleString()}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-3 text-right text-foreground border-l border-border">{grandTotalAll.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
