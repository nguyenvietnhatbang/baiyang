import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import ReportOriginal from '@/components/reports/ReportOriginal';
import ReportAdjusted from '@/components/reports/ReportAdjusted';
import ReportHarvest from '@/components/reports/ReportHarvest';

const MONTHS = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];

const REPORT_TYPE_ITEMS = [
  { value: 'summary', label: '📊 Tổng quan + Biểu đồ' },
  { value: 'original', label: '📋 Kế hoạch ban đầu (gốc)' },
  { value: 'adjusted', label: '🔄 Kế hoạch điều chỉnh' },
  { value: 'harvest', label: '🚜 Kế hoạch thu & Thực thu' },
];

function yieldByMonth(ponds, monthIdx) {
  return ponds
    .filter(p => p.expected_harvest_date && new Date(p.expected_harvest_date).getMonth() === monthIdx)
    .reduce((s, p) => s + (p.expected_yield || 0), 0);
}
function yieldHarvestByMonth(harvests, monthIdx) {
  return harvests
    .filter(h => h.harvest_date && new Date(h.harvest_date).getMonth() === monthIdx)
    .reduce((s, h) => s + (h.actual_yield || 0), 0);
}

export default function Reports() {
  const { harvestAlertDays } = useAuth();
  const [ponds, setPonds] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('summary');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [batchFilter, setBatchFilter] = useState('all');
  const [exportGranularity, setExportGranularity] = useState('agency');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Pond.listWithHouseholds('-updated_date', 500),
      base44.entities.HarvestRecord.list('-harvest_date', 500),
      base44.entities.Season.filter({ active: true }, 'code', 100),
      base44.entities.StockingBatch.filter({ active: true }, 'sort_order', 500),
    ]).then(([p, h, s, b]) => {
      setPonds(p);
      setHarvests(h);
      setSeasons(s);
      setBatches(b);
      setLoading(false);
    });
  }, []);

  const allAgencies = [...new Set(ponds.map(p => p.agency_code).filter(Boolean))].sort();
  const batchesSortedForSelect = useMemo(
    () =>
      [...batches].sort((a, b) => {
        const ca = seasons.find((s) => s.id === a.season_id)?.code ?? '';
        const cb = seasons.find((s) => s.id === b.season_id)?.code ?? '';
        if (ca !== cb) return ca.localeCompare(cb);
        return (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.code).localeCompare(String(b.code));
      }),
    [batches, seasons]
  );

  const filteredPonds = ponds.filter(p => agencyFilter === 'all' || p.agency_code === agencyFilter);
  const batchFilteredPonds = batchFilter === 'all'
    ? filteredPonds
    : filteredPonds.filter((p) => p.stocking_batch_id === batchFilter);

  const batchPondIds = useMemo(() => new Set(batchFilteredPonds.map((p) => p.id)), [batchFilteredPonds]);
  const batchPondCodes = useMemo(
    () => new Set(batchFilteredPonds.map((p) => p.code).filter(Boolean)),
    [batchFilteredPonds]
  );

  const filteredHarvests = harvests.filter((h) => {
    const matchAgency = agencyFilter === 'all' || h.agency_code === agencyFilter;
    const matchYear = !h.harvest_date || h.harvest_date.startsWith(yearFilter);
    const matchBatch =
      batchFilter === 'all' ||
      (h.pond_id && batchPondIds.has(h.pond_id)) ||
      (h.pond_code && batchPondCodes.has(h.pond_code));
    return matchAgency && matchYear && matchBatch;
  });
  const agencies = agencyFilter === 'all' ? allAgencies : allAgencies.filter(a => a === agencyFilter);

  const batchLabel = useMemo(() => {
    if (batchFilter === 'all') return 'Tất cả đợt thả';
    const b = batches.find((x) => x.id === batchFilter);
    if (!b) return 'Tất cả đợt thả';
    const sn = seasons.find((s) => s.id === b.season_id);
    return `${sn?.code ?? '—'} · ${b.code} — ${b.name}`;
  }, [batchFilter, batches, seasons]);

  const agencyFilterLabel = agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter;

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const { downloadReportsExcel } = await import('@/lib/reportExcelExport');
      await downloadReportsExcel({
        reportType,
        granularity: exportGranularity,
        ponds: batchFilteredPonds,
        harvests: filteredHarvests,
        agencies,
        harvestAlertDays,
        filters: {
          yearFilter,
          agencyFilterLabel,
          batchLabel,
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

  // Summary chart data
  const monthlyData = MONTHS.map((m, i) => ({
    month: m,
    keHoach: yieldByMonth(batchFilteredPonds, i),
    thucTe: yieldHarvestByMonth(filteredHarvests, i),
  }));

  // FCR distribution
  const fcrData = [
    { name: 'Xuất sắc ≤1.3', value: batchFilteredPonds.filter(p => p.fcr && p.fcr <= 1.3).length, color: '#22c55e' },
    { name: 'Tốt 1.3–1.6',   value: batchFilteredPonds.filter(p => p.fcr && p.fcr > 1.3 && p.fcr <= 1.6).length, color: '#f59e0b' },
    { name: 'Kém >1.6',      value: batchFilteredPonds.filter(p => p.fcr && p.fcr > 1.6).length, color: '#ef4444' },
    { name: 'Chưa có',       value: batchFilteredPonds.filter(p => !p.fcr).length, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  const totalAdjustedYield = batchFilteredPonds.reduce((s,p)=>s+(p.expected_yield||0),0);
  const totalActual = filteredHarvests.reduce((s,h)=>s+(h.actual_yield||0),0);

  const calcOriginalYield = (p) => {
    if (!p.total_fish || !p.survival_rate || !p.target_weight) return 0;
    return Math.round((p.total_fish * (p.survival_rate / 100) * p.target_weight) / 1000);
  };
  const totalOriginalYield = batchFilteredPonds.reduce((s,p)=>s+calcOriginalYield(p),0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const reportMeta = {
    original: { label: '📋 Kế hoạch ban đầu (gốc)', desc: 'Sản lượng đăng ký ban đầu, phân loại CC (đang nuôi) và CT (quay vòng)' },
    adjusted: { label: '🔄 Kế hoạch điều chỉnh', desc: 'So sánh KH gốc vs KH điều chỉnh theo diễn biến thực tế' },
    harvest:  { label: '🚜 Kế hoạch thu & Thực thu', desc: 'Chi tiết từng ao: KH thu, đã thu, còn tồn — nhóm theo đại lý' },
  };

  return (
    <div className="p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Báo cáo tổng hợp</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Phân tích sản lượng • So sánh kế hoạch vs thực tế</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={exportGranularity} onValueChange={setExportGranularity}>
            <SelectTrigger className="w-[11.5rem] h-9 text-sm">
              <SelectValue placeholder="Mức chi tiết" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agency">Excel: theo đại lý</SelectItem>
              <SelectItem value="pond">Excel: từng ao</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="flex items-center gap-2 text-sm"
            disabled={exporting}
            onClick={handleExportExcel}
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Đang xuất…' : 'Tải Excel'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-64">
            <SelectValue>
              {REPORT_TYPE_ITEMS.find((x) => x.value === reportType)?.label ?? reportType}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="summary">📊 Tổng quan + Biểu đồ</SelectItem>
            <SelectItem value="original">📋 Kế hoạch ban đầu (gốc)</SelectItem>
            <SelectItem value="adjusted">🔄 Kế hoạch điều chỉnh</SelectItem>
            <SelectItem value="harvest">🚜 Kế hoạch thu & Thực thu</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agencyFilter} onValueChange={setAgencyFilter}>
          <SelectTrigger className="w-40">
            <SelectValue>{agencyFilter === 'all' ? 'Tất cả đại lý' : agencyFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả đại lý</SelectItem>
            {allAgencies.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-28">
            <SelectValue>{yearFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {['2024','2025','2026'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={batchFilter} onValueChange={setBatchFilter}>
          <SelectTrigger className="w-[min(100%,20rem)]">
            <SelectValue>
              {batchFilter === 'all'
                ? 'Tất cả đợt thả'
                : (() => {
                    const b = batches.find((x) => x.id === batchFilter);
                    if (!b) return 'Tất cả đợt thả';
                    const sn = seasons.find((s) => s.id === b.season_id);
                    return `${sn?.code ?? '—'} · ${b.code} — ${b.name}`;
                  })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả đợt thả</SelectItem>
            {batchesSortedForSelect.map((b) => {
              const sn = seasons.find((s) => s.id === b.season_id);
              return (
                <SelectItem key={b.id} value={b.id}>
                  {sn ? `${sn.code} · ` : ''}{b.code} — {b.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards — always shown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KH Gốc</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{(totalOriginalYield/1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">{batchFilteredPonds.length} ao đã đăng ký</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">KH Điều chỉnh</p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{(totalAdjustedYield/1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">{batchFilteredPonds.filter(p=>p.status==='CC').length} ao đang CC</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đã thu thực tế</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{(totalActual/1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">{filteredHarvests.length} đợt thu</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Còn tồn chưa thu</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{(Math.max(0,totalAdjustedYield-totalActual)/1000).toFixed(1)}T</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalAdjustedYield > 0 ? `${Math.round((totalActual/totalAdjustedYield)*100)}% đã thu` : '—'}
          </p>
        </div>
      </div>

      {/* Summary view */}
      {reportType === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Bar chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-1">Kế hoạch điều chỉnh vs Thực tế theo tháng</h3>
            <p className="text-xs text-muted-foreground mb-4">Đơn vị: kg</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [`${v.toLocaleString()} kg`, n === 'keHoach' ? 'KH Điều chỉnh' : 'Thực tế']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend formatter={v => v === 'keHoach' ? 'KH Điều chỉnh' : 'Thực tế'} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="keHoach" fill="hsl(38,85%,52%)" radius={[3,3,0,0]} />
                <Bar dataKey="thucTe" fill="hsl(145,55%,42%)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* FCR pie */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-foreground mb-1">Phân bố FCR</h3>
            <p className="text-xs text-muted-foreground mb-4">Hệ số chuyển đổi thức ăn</p>
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
                  {fcrData.map(d => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium ml-auto">{d.value} ao</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">Chưa có dữ liệu FCR</div>
            )}
          </div>

          {/* Agency summary table */}
          <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Tổng hợp theo đại lý</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {['Đại lý','Tổng ao','CC','CT','KH Gốc (kg)','KH Điều chỉnh (kg)','Đã thu (kg)','Còn tồn (kg)','FCR TB'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allAgencies.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Chưa có dữ liệu</td></tr>
                  ) : allAgencies.map(agency => {
                    const ap = batchFilteredPonds.filter(p => p.agency_code === agency);
                    const ah = filteredHarvests.filter(h => h.agency_code === agency);
                    const origYield = ap.reduce((s,p)=>s+calcOriginalYield(p),0);
                    const adjYield = ap.reduce((s,p)=>s+(p.expected_yield||0),0);
                    const actYield = ah.reduce((s,h)=>s+(h.actual_yield||0),0);
                    const remaining = Math.max(0, adjYield - actYield);
                    const fcrArr = ap.filter(p=>p.fcr);
                    const avgFcr = fcrArr.length > 0 ? (fcrArr.reduce((s,p)=>s+p.fcr,0)/fcrArr.length).toFixed(2) : null;
                    return (
                      <tr key={agency} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-bold text-primary">{agency}</td>
                        <td className="px-4 py-3 text-center">{ap.length}</td>
                        <td className="px-4 py-3 text-center text-blue-600 font-semibold">{ap.filter(p=>p.status==='CC').length}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{ap.filter(p=>p.status==='CT').length}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{origYield > 0 ? origYield.toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">{adjYield > 0 ? adjYield.toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{actYield > 0 ? actYield.toLocaleString() : '—'}</td>
                        <td className={`px-4 py-3 text-right font-medium ${remaining > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                          {adjYield > 0 ? remaining.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {avgFcr ? (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${Number(avgFcr)<=1.3?'bg-green-100 text-green-700':Number(avgFcr)<=1.6?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>{avgFcr}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-bold border-t border-border">
                    <td className="px-4 py-3 text-foreground">TỔNG</td>
                    <td className="px-4 py-3 text-center">{batchFilteredPonds.length}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{batchFilteredPonds.filter(p=>p.status==='CC').length}</td>
                    <td className="px-4 py-3 text-center">{batchFilteredPonds.filter(p=>p.status==='CT').length}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{totalOriginalYield.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{totalAdjustedYield.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-700">{totalActual > 0 ? totalActual.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{Math.max(0,totalAdjustedYield-totalActual).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Báo cáo chi tiết */}
      {reportType !== 'summary' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground">{reportMeta[reportType]?.label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{reportMeta[reportType]?.desc} — Năm {yearFilter}</p>
          </div>
          {reportType === 'original' && <ReportOriginal ponds={batchFilteredPonds} agencies={agencies} />}
          {reportType === 'adjusted' && <ReportAdjusted ponds={batchFilteredPonds} agencies={agencies} />}
          {reportType === 'harvest'  && <ReportHarvest ponds={batchFilteredPonds} harvests={filteredHarvests} harvestAlertDays={harvestAlertDays} />}
        </div>
      )}
    </div>
  );
}