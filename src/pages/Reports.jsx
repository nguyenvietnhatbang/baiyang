import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Download, Maximize2, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import ReportOriginal from '@/components/reports/ReportOriginal';
import ReportAdjusted from '@/components/reports/ReportAdjusted';
import ReportHarvest from '@/components/reports/ReportHarvest';
import ReportDailyProductionPlan from '@/components/reports/ReportDailyProductionPlan';
import ReportSummaryMatrix from '@/components/reports/ReportSummaryMatrix';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { calcOriginalYieldKg } from '@/lib/calculateYield';

const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

function SearchableInlineSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, rootRef]);

  const normalized = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return options;
    return options.filter((o) => String(o.label || '').toLowerCase().includes(normalized));
  }, [options, normalized]);

  const cur = options.find((o) => String(o.value) === String(value)) || null;

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className={`h-8 w-[18rem] justify-between px-2 text-xs font-medium ${!cur ? 'text-muted-foreground' : ''}`}
      >
        <span className="truncate">{cur?.label || placeholder}</span>
        <ChevronsUpDown className="w-4 h-4 opacity-50" aria-hidden />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-[18rem] rounded-md border border-border bg-popover shadow-md overflow-hidden">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Gõ để tìm..."
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-72 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">Không có kết quả</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/40 ${String(o.value) === String(value) ? 'bg-muted/30 font-bold' : ''}`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const REPORT_TYPE_ITEMS = [
  { value: 'summary', label: '📊 Tổng quan + Biểu đồ' },
  { value: 'summary_matrix', label: '📑 Báo cáo tổng hợp' },
  { value: 'original', label: '📋 Kế hoạch ban đầu (gốc)' },
  { value: 'adjusted', label: '🔄 Kế hoạch điều chỉnh' },
  { value: 'harvest', label: '🚜 Kế hoạch thu & Thực thu' },
  { value: 'daily_plan', label: '📅 Báo cáo KH thu & sản lượng' },
];

function yieldByMonth(rows, monthIdx) {
  return rows
    .filter((r) => r.expected_harvest_date && new Date(r.expected_harvest_date).getMonth() === monthIdx)
    .reduce((s, r) => s + (r.expected_yield || 0), 0);
}

function yieldHarvestByMonth(rows, monthIdx) {
  return rows
    .filter((h) => h.harvest_date && new Date(h.harvest_date).getMonth() === monthIdx)
    .reduce((s, h) => s + (h.actual_yield || 0), 0);
}

function toCycleRows(ponds) {
  return ponds.flatMap((pond) => {
    const cycles = Array.isArray(pond.pond_cycles) ? pond.pond_cycles : [];
    if (cycles.length === 0) return [];
    return cycles.map((cycle, idx) => ({
      ...pond,
      ...cycle,
      id: cycle.id,
      pond_id: pond.id,
      pond_code: pond.code,
      code: `${pond.code}${cycles.length > 1 ? ` · CK${idx + 1}` : ''}`,
      pond_cycle_id: cycle.id,
      expected_harvest_date: plannedHarvestDateForDisplay(cycle),
    }));
  });
}

