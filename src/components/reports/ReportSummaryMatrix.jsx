import { Fragment, useMemo } from 'react';
import { getFactoryPlanKgByMonth } from '@/lib/appSettingsHelpers';
import { normalizeReportAgencyCode, sumActualKgByAgencyMonth } from '@/lib/reportAgencyCode';
import {
  cycleHarvestPlanEligibleForMonthReport,
  harvestMatchesFilterMonthYear,
  harvestMatchesFilterYear,
  harvestMonthIndexForReport,
} from '@/lib/reportMonthHelpers';
import {
  reportAlert,
  reportTable,
  reportTableScroll,
  reportTd,
  reportTdCenter,
  reportTdLeft,
  reportTdBoldRight,
  reportTdRight,
  reportTh,
  reportThLast,
  reportThSub,
} from './reportTableClasses';
import { cn } from '@/lib/utils';

const MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);

function systemCodeFromAgencyCode(agencyCode) {
  const digits = String(agencyCode || '').replace(/\D/g, '');
  return digits ? digits : String(agencyCode || '').trim();
}

export default function ReportSummaryMatrix({
  ponds,
  harvests,
  agencies,
  appSettings,
  agencyNameByCode,
  yearFilter,
  monthFilter = 'all',
}) {
  const factoryPlan = getFactoryPlanKgByMonth(appSettings);

  const actualByAgencyMonth = useMemo(
    () => sumActualKgByAgencyMonth(harvests, ponds, { yearFilter, monthFilter }),
    [harvests, ponds, yearFilter, monthFilter]
  );

  const rows = useMemo(() => {
    return (agencies || []).map((agency) => {
      const agencyNorm = normalizeReportAgencyCode(agency);
      const agencyPonds = (ponds || []).filter(
        (p) => normalizeReportAgencyCode(p.agency_code) === agencyNorm
      );
      const plannedMonth = Array.from({ length: 12 }, () => 0);

      agencyPonds.forEach((p) => {
        if (
          cycleHarvestPlanEligibleForMonthReport(p) &&
          harvestMatchesFilterYear(p, yearFilter) &&
          (monthFilter === 'all' || harvestMatchesFilterMonthYear(p, yearFilter, Number(monthFilter)))
        ) {
          const miPlan = harvestMonthIndexForReport(p);
          if (miPlan != null) plannedMonth[miPlan] += Number(p.expected_yield) || 0;
        }
      });

      const actualMonth = actualByAgencyMonth.get(agencyNorm) || Array.from({ length: 12 }, () => 0);
      const totalPlan = plannedMonth.reduce((s, v) => s + v, 0);
      const totalAct = actualMonth.reduce((s, v) => s + v, 0);
      const agencyName =
        agencyNameByCode instanceof Map
          ? agencyNameByCode.get(String(agency)) || agencyNameByCode.get(agencyNorm) || agency
          : agency;
      return { agency, agencyName, plannedMonth, actualMonth, totalPlan, totalAct };
    });
  }, [agencies, ponds, actualByAgencyMonth, agencyNameByCode, yearFilter, monthFilter]);

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

  const ineligiblePlanCount = useMemo(
    () =>
      (ponds || []).filter((p) => {
        const y = Number(p.expected_yield) || 0;
        return y > 0 && !cycleHarvestPlanEligibleForMonthReport(p);
      }).length,
    [ponds]
  );

  return (
    <div className="space-y-2">
      {ineligiblePlanCount > 0 && (
        <p className={cn(reportAlert, 'mx-3 mt-2')}>
          {ineligiblePlanCount} chu kỳ có sản lượng KH nhưng <strong>chưa có ngày thả</strong> hoặc ngày thu trước ngày thả — không cộng vào cột Kế hoạch theo tháng (tránh hiện KH T1–T4 khi chưa có dữ liệu thả hợp lệ).
        </p>
      )}
    <div className={reportTableScroll}>
      <table className={reportTable}>
        <thead>
          <tr className="bg-muted/60 border-b border-border">
            <th className={cn(reportTh, 'text-center')} rowSpan={2}>
              Mã hệ thống
            </th>
            <th className={cn(reportTh, 'text-left')} rowSpan={2}>
              Hệ thống
            </th>
            {MONTHS.map((m) => (
              <th key={m} className={cn(reportTh, 'text-center')} colSpan={2}>
                {m}
              </th>
            ))}
            <th className={cn(reportThLast, 'text-center')} colSpan={2}>
              Tổng
            </th>
          </tr>
          <tr className="bg-muted/40 border-b border-border">
            {MONTHS.map((m) => (
              <Fragment key={m}>
                <th className={cn(reportThSub, 'text-center text-slate-600')}>Kế hoạch</th>
                <th className={cn(reportThSub, 'text-center text-slate-600 border-r border-border')}>Thực hiện</th>
              </Fragment>
            ))}
            <th className={cn(reportThSub, 'text-center text-slate-600')}>Kế hoạch</th>
            <th className={cn(reportThSub, 'text-center text-slate-600')}>Thực hiện</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.agency} className="hover:bg-muted/20">
              <td className={cn(reportTdCenter, 'border-r border-border')}>
                {systemCodeFromAgencyCode(r.agency)}
              </td>
              <td className={cn(reportTdLeft, 'border-r border-border')}>{r.agencyName}</td>
              {MONTHS.map((m, i) => (
                <Fragment key={m}>
                  <td className={reportTdRight}>{renderNum(r.plannedMonth[i])}</td>
                  <td className={cn(reportTdRight, 'border-r border-border')}>{renderNum(r.actualMonth[i])}</td>
                </Fragment>
              ))}
              <td className={reportTdRight}>{renderNum(r.totalPlan)}</td>
              <td className={reportTdRight}>{renderNum(r.totalAct)}</td>
            </tr>
          ))}

          <tr className="bg-primary/5 border-t-2 border-primary/20">
            <td className={cn(reportTd, 'report-table-total border-r border-border')} colSpan={2}>Tổng</td>
            {MONTHS.map((m, i) => (
              <Fragment key={m}>
                <td className={reportTdRight}>{renderNum(grandPlannedMonth[i])}</td>
                <td className={cn(reportTdRight, 'border-r border-border')}>{renderNum(grandActualMonth[i])}</td>
              </Fragment>
            ))}
            <td className={reportTdBoldRight}>{renderNum(grandPlanned)}</td>
            <td className={reportTdBoldRight}>{renderNum(grandActual)}</td>
          </tr>

          <tr className="bg-amber-50/40 border-t border-border">
            <td className={cn(reportTd, 'report-table-total border-r border-border')} colSpan={2}>Sản lượng Nhà máy giao</td>
            {MONTHS.map((m, i) => (
              <Fragment key={m}>
                <td className={cn(reportTdBoldRight, 'text-amber-700')}>{renderNum(factoryMonth[i])}</td>
                <td className={cn(reportTdRight, 'border-r border-border text-muted-foreground')} />
              </Fragment>
            ))}
            <td className={cn(reportTdBoldRight, 'text-amber-700')}>{renderNum(factoryTotal)}</td>
            <td className={cn(reportTdRight, 'text-muted-foreground')} />
          </tr>

          <tr className="bg-amber-50/40">
            <td className={cn(reportTd, 'report-table-total border-r border-border')} colSpan={2}>Cân đối</td>
            {MONTHS.map((m, i) => (
              <Fragment key={m}>
                <td
                  className={cn(
                    reportTdBoldRight,
                    balancePlanMonth[i] >= 0 ? 'text-green-700' : 'text-red-700'
                  )}
                >
                  {balancePlanMonth[i] !== 0 ? Math.round(balancePlanMonth[i]).toLocaleString() : ''}
                </td>
                <td
                  className={cn(
                    reportTdBoldRight,
                    'border-r border-border',
                    balanceActMonth[i] >= 0 ? 'text-green-700' : 'text-red-700'
                  )}
                >
                  {balanceActMonth[i] !== 0 ? Math.round(balanceActMonth[i]).toLocaleString() : ''}
                </td>
              </Fragment>
            ))}
            <td
              className={cn(
                reportTdBoldRight,
                balancePlanTotal >= 0 ? 'text-green-700' : 'text-red-700'
              )}
            >
              {balancePlanTotal !== 0 ? Math.round(balancePlanTotal).toLocaleString() : ''}
            </td>
            <td
              className={cn(
                reportTdBoldRight,
                balanceActTotal >= 0 ? 'text-green-700' : 'text-red-700'
              )}
            >
              {balanceActTotal !== 0 ? Math.round(balanceActTotal).toLocaleString() : ''}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  );
}

