/**
 * BÁO CÁO 2: KẾ HOẠCH ĐIỀU CHỈNH
 *
 * - Sản lượng điều chỉnh = expected_yield hiện tại
 * - So sánh KH Gốc vs KH Điều chỉnh — tổng đại lý + chi tiết từng ao (cùng mô hình báo cáo Thu)
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { originalHarvestDateForReport } from '@/lib/planReportHelpers';

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

function calcOriginalYield(p) {
  if (!p.total_fish || !p.survival_rate || !p.target_weight) return 0;
  return Math.round((p.total_fish * (p.survival_rate / 100) * p.target_weight) / 1000);
}

function DiffBadge({ original, adjusted }) {
  if (!original || !adjusted) return <span className="text-muted-foreground/40">—</span>;
  const diff = adjusted - original;
  const pct = original > 0 ? Math.round((diff / original) * 100) : 0;
  if (diff === 0) return <span className="text-muted-foreground text-xs">0%</span>;
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {diff > 0 ? '+' : ''}
      {pct}%
    </span>
  );
}

export default function ReportAdjusted({ ponds, agencies }) {
  const [collapsed, setCollapsed] = useState({});

  const activeMonthIdx = (() => {
    const set = new Set();
    ponds.forEach((p) => {
      if (p.expected_harvest_date && (p.expected_yield || 0) > 0) {
        set.add(new Date(p.expected_harvest_date).getMonth());
      }
      const d0 = originalHarvestDateForReport(p);
      if (d0 && calcOriginalYield(p) > 0) set.add(new Date(d0).getMonth());
    });
    return [...set].sort((a, b) => a - b);
  })();

  const toggleAgency = (agency) => {
    setCollapsed((prev) => ({ ...prev, [agency]: !prev[agency] }));
  };

  const rows = agencies.map((agency) => {
    const ap = ponds.filter((p) => p.agency_code === agency);
    const origTotal = ap.reduce((s, p) => s + calcOriginalYield(p), 0);
    const adjTotal = ap.reduce((s, p) => s + (p.expected_yield || 0), 0);

    const origByMonth = activeMonthIdx.map((i) =>
      ap.reduce((s, p) => {
        const d = originalHarvestDateForReport(p);
        return s + (d && new Date(d).getMonth() === i ? calcOriginalYield(p) : 0);
      }, 0)
    );
    const adjByMonth = activeMonthIdx.map((i) =>
      ap.reduce(
        (s, p) =>
          s +
          (p.expected_harvest_date && new Date(p.expected_harvest_date).getMonth() === i ? p.expected_yield || 0 : 0),
        0
      )
    );

    return { agency, ap, origTotal, adjTotal, origByMonth, adjByMonth };
  });

  const grandOrig = rows.reduce((s, r) => s + r.origTotal, 0);
  const grandAdj = rows.reduce((s, r) => s + r.adjTotal, 0);
  const grandOrigByMonth = activeMonthIdx.map((_, i) => rows.reduce((s, r) => s + (r.origByMonth[i] || 0), 0));
  const grandAdjByMonth = activeMonthIdx.map((_, i) => rows.reduce((s, r) => s + (r.adjByMonth[i] || 0), 0));

  return (
    <div>
      <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex flex-wrap gap-3 text-xs text-amber-800">
        <span>
          📌 <strong>KH Gốc</strong> = đăng ký ban đầu (total_fish × survival_rate × target_weight)
        </span>
        <span>|</span>
        <span>
          🔄 <strong>KH Điều chỉnh</strong> = expected_yield theo thực tế — <strong>bấm dòng đại lý</strong> để xem từng ao
        </span>
        <span>|</span>
        <span className="text-amber-900/80">Dòng ao: cột 2–3 là chủ hộ, trạng thái (thay cho đếm CC/CT).</span>
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
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap">CC</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap">CT</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-l border-border">
                KH Gốc (kg)
              </th>
              <th className="text-right px-3 py-2 font-semibold text-amber-600 uppercase whitespace-nowrap">KH Điều chỉnh (kg)</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap">Chênh</th>
              <th
                className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase whitespace-nowrap border-l border-border"
                colSpan={Math.max(1, activeMonthIdx.length)}
              >
                Sản lượng ĐC theo tháng (kg)
              </th>
            </tr>
            <tr className="bg-muted/40 border-b border-border">
              <th />
              <th />
              <th />
              <th />
              <th />
              {activeMonthIdx.map((mi) => (
                <th
                  key={mi}
                  className="text-right px-2 py-2 font-medium text-muted-foreground whitespace-nowrap border-l border-border/50"
                >
                  {MONTHS[mi]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6 + Math.max(1, activeMonthIdx.length)} className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              rows.flatMap((r) => {
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
                    <td className="px-3 py-2.5 text-center text-blue-600 font-semibold">{r.ap.filter((p) => p.status === 'CC').length}</td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">{r.ap.filter((p) => p.status === 'CT').length}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground border-l border-border">
                      {r.origTotal > 0 ? r.origTotal.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-700">{r.adjTotal > 0 ? r.adjTotal.toLocaleString() : '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <DiffBadge original={r.origTotal} adjusted={r.adjTotal} />
                    </td>
                    {activeMonthIdx.map((mi, i) => {
                      const adj = r.adjByMonth[i];
                      const orig = r.origByMonth[i];
                      const diff = adj - orig;
                      return (
                        <td key={mi} className="px-2 py-2.5 text-right border-l border-border/50">
                          {adj > 0 ? (
                            <div>
                              <div className="font-semibold text-amber-700">{adj.toLocaleString()}</div>
                              {orig > 0 && diff !== 0 && (
                                <div className={`text-[10px] ${diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                  ({diff > 0 ? '+' : ''}
                                  {diff.toLocaleString()})
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );

                const pondRows =
                  isOpen &&
                  r.ap.map((p) => {
                    const orig = calcOriginalYield(p);
                    const adj = p.expected_yield || 0;
                    return (
                      <tr key={p.id} className="hover:bg-muted/20 bg-card">
                        <td className="sticky left-0 bg-card px-4 py-2 pl-10 font-semibold text-primary border-r border-border whitespace-nowrap">
                          {p.code}
                        </td>
                        <td
                          className="px-3 py-2.5 text-left text-muted-foreground text-[11px] max-w-[8rem] truncate"
                          title={p.owner_name}
                        >
                          {p.owner_name || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {p.status === 'CC' ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">CC</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">CT</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground border-l border-border">
                          {orig > 0 ? orig.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-amber-700">{adj > 0 ? adj.toLocaleString() : '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <DiffBadge original={orig} adjusted={adj} />
                        </td>
                        {activeMonthIdx.map((mi, i) => {
                          const dAdj =
                            p.expected_harvest_date && new Date(p.expected_harvest_date).getMonth() === mi ? adj : 0;
                          const dOrig = (() => {
                            const d = originalHarvestDateForReport(p);
                            return d && new Date(d).getMonth() === mi ? orig : 0;
                          })();
                          const diff = dAdj - dOrig;
                          return (
                            <td key={mi} className="px-2 py-2.5 text-right border-l border-border/50">
                              {dAdj > 0 ? (
                                <div>
                                  <div className="font-semibold text-amber-700">{dAdj.toLocaleString()}</div>
                                  {dOrig > 0 && diff !== 0 && (
                                    <div className={`text-[10px] ${diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                      ({diff > 0 ? '+' : ''}
                                      {diff.toLocaleString()})
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });

                return [agencyRow, ...(pondRows || [])];
              })
            )}

            <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
              <td className="sticky left-0 bg-primary/5 px-4 py-3 font-bold text-foreground border-r border-border">TỔNG CỘNG</td>
              <td className="px-3 py-3 text-center text-blue-600">{ponds.filter((p) => p.status === 'CC').length}</td>
              <td className="px-3 py-3 text-center">{ponds.filter((p) => p.status === 'CT').length}</td>
              <td className="px-3 py-3 text-right text-muted-foreground border-l border-border">{grandOrig.toLocaleString()}</td>
              <td className="px-3 py-3 text-right text-amber-700">{grandAdj.toLocaleString()}</td>
              <td className="px-3 py-3 text-center">
                <DiffBadge original={grandOrig} adjusted={grandAdj} />
              </td>
              {activeMonthIdx.map((mi, i) => {
                const adj = grandAdjByMonth[i];
                const orig = grandOrigByMonth[i];
                const diff = adj - orig;
                return (
                  <td key={mi} className="px-2 py-3 text-right border-l border-border/50">
                    {adj > 0 ? (
                      <div>
                        <div className="font-bold text-amber-700">{adj.toLocaleString()}</div>
                        {orig > 0 && diff !== 0 && (
                          <div className={`text-[10px] font-normal ${diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                            ({diff > 0 ? '+' : ''}
                            {diff.toLocaleString()})
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
