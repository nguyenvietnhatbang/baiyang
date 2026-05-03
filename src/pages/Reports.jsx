import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Download, Maximize2 } from 'lucide-react';
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
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';

const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

const REPORT_TYPE_ITEMS = [
  { value: 'summary', label: '📊 Tổng quan + Biểu đồ' },
  { value: 'original', label: '📋 Kế hoạch ban đầu (gốc)' },
  { value: 'adjusted', label: '🔄 Kế hoạch điều chỉnh' },
  { value: 'harvest', label: '🚜 Kế hoạch thu & Thực thu' },
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
  const { harvestAlertDays } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('summary');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [cycleSearch, setCycleSearch] = useState('');
  const [exportGranularity, setExportGranularity] = useState('agency');
  const [exporting, setExporting] = useState(false);
  const [expandedReport, setExpandedReport] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.HarvestRecord.list('-harvest_date', 500),
    ]).then(([p, h]) => {
      setPonds(p || []);
      setHarvests(h || []);
      setLoading(false);
    });
  }, []);

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

  const yearFilterItems = useMemo(
    () => ['2024', '2025', '2026'].map((y) => ({ value: y, label: y })),
    []
  );

  const filteredPonds = useMemo(
    () => ponds.filter((p) => agencyFilter === 'all' || p.agency_code === agencyFilter),
    [ponds, agencyFilter]
  );

  const allCycleRows = useMemo(() => toCycleRows(filteredPonds), [filteredPonds]);

  const scopedCycleRows = useMemo(() => {
    const q = cycleSearch.trim().toLowerCase();
    if (!q) return allCycleRows;
    return allCycleRows.filter((r) => {
      const key = [r.pond_code, r.code, r.name, r.stock_date, r.owner_name].filter(Boolean).join(' ').toLowerCase();
      return key.includes(q);
    });
  }, [allCycleRows, cycleSearch]);

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
    return q ? `Tên/ngày thả chứa "${q}"` : 'Tất cả chu kỳ';
  }, [cycleSearch]);
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

  const calcOriginalYield = (p) => {
    if (!p.total_fish || !p.survival_rate || !p.target_weight) return 0;
    return Math.round((p.total_fish * (p.survival_rate / 100) * p.target_weight) / 1000);
  };
  const totalOriginalYield = scopedCycleRows.reduce((s, p) => s + calcOriginalYield(p), 0);

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
  };

  return (
    <div className="p-6 space-y-6 max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Báo cáo tổng hợp</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Phân tích sản lượng theo toàn bộ chu kỳ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={exportGranularity} onValueChange={setExportGranularity} items={exportGranularityItems}>
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

      <div className="flex gap-3 flex-wrap items-center">
        <Select value={reportType} onValueChange={setReportType} items={REPORT_TYPE_ITEMS}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REPORT_TYPE_ITEMS.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={agencyFilter} onValueChange={setAgencyFilter} items={agencyFilterItems}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {agencyFilterItems.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter} items={yearFilterItems}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearFilterItems.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1 min-w-[12rem] max-w-xs">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Tìm chu kỳ</span>
          <Input
            className="h-9 text-sm"
            placeholder="Tên chu kỳ / ngày thả / mã ao"
            value={cycleSearch}
            onChange={(e) => setCycleSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KH Gốc</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{(totalOriginalYield / 1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">{scopedCycleRows.length} chu kỳ</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KH Điều chỉnh</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{(totalAdjustedYield / 1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">{scopedCycleRows.filter((p) => p.status === 'CC').length} chu kỳ CC</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đã thu thực tế</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{(totalActual / 1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">{filteredHarvests.length} phiếu thu</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Còn tồn chưa thu</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{(Math.max(0, totalAdjustedYield - totalActual) / 1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalAdjustedYield > 0 ? `${Math.round((totalActual / totalAdjustedYield) * 100)}% đã thu` : '—'}
          </p>
        </div>
      </div>

      {reportType === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-1">Kế hoạch điều chỉnh vs Thực tế theo tháng</h3>
            <p className="text-xs text-muted-foreground mb-4">Đơn vị: kg</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [`${v.toLocaleString()} kg`, n === 'keHoach' ? 'KH Điều chỉnh' : 'Thực tế']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
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
      )}

      {reportType !== 'summary' && (
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
          {reportType === 'original' && <ReportOriginal ponds={scopedCycleRows} agencies={agencies} />}
          {reportType === 'adjusted' && <ReportAdjusted ponds={scopedCycleRows} agencies={agencies} />}
          {reportType === 'harvest' && <ReportHarvest ponds={scopedCycleRows} harvests={filteredHarvests} harvestAlertDays={harvestAlertDays} />}
        </div>
      )}

      {/* Modal mở rộng báo cáo */}
      <Dialog open={!!expandedReport} onOpenChange={(open) => !open && setExpandedReport(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-primary" />
              {expandedReport && reportMeta[expandedReport]?.label}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {expandedReport && reportMeta[expandedReport]?.desc} — Năm {yearFilter} • {agencyFilterLabel} • {cycleFilterLabel}
            </p>
          </DialogHeader>
          <div className="mt-2">
            {expandedReport === 'original' && <ReportOriginal ponds={scopedCycleRows} agencies={agencies} />}
            {expandedReport === 'adjusted' && <ReportAdjusted ponds={scopedCycleRows} agencies={agencies} />}
            {expandedReport === 'harvest' && <ReportHarvest ponds={scopedCycleRows} harvests={filteredHarvests} harvestAlertDays={harvestAlertDays} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
