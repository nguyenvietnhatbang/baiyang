import { Fragment, useMemo } from 'react';
import { getFactoryPlanKgByMonth } from '@/lib/appSettingsHelpers';

const MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

function systemCodeFromAgencyCode(agencyCode) {
  const digits = String(agencyCode || '').replace(/\D/g, '');
  return digits ? digits : String(agencyCode || '').trim();
}

function monthIdxFromDate(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth();
}

export default function ReportSummaryMatrix({ ponds, harvests, agencies, appSettings, agencyNameByCode }) {
  const factoryPlan = getFactoryPlanKgByMonth(appSettings);

  const harvestByCycleId = useMemo(() => {
    const m = new Map();
    (harvests || []).forEach((h) => {
      if (!h?.pond_cycle_id) return;
      if (!m.has(h.pond_cycle_id)) m.set(h.pond_cycle_id, []);
      m.get(h.pond_cycle_id).push(h);
    });
    return m;
  }, [harvests]);

  const rows = useMemo(() => {
    return (agencies || []).map((agency) => {
      const agencyPonds = (ponds || []).filter((p) => p.agency_code === agency);
      const plannedMonth = Array.from({ length: 12 }, () => 0);
      const actualMonth = Array.from({ length: 12 }, () => 0);

      agencyPonds.forEach((p) => {
        const miPlan = monthIdxFromDate(p.expected_harvest_date);
        if (miPlan != null) plannedMonth[miPlan] += Number(p.expected_yield) || 0;

        const hs = harvestByCycleId.get(p.pond_cycle_id) || [];
        hs.forEach((h) => {
          const miAct = monthIdxFromDate(h.harvest_date);
          if (miAct != null) actualMonth[miAct] += Number(h.actual_yield) || 0;
        });
      });

      const totalPlan = plannedMonth.reduce((s, v) => s + v, 0);
      const totalAct = actualMonth.reduce((s, v) => s + v, 0);
      const agencyName = agencyNameByCode instanceof Map ? (agencyNameByCode.get(String(agency)) || agency) : agency;
      return { agency, agencyName, plannedMonth, actualMonth, totalPlan, totalAct };
    });
  }, [agencies, ponds, harvestByCycleId, agencyNameByCode]);

  const grandPlanned = useMemo(() => rows.reduce((s, r) => s + (r.totalPlan || 0), 0), [rows]);
  const grandActual = useMemo(() => rows.reduce((s, r) => s + (r.totalAct || 0), 0), [rows]);
  const grandPlannedMonth = useMemo(
    () => Array.from({ length: 12 }, (_, i) => rows.reduce((s, r) => s + (r.plannedMonth[i] || 0), 0)),
    [rows]
  );
  const grandActualMonth = useMemo(
    () => Array.from({ length: 12 }, (_, i) => rows.reduce((s, r) => s + (r.actualMonth[i] || 0), 0)),
    [rows]
  );

  const factoryMonth = Array.from({ length: 12 }, (_, i) => Number(factoryPlan[i] || 0));
  const factoryTotal = factoryMonth.reduce((s, v) => s + (Number(v) || 0), 0);

  const balancePlanMonth = grandPlannedMonth.map((v, i) => (Number(v) || 0) - (Number(factoryMonth[i]) || 0));
  const balanceActMonth = grandActualMonth.map((v, i) => (Number(v) || 0) - (Number(factoryMonth[i]) || 0));
  const balancePlanTotal = grandPlanned - factoryTotal;
  const balanceActTotal = grandActual - factoryTotal;

  const renderNum = (v) => (Number(v) > 0 ? Number(v).toLocaleString() : '');

  return (
    <div className="overflow-x-auto max-w-full pb-2">
      <table className="w-full min-w-max text-sm font-semibold border-collapse">
        <thead>
          <tr className="bg-muted/60 border-b border-border">
            <th className="text-center px-2 py-2 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
              Mã hệ thống
            </th>
            <th className="text-left px-2 py-2 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" rowSpan={2}>
              Hệ thống
            </th>
            {MONTHS.map((m) => (
              <th key={m} className="text-center px-2 py-2 font-extrabold text-slate-700 uppercase whitespace-nowrap border-r border-border" colSpan={2}>
                {m}
              </th>
            ))}
            <th className="text-center px-2 py-2 font-extrabold text-slate-700 uppercase whitespace-nowrap" colSpan={2}>
              Tổng
            </th>
          </tr>
          <tr className="bg-muted/40 border-b border-border">
            {MONTHS.map((m) => (
              <Fragment key={m}>
                <th className="text-center px-2 py-1.5 font-bold text-slate-600 whitespace-nowrap">Kế hoạch</th>
                <th className="text-center px-2 py-1.5 font-bold text-slate-600 whitespace-nowrap border-r border-border">Thực hiện</th>
              </Fragment>
            ))}
            <th className="text-center px-2 py-1.5 font-bold text-slate-600 whitespace-nowrap">Kế hoạch</th>
            <th className="text-center px-2 py-1.5 font-bold text-slate-600 whitespace-nowrap">Thực hiện</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.agency} className="hover:bg-muted/20">
              <td className="px-2 py-1.5 text-center font-semibold text-slate-700 border-r border-border whitespace-nowrap">
                {systemCodeFromAgencyCode(r.agency)}
              </td>
              <td className="px-2 py-1.5 text-left font-semibold text-primary border-r border-border whitespace-nowrap">
                {r.agencyName}
              </td>
              {MONTHS.map((m, i) => (
                <Fragment key={m}>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">{renderNum(r.plannedMonth[i])}</td>
                  <td className="px-2 py-1.5 text-right border-r border-border whitespace-nowrap">{renderNum(r.actualMonth[i])}</td>
                </Fragment>
              ))}
              <td className="px-2 py-1.5 text-right font-bold whitespace-nowrap">{renderNum(r.totalPlan)}</td>
              <td className="px-2 py-1.5 text-right font-bold whitespace-nowrap">{renderNum(r.totalAct)}</td>
            </tr>
          ))}

          <tr className="bg-primary/5 font-bold border-t-2 border-primary/20">
            <td className="px-2 py-2 text-left border-r border-border" colSpan={2}>Tổng</td>
            {MONTHS.map((m, i) => (
              <Fragment key={m}>
                <td className="px-2 py-2 text-right whitespace-nowrap">{renderNum(grandPlannedMonth[i])}</td>
                <td className="px-2 py-2 text-right border-r border-border whitespace-nowrap">{renderNum(grandActualMonth[i])}</td>
              </Fragment>
            ))}
            <td className="px-2 py-2 text-right font-bold whitespace-nowrap">{renderNum(grandPlanned)}</td>
            <td className="px-2 py-2 text-right font-bold whitespace-nowrap">{renderNum(grandActual)}</td>
          </tr>

          <tr className="bg-amber-50/40 border-t border-border">
            <td className="px-2 py-2 text-left font-bold border-r border-border whitespace-nowrap" colSpan={2}>Sản lượng Nhà máy giao</td>
            {MONTHS.map((m, i) => (
              <Fragment key={m}>
                <td className="px-2 py-2 text-right font-bold text-amber-700 whitespace-nowrap">{renderNum(factoryMonth[i])}</td>
                <td className="px-2 py-2 text-right border-r border-border text-muted-foreground"></td>
              </Fragment>
            ))}
            <td className="px-2 py-2 text-right font-bold text-amber-700 whitespace-nowrap">{renderNum(factoryTotal)}</td>
            <td className="px-2 py-2 text-right text-muted-foreground"></td>
          </tr>

          <tr className="bg-amber-50/40">
            <td className="px-2 py-2 text-left font-bold border-r border-border whitespace-nowrap" colSpan={2}>Cân đối</td>
            {MONTHS.map((m, i) => (
              <Fragment key={m}>
                <td className={`px-2 py-2 text-right font-bold whitespace-nowrap ${balancePlanMonth[i] >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {balancePlanMonth[i] !== 0 ? Math.round(balancePlanMonth[i]).toLocaleString() : ''}
                </td>
                <td className={`px-2 py-2 text-right font-bold border-r border-border whitespace-nowrap ${balanceActMonth[i] >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {balanceActMonth[i] !== 0 ? Math.round(balanceActMonth[i]).toLocaleString() : ''}
                </td>
              </Fragment>
            ))}
            <td className={`px-2 py-2 text-right font-bold whitespace-nowrap ${balancePlanTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {balancePlanTotal !== 0 ? Math.round(balancePlanTotal).toLocaleString() : ''}
            </td>
            <td className={`px-2 py-2 text-right font-bold whitespace-nowrap ${balanceActTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {balanceActTotal !== 0 ? Math.round(balanceActTotal).toLocaleString() : ''}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