export default function Reports() {
  const { harvestAlertDays, appSettings } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [agencyNameByCode, setAgencyNameByCode] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('summary');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(`${new Date().getFullYear()}-12-31`);
  const [cycleSearch, setCycleSearch] = useState('');
  const [cycleIdFilter, setCycleIdFilter] = useState('all');
  const [exportGranularity, setExportGranularity] = useState('agency');
  const [exporting, setExporting] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.HarvestRecord.list('-harvest_date', 500),
      base44.entities.Agency.list('-created_at', 500),
    ])
      .then(([p, h, a]) => {
        if (cancelled) return;
        setPonds(p || []);
        setHarvests(h || []);
        const m = new Map();
        (a || []).forEach((row) => {
          const code = row?.code != null ? String(row.code).trim() : '';
          const name = row?.name != null ? String(row.name).trim() : '';
          if (code) m.set(code, name || code);
        });
        setAgencyNameByCode(m);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setPonds([]);
          setHarvests([]);
          setAgencyNameByCode(new Map());
          toast.error('Không tải được dữ liệu báo cáo.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDateFrom(`${yearFilter}-01-01`);
    setDateTo(`${yearFilter}-12-31`);
  }, [yearFilter]);

  const exportGranularityItems = useMemo(
    () => [
      { value: 'agency', label: 'Excel: theo đại lý' },
      { value: 'pond', label: 'Excel: từng chu kỳ' },
    ],
    []
  );

  const allAgencies = useMemo(
    () => [...new Set(ponds.map((p) => p.agency_code).filter(Boolean))].sort(),
    [ponds]
  );

  const agencyFilterItems = useMemo(
    () => [{ value: 'all', label: 'Tất cả đại lý' }, ...allAgencies.map((a) => ({ value: a, label: a }))],
    [allAgencies]
  );

  const yearFilterItems = useMemo(() => {
    const y0 = new Date().getFullYear();
    const years = new Set(['2024', '2025', '2026', String(y0 - 1), String(y0), String(y0 + 1)]);
    return [...years].sort().map((y) => ({ value: y, label: y }));
  }, []);

  const filteredPonds = useMemo(
    () => ponds.filter((p) => agencyFilter === 'all' || p.agency_code === agencyFilter),
    [ponds, agencyFilter]
  );

  const allCycleRows = useMemo(() => toCycleRows(filteredPonds), [filteredPonds]);

  const cycleFilterOptions = useMemo(() => {
    const items = [{ value: 'all', label: 'Tất cả chu kỳ' }];
    const seen = new Set();
    allCycleRows.forEach((r) => {
      const id = r?.pond_cycle_id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      const lb = [r.pond_code, r.name || '', r.stock_date ? `Thả ${r.stock_date}` : '', r.owner_name || '']
        .filter(Boolean)
        .join(' — ')
        .trim();
      items.push({ value: id, label: lb || String(id) });
    });
    return items.sort((a, b) => String(a.label).localeCompare(String(b.label), 'vi'));
  }, [allCycleRows]);

  const scopedCycleRows = useMemo(() => {
    const q = cycleSearch.trim().toLowerCase();
    let rows = allCycleRows;
    if (cycleIdFilter !== 'all') {
      rows = rows.filter((r) => String(r.pond_cycle_id) === String(cycleIdFilter));
    }
    if (!q) return rows;
    return rows.filter((r) => {
      const key = [r.pond_code, r.code, r.name, r.stock_date, r.owner_name].filter(Boolean).join(' ').toLowerCase();
      return key.includes(q);
    });
  }, [allCycleRows, cycleSearch, cycleIdFilter]);

  const scopedCycleIds = useMemo(() => new Set(scopedCycleRows.map((r) => r.pond_cycle_id).filter(Boolean)), [scopedCycleRows]);
  const scopedPondIds = useMemo(() => new Set(scopedCycleRows.map((r) => r.pond_id).filter(Boolean)), [scopedCycleRows]);
  const scopedPondCodes = useMemo(() => new Set(scopedCycleRows.map((r) => r.pond_code).filter(Boolean)), [scopedCycleRows]);

  const filteredHarvests = useMemo(
    () =>
      harvests.filter((h) => {
        const matchAgency = agencyFilter === 'all' || h.agency_code === agencyFilter;
        const matchYear = !h.harvest_date || h.harvest_date.startsWith(yearFilter);
        const matchScope =
          (h.pond_cycle_id && scopedCycleIds.has(h.pond_cycle_id)) ||
          (!h.pond_cycle_id && h.pond_id && scopedPondIds.has(h.pond_id)) ||
          (!h.pond_cycle_id && h.pond_code && scopedPondCodes.has(h.pond_code));
        return matchAgency && matchYear && matchScope;
      }),
    [harvests, agencyFilter, yearFilter, scopedCycleIds, scopedPondIds, scopedPondCodes]
  );

  const agencies = agencyFilter === 'all' ? allAgencies : allAgencies.filter((a) => a === agencyFilter);
  const cycleFilterLabel = useMemo(() => {
    const q = cycleSearch.trim();
    if (cycleIdFilter !== 'all') {
      const lb = cycleFilterOptions.find((x) => String(x.value) === String(cycleIdFilter))?.label;
      return lb ? `Chu kỳ: ${lb}` : 'Chu kỳ đã chọn';
    }
    return q ? `Tên/ngày thả chứa "${q}"` : 'Tất cả chu kỳ';
  }, [cycleSearch, cycleIdFilter, cycleFilterOptions]);
  const agencyFilterLabel = agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter;

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const { downloadReportsExcel } = await import('@/lib/reportExcelExport');
      await downloadReportsExcel({
        reportType,
        granularity: exportGranularity,
        ponds: scopedCycleRows,
        harvests: filteredHarvests,
        agencies,
        harvestAlertDays,
        appSettings,
        agencyNameByCode,
        filters: {
          yearFilter,
          agencyFilterLabel,
          batchLabel: cycleFilterLabel,
        },
      });
      toast.success('Đã tải file Excel');
    } catch (e) {
      console.error(e);
      toast.error('Không xuất được Excel. Thử lại sau.');
    } finally {
      setExporting(false);
    }
  };

  const monthlyData = MONTHS.map((m, i) => ({
    month: m,
    keHoach: yieldByMonth(scopedCycleRows, i),
    thucTe: yieldHarvestByMonth(filteredHarvests, i),
  }));

  const fcrData = [
    { name: 'Xuất sắc ≤1.3', value: scopedCycleRows.filter((p) => p.fcr && p.fcr <= 1.3).length, color: '#22c55e' },
    { name: 'Tốt 1.3–1.6', value: scopedCycleRows.filter((p) => p.fcr && p.fcr > 1.3 && p.fcr <= 1.6).length, color: '#f59e0b' },
    { name: 'Kém >1.6', value: scopedCycleRows.filter((p) => p.fcr && p.fcr > 1.6).length, color: '#ef4444' },
    { name: 'Chưa có', value: scopedCycleRows.filter((p) => !p.fcr).length, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  const totalAdjustedYield = scopedCycleRows.reduce((s, p) => s + (p.expected_yield || 0), 0);
  const totalActual = filteredHarvests.reduce((s, h) => s + (h.actual_yield || 0), 0);

  const totalOriginalYield = scopedCycleRows.reduce((s, p) => s + calcOriginalYieldKg(p), 0);
  const dailyProductionRows = useMemo(() => {
    const byDate = new Map();

    filteredHarvests.forEach((h) => {
      if (!h.harvest_date) return;
      const dateKey = h.harvest_date.slice(0, 10);
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + (h.actual_yield || 0));
    });

    const rows = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, production]) => ({
        date: new Date(dateKey).toLocaleDateString('en-US'),
        demand: 0,
        production,
        variance: production,
      }));

    if (rows.length > 0) return rows;

    return [
      {
        date: new Date().toLocaleDateString('en-US'),
        demand: 0,
        production: 0,
        variance: 0,
      },
    ];
  }, [filteredHarvests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const reportMeta = {
    original: { label: '📋 Kế hoạch ban đầu (gốc)', desc: 'Tổng hợp theo toàn bộ chu kỳ của mỗi ao' },
    adjusted: { label: '🔄 Kế hoạch điều chỉnh', desc: 'So sánh KH gốc vs KH điều chỉnh theo từng chu kỳ' },
    harvest: { label: '🚜 Kế hoạch thu & Thực thu', desc: 'Chi tiết theo chu kỳ, nhóm theo đại lý' },
    daily_plan: { label: '📅 Báo cáo KH thu & sản lượng', desc: 'Ma trận 12 tháng theo hộ nuôi với các cột CC/CT/TH' },
  };

  return (
    <div className="p-4 space-y-4 max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Báo cáo tổng hợp</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Phân tích sản lượng theo toàn bộ chu kỳ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={exportGranularity} onValueChange={setExportGranularity}>
            <SelectTrigger className="w-[11.5rem] h-9 text-sm">
              <SelectValue placeholder="Mức chi tiết" />
            </SelectTrigger>
            <SelectContent>
              {exportGranularityItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center gap-2 text-sm" disabled={exporting} onClick={handleExportExcel}>
            <Download className="w-4 h-4" />
            {exporting ? 'Đang xuất…' : 'Tải Excel'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REPORT_TYPE_ITEMS.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={agencyFilter} onValueChange={setAgencyFilter}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {agencyFilterItems.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearFilterItems.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1 min-w-[12rem] max-w-xs">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Chu kỳ</span>
          <SearchableInlineSelect
            value={cycleIdFilter}
            onChange={setCycleIdFilter}
            options={cycleFilterOptions}
            placeholder="Chọn chu kỳ (gõ để tìm)"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Từ ngày</span>
          <Input className="h-8 w-[9.5rem] text-xs" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Đến ngày</span>
          <Input className="h-8 w-[9.5rem] text-xs" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Sản lượng ngày</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="px-3 py-2 text-left font-semibold text-foreground">Ngày</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Nhu cầu</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Sản lượng</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {dailyProductionRows.map((row, idx) => (
                <tr key={`${row.date}-${idx}`} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2 text-right">{row.demand.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{row.production.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{row.variance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">KH Gốc</p>
          <p className="text-xl font-bold mt-1 text-foreground">{(totalOriginalYield / 1000).toFixed(1)}T</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{scopedCycleRows.length} chu kỳ</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">KH Điều chỉnh</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{(totalAdjustedYield / 1000).toFixed(1)}T</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{scopedCycleRows.filter((p) => p.status === 'CC').length} chu kỳ CC</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Đã thu thực tế</p>
          <p className="text-xl font-bold mt-1 text-green-600">{(totalActual / 1000).toFixed(1)}T</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{filteredHarvests.length} phiếu thu</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Còn tồn chưa thu</p>
          <p className="text-xl font-bold mt-1 text-blue-600">{(Math.max(0, totalAdjustedYield - totalActual) / 1000).toFixed(1)}T</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {totalAdjustedYield > 0 ? `${Math.round((totalActual / totalAdjustedYield) * 100)}% đã thu` : '—'}
          </p>
        </div>
      </div>

      {reportType === 'summary' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-1">Kế hoạch điều chỉnh vs Thực tế theo tháng</h3>
              <p className="text-xs text-muted-foreground mb-4">Đơn vị: kg</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v, n) => {
                      const num = typeof v === 'number' ? v : Number(v);
                      const safe = Number.isFinite(num) ? num : 0;
                      return [`${safe.toLocaleString()} kg`, n === 'keHoach' ? 'KH Điều chỉnh' : 'Thực tế'];
                    }}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend formatter={(v) => (v === 'keHoach' ? 'KH Điều chỉnh' : 'Thực tế')} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="keHoach" fill="hsl(38,85%,52%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="thucTe" fill="hsl(145,55%,42%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-1">Phân bố FCR</h3>
              <p className="text-xs text-muted-foreground mb-4">Theo từng chu kỳ</p>
              {fcrData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={fcrData} cx="50%" cy="50%" outerRadius={65} dataKey="value">
                        {fcrData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {fcrData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-medium ml-auto">{d.value} chu kỳ</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">Chưa có dữ liệu FCR</div>
              )}
            </div>
          </div>

        </div>
      )}

      {reportType === 'summary_matrix' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Báo cáo tổng hợp</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Kế hoạch (theo ngày thu dự kiến) vs Thực hiện (theo ngày thu thực tế) theo tháng.</p>
          </div>
          <ReportSummaryMatrix
            ponds={scopedCycleRows}
            harvests={filteredHarvests}
            agencies={agencies}
            appSettings={appSettings}
            agencyNameByCode={agencyNameByCode}
          />
        </div>
      )}

      {reportType !== 'summary' && reportType !== 'summary_matrix' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{reportMeta[reportType]?.label}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{reportMeta[reportType]?.desc} — Năm {yearFilter}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={() => setExpandedReport(reportType)}
            >
              <Maximize2 className="w-4 h-4" />
              Mở rộng
            </Button>
          </div>
          {reportType === 'original' && <ReportOriginal ponds={scopedCycleRows} agencies={agencies} dateFrom={dateFrom} dateTo={dateTo} appSettings={appSettings} agencyNameByCode={agencyNameByCode} />}
          {reportType === 'adjusted' && <ReportAdjusted ponds={scopedCycleRows} agencies={agencies} dateFrom={dateFrom} dateTo={dateTo} appSettings={appSettings} agencyNameByCode={agencyNameByCode} />}
          {reportType === 'harvest' && <ReportHarvest ponds={scopedCycleRows} harvests={filteredHarvests} harvestAlertDays={harvestAlertDays} />}
          {reportType === 'daily_plan' && <ReportDailyProductionPlan ponds={scopedCycleRows} harvests={filteredHarvests} agencyNameByCode={agencyNameByCode} />}
        </div>
      )}

      {/* Modal mở rộng báo cáo */}
      <Dialog
        open={!!expandedReport}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setExpandedReport(null);
        }}
      >
        <DialogContent className="!top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !p-0 !gap-0 overflow-hidden flex flex-col m-0">
          <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-primary" />
              {expandedReport && reportMeta[expandedReport]?.label}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {expandedReport && reportMeta[expandedReport]?.desc} — Năm {yearFilter} • {agencyFilterLabel} • {cycleFilterLabel}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-0 py-0">
            {expandedReport === 'original' && <ReportOriginal ponds={scopedCycleRows} agencies={agencies} dateFrom={dateFrom} dateTo={dateTo} appSettings={appSettings} agencyNameByCode={agencyNameByCode} />}
            {expandedReport === 'adjusted' && <ReportAdjusted ponds={scopedCycleRows} agencies={agencies} dateFrom={dateFrom} dateTo={dateTo} appSettings={appSettings} agencyNameByCode={agencyNameByCode} />}
            {expandedReport === 'harvest' && <ReportHarvest ponds={scopedCycleRows} harvests={filteredHarvests} harvestAlertDays={harvestAlertDays} />}
            {expandedReport === 'daily_plan' && <ReportDailyProductionPlan ponds={scopedCycleRows} harvests={filteredHarvests} agencyNameByCode={agencyNameByCode} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
