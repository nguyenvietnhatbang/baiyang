/**
 * BÁO CÁO: KẾ HOẠCH THU & SẢN LƯỢNG THỰC THU
 * Group đại lý → ao; cột diện tích, FCR, nhóm trạng thái thu hoạch.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { classifyHarvestStatus, harvestStatusLabel } from '@/lib/harvestAlerts';

export default function ReportHarvest({ ponds, harvests, harvestAlertDays = 7 }) {
  const [collapsed, setCollapsed] = useState({});

  const activePonds = ponds.filter(p => p.status === 'CC' || p.expected_harvest_date);

  const agencies = [...new Set(activePonds.map(p => p.agency_code || '(Chưa phân)'))]
    .sort((a, b) => a.localeCompare(b));

  const getHarvestData = (p) => {
    const pondHarvests = harvests.filter((h) => {
      if (p.pond_cycle_id) {
        if (h.pond_cycle_id) return h.pond_cycle_id === p.pond_cycle_id;
        // Fallback only for legacy records without pond_cycle_id
        return h.pond_id === p.pond_id || h.pond_code === p.pond_code;
      }
      return h.pond_code === p.code || h.pond_id === p.id;
    });
    const totalActual = pondHarvests.reduce((s, h) => s + (h.actual_yield || 0), 0);
    const planned = p.expected_yield || 0;
    const remaining = planned > 0 ? Math.max(0, planned - totalActual) : null;
    const diff = planned > 0 && totalActual > 0 ? totalActual - planned : null;
    const pct = planned > 0 && totalActual > 0 ? Math.round(((totalActual - planned) / planned) * 100) : null;
    const lotCodes = pondHarvests.map(h => h.lot_code).filter(Boolean).join(', ');
    const hStatus = classifyHarvestStatus(p, totalActual, harvestAlertDays);
    return { totalActual, planned, remaining, diff, pct, lotCodes, harvestCount: pondHarvests.length, hStatus };
  };

  const toggleAgency = (agency) => {
    setCollapsed(prev => ({ ...prev, [agency]: !prev[agency] }));
  };

  const grandPlanned = activePonds.reduce((s, p) => s + (p.expected_yield || 0), 0);
  const grandActual = harvests.reduce((s, h) => s + (h.actual_yield || 0), 0);
  const grandRemaining = Math.max(0, grandPlanned - grandActual);

  const headers = [
    { label: 'Mã ao', className: 'text-left' },
    { label: 'Chủ hộ', className: 'text-left' },
    { label: 'Diện tích', className: 'text-right' },
    { label: 'Trạng thái', className: 'text-center' },
    { label: 'Thu hoạch', className: 'text-center' },
    { label: 'Ngày thu DK', className: 'text-center' },
    { label: 'KH thu (kg)', className: 'text-right' },
    { label: 'Đã thu (kg)', className: 'text-right' },
    { label: 'Còn tồn (kg)', className: 'text-right' },
    { label: 'FCR', className: 'text-center' },
    { label: '% đạt', className: 'text-center' },
    { label: 'Mã lô', className: 'text-left' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/60 border-b border-border">
            {headers.map(h => (
              <th
                key={h.label}
                className={`${h.className} px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {activePonds.length === 0 ? (
            <tr><td colSpan={12} className="text-center py-10 text-muted-foreground">Chưa có dữ liệu ao nuôi</td></tr>
          ) : agencies.map(agency => {
            const agencyPonds = activePonds.filter(p => (p.agency_code || '(Chưa phân)') === agency);
            const isOpen = !collapsed[agency];
            const agPlanned = agencyPonds.reduce((s, p) => s + (p.expected_yield || 0), 0);
            const agActual = agencyPonds.reduce((s, p) => {
              const d = getHarvestData(p);
              return s + d.totalActual;
            }, 0);
            const agRemaining = Math.max(0, agPlanned - agActual);
            const agPct = agPlanned > 0 && agActual > 0 ? Math.round(((agActual - agPlanned) / agPlanned) * 100) : null;
            const agArea = agencyPonds.reduce((s, p) => s + (Number(p.area) || 0), 0);

            return [
              <tr
                key={`ag-${agency}`}
                className="bg-muted/40 cursor-pointer hover:bg-muted/60 border-t border-border"
                onClick={() => toggleAgency(agency)}
              >
                <td className="px-4 py-2.5" colSpan={2}>
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className="font-bold text-primary text-sm">{agency}</span>
                    <span className="text-muted-foreground font-normal">({agencyPonds.length} ao)</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground text-[10px] whitespace-nowrap">
                  Σ {agArea ? `${agArea.toLocaleString()} m²` : '—'}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="text-blue-600 font-semibold">{agencyPonds.filter(p=>p.status==='CC').length} CC</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-muted-foreground">{agencyPonds.filter(p=>p.status==='CT').length} CT</span>
                </td>
                <td />
                <td />
                <td className="px-4 py-2.5 text-right font-semibold text-foreground">{agPlanned > 0 ? agPlanned.toLocaleString() : '—'}</td>
                <td className="px-4 py-2.5 text-right font-bold text-green-700">{agActual > 0 ? agActual.toLocaleString() : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${agRemaining > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                  {agPlanned > 0 ? agRemaining.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5 text-center text-muted-foreground">—</td>
                <td className="px-4 py-2.5 text-center">
                  {agPct !== null ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${agPct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {agPct >= 0 ? '+' : ''}{agPct}%
                    </span>
                  ) : '—'}
                </td>
                <td />
              </tr>,

              ...(isOpen ? agencyPonds.map(p => {
                const { totalActual, planned, remaining, diff, pct, lotCodes, hStatus } = getHarvestData(p);
                const stLabel = harvestStatusLabel(hStatus);
                const stClass =
                  hStatus === 'harvested' ? 'bg-green-100 text-green-800' :
                  hStatus === 'upcoming' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-600';
                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 pl-10 font-semibold text-primary whitespace-nowrap">{p.code}</td>
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{p.owner_name}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{p.area != null ? `${p.area} m²` : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {p.status === 'CC'
                        ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">CC</span>
                        : <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">CT</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${stClass}`}>{stLabel}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap text-muted-foreground">{p.expected_harvest_date || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{planned > 0 ? planned.toLocaleString() : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-green-700">
                      {totalActual > 0 ? totalActual.toLocaleString() : <span className="text-muted-foreground font-normal">Chưa thu</span>}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${remaining > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      {remaining !== null ? remaining.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.fcr ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          p.fcr <= 1.3 ? 'bg-green-100 text-green-700' :
                          p.fcr <= 1.6 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>{p.fcr}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {pct !== null ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {pct >= 0 ? '+' : ''}{pct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{lotCodes || '—'}</td>
                  </tr>
                );
              }) : [])
            ];
          })}

          <tr className="bg-primary/5 border-t-2 border-primary/20 font-bold text-sm">
            <td className="px-4 py-3 text-foreground font-bold" colSpan={6}>TỔNG CỘNG — {activePonds.length} ao</td>
            <td className="px-4 py-3 text-right text-foreground">{grandPlanned > 0 ? grandPlanned.toLocaleString() : '—'}</td>
            <td className="px-4 py-3 text-right text-green-700">{grandActual > 0 ? grandActual.toLocaleString() : '—'}</td>
            <td className={`px-4 py-3 text-right ${grandRemaining > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
              {grandPlanned > 0 ? grandRemaining.toLocaleString() : '—'}
            </td>
            <td className="px-4 py-3 text-center">—</td>
            <td className="px-4 py-3 text-center">
              {grandPlanned > 0 && grandActual > 0 ? (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${grandActual >= grandPlanned ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {Math.round(((grandActual - grandPlanned) / grandPlanned) * 100) >= 0 ? '+' : ''}
                  {Math.round(((grandActual - grandPlanned) / grandPlanned) * 100)}%
                </span>
              ) : '—'}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
