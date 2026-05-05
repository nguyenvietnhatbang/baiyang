import { Fragment, useMemo } from 'react';

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function toMonthIndex(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth();
}

export default function ReportDailyProductionPlan({ ponds }) {
  const rows = useMemo(() => {
    const byOwner = new Map();

    ponds.forEach((p) => {
      const monthIdx = toMonthIndex(p.expected_harvest_date);
      if (monthIdx == null) return;

      const owner = p.owner_name || '(Chưa có tên hộ)';
      const key = owner;
      const plannedYield = p.expected_yield || 0;
      const isCC = p.status === 'CC';
      const isCT = p.status === 'CT';

      if (!byOwner.has(key)) {
        byOwner.set(key, {
          owner,
          pondIds: new Set(),
          area: 0,
          monthCC: Array(12).fill(0),
          monthCT: Array(12).fill(0),
        });
      }

      const row = byOwner.get(key);
      if (p.pond_id) row.pondIds.add(p.pond_id);
      row.area += p.area || 0;
      if (isCC) row.monthCC[monthIdx] += plannedYield;
      if (isCT) row.monthCT[monthIdx] += plannedYield;
    });

    return [...byOwner.values()]
      .map((r) => {
        const monthTH = r.monthCC.map((v, i) => v + r.monthCT[i]);
        const totalCC = r.monthCC.reduce((s, v) => s + v, 0);
        const totalCT = r.monthCT.reduce((s, v) => s + v, 0);
        return {
          owner: r.owner,
          pondCount: r.pondIds.size,
          area: r.area,
          monthCC: r.monthCC,
          monthCT: r.monthCT,
          monthTH,
          totalCC,
          totalCT,
          totalTH: totalCC + totalCT,
        };
      })
      .sort((a, b) => a.owner.localeCompare(b.owner, 'vi'));
  }, [ponds]);

  const grand = useMemo(() => {
    const monthCC = Array(12).fill(0);
    const monthCT = Array(12).fill(0);
    let pondCount = 0;
    let area = 0;

    rows.forEach((r) => {
      pondCount += r.pondCount;
      area += r.area;
      for (let i = 0; i < 12; i += 1) {
        monthCC[i] += r.monthCC[i];
        monthCT[i] += r.monthCT[i];
      }
    });

    const monthTH = monthCC.map((v, i) => v + monthCT[i]);
    const totalCC = monthCC.reduce((s, v) => s + v, 0);
    const totalCT = monthCT.reduce((s, v) => s + v, 0);

    return {
      pondCount,
      area,
      monthCC,
      monthCT,
      monthTH,
      totalCC,
      totalCT,
      totalTH: totalCC + totalCT,
    };
  }, [rows]);

  const renderKgCell = (value, emphasized = false) => (
    <td className={`px-2 py-2 text-right text-xs ${emphasized ? 'font-bold text-foreground' : 'text-foreground'}`}>
      {value > 0 ? value.toLocaleString() : ''}
    </td>
  );

  const luyKeMonthly = useMemo(() => {
    let running = 0;
    return grand.monthTH.map((v) => {
      running += v;
      return running;
    });
  }, [grand.monthTH]);

  return (
    <div>
      <div className="px-5 py-3 bg-muted/30 border-b border-border text-xs text-muted-foreground">
        Báo cáo theo hộ nuôi, hiển thị kế hoạch thu hoạch theo 12 tháng (CC/CT/TH).
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-blue-100/80 border-b border-border">
              <th className="px-2 py-2 border-r border-border" colSpan={3} />
              <th className="text-center px-2 py-2 font-extrabold text-foreground border-r border-border" colSpan={36}>
                Thời điểm thu hoạch (tấn)
              </th>
              <th className="text-center px-2 py-2 font-extrabold text-foreground border-r border-border" colSpan={3}>
                Tổng sản lượng kế hoạch
              </th>
              <th className="text-center px-2 py-2 font-extrabold text-foreground">Ghi chú</th>
            </tr>
            <tr className="bg-muted/60 border-b border-border">
              <th className="sticky left-0 bg-muted/60 text-left px-3 py-2 font-bold text-foreground uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Hệ thống
              </th>
              <th className="text-center px-2 py-2 font-bold text-foreground uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Mã hệ thống
              </th>
              <th className="text-center px-2 py-2 font-bold text-foreground uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
                Diện tích (ha)
              </th>
              {MONTHS.map((m) => (
                <th key={m} className="text-center px-2 py-2 font-extrabold text-foreground uppercase whitespace-nowrap border-r border-border" colSpan={3}>
                  {m}
                </th>
              ))}
              <th className="text-center px-2 py-2 font-extrabold text-foreground uppercase whitespace-nowrap" colSpan={3}>
                Tổng sản lượng KH
              </th>
              <th className="text-center px-2 py-2 font-bold text-foreground uppercase whitespace-nowrap border-l border-border" rowSpan={2}>
                Ghi chú
              </th>
            </tr>
            <tr className="bg-muted/40 border-b border-border">
              {MONTHS.map((m) => (
                <Fragment key={m}>
                  <th className="text-right px-2 py-2 font-bold text-blue-700 whitespace-nowrap">CC</th>
                  <th className="text-right px-2 py-2 font-bold text-slate-700 whitespace-nowrap">CT</th>
                  <th className="text-right px-2 py-2 font-bold text-foreground whitespace-nowrap border-r border-border">TH</th>
                </Fragment>
              ))}
              <th className="text-right px-2 py-2 font-bold text-blue-700 whitespace-nowrap">CC</th>
              <th className="text-right px-2 py-2 font-bold text-slate-700 whitespace-nowrap">CT</th>
              <th className="text-right px-2 py-2 font-bold text-foreground whitespace-nowrap">TH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3 + 12 * 3 + 3} className="text-center py-8 text-muted-foreground">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.owner} className="hover:bg-muted/20">
                  <td className="sticky left-0 bg-card px-3 py-2.5 font-semibold text-primary border-r border-border whitespace-nowrap">{r.owner}</td>
                  <td className="px-2 py-2.5 text-center">{r.pondCount > 0 ? r.pondCount : ''}</td>
                  <td className="px-2 py-2.5 text-right border-r border-border">{r.area > 0 ? (r.area / 10000).toFixed(2) : ''}</td>
                  {MONTHS.map((m, i) => (
                    <Fragment key={m}>
                      {renderKgCell(r.monthCC[i])}
                      {renderKgCell(r.monthCT[i])}
                      <td className="px-2 py-2 text-right text-xs font-semibold text-foreground border-r border-border">
                        {r.monthTH[i] > 0 ? r.monthTH[i].toLocaleString() : ''}
                      </td>
                    </Fragment>
                  ))}
                  {renderKgCell(r.totalCC)}
                  {renderKgCell(r.totalCT)}
                  <td className="px-2 py-2 text-right text-xs font-bold text-foreground">{r.totalTH > 0 ? r.totalTH.toLocaleString() : ''}</td>
                  <td className="px-2 py-2 text-muted-foreground border-l border-border" />
                </tr>
              ))
            )}

            <tr className="bg-primary/5 font-bold border-t-2 border-primary/20 text-red-700">
              <td className="sticky left-0 bg-primary/5 px-3 py-3 font-bold text-foreground border-r border-border">Tổng</td>
              <td className="px-2 py-3 text-center">{grand.pondCount}</td>
              <td className="px-2 py-3 text-right border-r border-border">{grand.area > 0 ? (grand.area / 10000).toFixed(2) : ''}</td>
              {MONTHS.map((m, i) => (
                <Fragment key={m}>
                  {renderKgCell(grand.monthCC[i])}
                  {renderKgCell(grand.monthCT[i])}
                  <td className="px-2 py-3 text-right text-xs font-bold text-foreground border-r border-border">
                    {grand.monthTH[i] > 0 ? grand.monthTH[i].toLocaleString() : ''}
                  </td>
                </Fragment>
              ))}
              {renderKgCell(grand.totalCC)}
              {renderKgCell(grand.totalCT)}
              <td className="px-2 py-3 text-right text-xs font-bold text-foreground">{grand.totalTH > 0 ? grand.totalTH.toLocaleString() : ''}</td>
              <td className="px-2 py-3 border-l border-border" />
            </tr>

            <tr className="bg-muted/20 border-t border-border">
              <td className="sticky left-0 bg-muted/20 px-3 py-2.5 text-xs font-semibold text-blue-700 border-r border-border" colSpan={3}>
                Sản lượng lũy kế kế hoạch
              </td>
              {MONTHS.map((m, i) => (
                <Fragment key={m}>
                  <td className="px-2 py-2 text-right text-xs" />
                  <td className="px-2 py-2 text-right text-xs" />
                  <td className="px-2 py-2 text-right text-xs font-semibold text-blue-700 border-r border-border">
                    {luyKeMonthly[i] > 0 ? luyKeMonthly[i].toLocaleString() : ''}
                  </td>
                </Fragment>
              ))}
              <td className="px-2 py-2 text-right text-xs" />
              <td className="px-2 py-2 text-right text-xs" />
              <td className="px-2 py-2 text-right text-xs font-semibold text-blue-700">{grand.totalTH > 0 ? grand.totalTH.toLocaleString() : ''}</td>
              <td className="px-2 py-2 border-l border-border" />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border space-y-1">
        <p className="font-semibold italic">Giải thích:</p>
        <p>CC: Ao đang có cá và có kế hoạch thu.</p>
        <p>CT: Ao có kế hoạch thả cá và có kế hoạch thu.</p>
        <p>TH: Tổng sản lượng dự kiến theo ao nuôi.</p>
      </div>
    </div>
  );
}
