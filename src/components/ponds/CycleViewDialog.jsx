import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Pencil,
  ClipboardList,
  ShoppingCart,
  MoreHorizontal,
  Trash2,
  Info,
  LayoutGrid,
  Table2,
  Edit,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import PondLogEditDialog from '@/components/ponds/PondLogEditDialog';
import PondHarvestTab from '@/components/ponds/PondHarvestTab';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { recalculateCycleMetrics } from '@/lib/recalculateCycleMetrics';
import { formatDateDisplay } from '@/lib/dateFormat';

function cellDash(v) {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

function fmtNumber(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

export default function CycleViewDialog({ open, onClose, cycleId, onEdit }) {
  const logTableScrollRef = useRef(null);
  const [tab, setTab] = useState('detail');
  const [detailLayout, setDetailLayout] = useState('cards');
  const [cycle, setCycle] = useState(null);
  const [pond, setPond] = useState(null);
  const [logs, setLogs] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editLog, setEditLog] = useState(null);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTab('detail');
    setDetailLayout('cards');
  }, [open]);

  const reloadAfterLogMutation = async () => {
    if (!cycleId) return;
    await recalculateCycleMetrics(cycleId);
    const [l, rows] = await Promise.all([
      base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', 500),
      base44.entities.PondCycle.filter({ id: cycleId }, '-updated_at', 1),
    ]);
    setLogs(l || []);
    setCycle(rows?.[0] ?? null);
  };

  useEffect(() => {
    if (!open || !cycleId) {
      setCycle(null);
      setPond(null);
      setLogs([]);
      setHarvests([]);
      setError('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await base44.entities.PondCycle.filter({ id: cycleId }, '-updated_at', 1);
        const c = rows?.[0] || null;
        const [l, h, p] = await Promise.all([
          base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', 500),
          base44.entities.HarvestRecord.filter({ pond_cycle_id: cycleId }, '-harvest_date', 500),
          c?.pond_id ? base44.entities.Pond.getWithCycles(c.pond_id) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setCycle(c);
          setLogs(l || []);
          setHarvests(h || []);
          setPond(p);
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatSupabaseError(e));
          setCycle(null);
          setPond(null);
          setLogs([]);
          setHarvests([]);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cycleId]);

  const cycleTitle = useMemo(() => {
    if (!cycle) return '';
    const pondCode = cycle.pond_code ? String(cycle.pond_code) : '';
    const cycleName = cycle.name ? String(cycle.name) : '';
    return [pondCode, cycleName].filter(Boolean).join(' · ');
  }, [cycle]);

  const cycleLabelForRow = useMemo(() => {
    if (!cycle) return '—';
    return (cycle.name && String(cycle.name).trim()) || (cycle.stock_date ? `Thả ${cycle.stock_date}` : 'Chu kỳ');
  }, [cycle]);

  const statusText = (c) => {
    if (!c?.status) return '—';
    if (c.status === 'CC') return 'Có cá / Đang nuôi';
    if (c.status === 'CT') return 'Chưa thả / Quay vòng';
    return String(c.status);
  };

  const cycleTableRows = useMemo(() => {
    if (!cycle) return [];
    const yieldPct =
      cycle.actual_yield != null && cycle.expected_yield != null && Number(cycle.expected_yield)
        ? `${Math.round((cycle.actual_yield / cycle.expected_yield) * 100)}%`
        : '—';
    return [
      { label: 'Tên chu kỳ', value: cycle.name || '—' },
      { label: 'Trạng thái', value: statusText(cycle) },
      { label: 'Ngày thả', value: formatDateDisplay(cycle.stock_date) },
      { label: 'Tổng cá thả', value: fmtNumber(cycle.total_fish) },
      { label: 'Size giống', value: cycle.seed_size != null ? `${cycle.seed_size} cm` : '—' },
      { label: 'TL giống', value: cycle.seed_weight != null ? `${cycle.seed_weight} g` : '—' },
      { label: 'Mật độ thả', value: cycle.density != null ? `${cycle.density} con/m²` : '—' },
      { label: 'Số cá hiện tại', value: fmtNumber(cycle.current_fish ?? cycle.total_fish) },
      { label: 'Tỷ lệ sống', value: cycle.survival_rate != null ? `${cycle.survival_rate}%` : '—' },
      { label: 'TL thu kỳ vọng', value: cycle.target_weight != null ? `${cycle.target_weight} g` : '—' },
      { label: 'SL dự kiến', value: cycle.expected_yield != null ? `${fmtNumber(cycle.expected_yield)} kg` : '—' },
      { label: 'Thu DK (gốc)', value: formatDateDisplay(cycle.initial_expected_harvest_date) },
      { label: 'Thu DK (điều chỉnh)', value: formatDateDisplay(cycle.expected_harvest_date) },
      { label: 'Hết ngưng thuốc', value: formatDateDisplay(cycle.withdrawal_end_date) },
      { label: 'Thực thu (tổng)', value: cycle.actual_yield != null ? `${fmtNumber(cycle.actual_yield)} kg` : '—' },
      { label: 'Đạt kế hoạch', value: yieldPct },
      { label: 'Ghi chú chu kỳ', value: cycle.notes ? String(cycle.notes) : '—' },
    ];
  }, [cycle]);

  const pondOpsTableRows = useMemo(() => {
    if (!cycle) return [];
    const lotHint = pond?.code
      ? `LOT-${pond.code}-${String(new Date().toISOString().slice(0, 10)).replace(/-/g, '')}`
      : '—';
    return [
      { label: 'Mã ao', value: pond?.code || cycle.pond_code || '—' },
      { label: 'Chủ hộ', value: pond?.owner_name || '—' },
      { label: 'Đại lý', value: pond?.agency_code || '—' },
      { label: 'Diện tích', value: pond?.area ? `${pond.area} m²` : '—' },
      { label: 'Tổng thức ăn', value: cycle.total_feed_used != null ? `${fmtNumber(cycle.total_feed_used)} kg` : '—' },
      {
        label: 'FCR',
        value:
          cycle.fcr != null
            ? `${cycle.fcr}${cycle.fcr <= 1.3 ? ' (tốt)' : cycle.fcr <= 1.6 ? ' (trung bình)' : ' (cao)'}`
            : '—',
      },
      { label: 'Đã thu hoạch', value: cycle.harvest_done ? 'Đã chốt' : 'Chưa' },
      { label: 'Mã lô truy xuất (gợi ý)', value: lotHint },
    ];
  }, [cycle, pond]);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-[min(96rem,98vw)] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-10">
            <Eye className="w-4 h-4 text-muted-foreground" />
            Xem chu kỳ {cycleTitle}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Có thể sửa nhật ký ngay tại đây. Muốn chỉnh thông tin chu kỳ hãy bấm <strong>Sửa</strong>.
          </p>
        </DialogHeader>

        {loading && <div className="text-sm text-muted-foreground py-6 text-center">Đang tải…</div>}
        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        )}

        {!loading && cycle && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="rounded-lg border border-border p-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mã ao</p>
                <p className="font-mono font-bold text-foreground mt-0.5">{cycle.pond_code || '—'}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ngày thả</p>
                <p className="font-semibold text-foreground mt-0.5">{formatDateDisplay(cycle.stock_date)}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Số cá</p>
                <p className="font-semibold text-foreground mt-0.5">{fmtNumber(cycle.current_fish ?? cycle.total_fish)}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">SL dự kiến</p>
                <p className="font-semibold text-foreground mt-0.5">{cycle.expected_yield != null ? `${fmtNumber(cycle.expected_yield)} kg` : '—'}</p>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="bg-muted flex-wrap h-auto gap-1 py-1">
                <TabsTrigger value="detail" className="flex items-center gap-1.5 text-xs">
                  <Info className="w-3.5 h-3.5" />
                  Chi tiết
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Nhật ký
                </TabsTrigger>
                <TabsTrigger value="harvest" className="flex items-center gap-1.5 text-xs">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Thu hoạch
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detail" className="mt-3 outline-none space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">Hiển thị chi tiết dạng thẻ hoặc hai bảng (chu kỳ + ao/FCR).</p>
                  <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDetailLayout('cards')}
                      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        detailLayout === 'cards' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Thẻ
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailLayout('tables')}
                      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        detailLayout === 'tables' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      Hai bảng
                    </button>
                  </div>
                </div>

                {detailLayout === 'tables' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/30 border-b border-border">
                        Bảng 1 — Thông tin chu kỳ
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/20 border-b border-border">
                              <th className="text-left px-3 py-2 w-[40%] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chỉ tiêu</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Giá trị</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {cycleTableRows.map((row) => (
                              <tr key={row.label} className="hover:bg-muted/20">
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.label}</td>
                                <td className="px-3 py-2 text-foreground font-medium whitespace-pre-wrap break-words max-w-[32rem]">{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/30 border-b border-border">
                        Bảng 2 — Ao, thức ăn & FCR
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/20 border-b border-border">
                              <th className="text-left px-3 py-2 w-[40%] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chỉ tiêu</th>
                              <th className="text-left px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Giá trị</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {pondOpsTableRows.map((row) => (
                              <tr key={row.label} className="hover:bg-muted/20">
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.label}</td>
                                <td className="px-3 py-2 text-foreground font-medium text-sm break-words">{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {detailLayout === 'cards' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-6 rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Thông tin chu kỳ</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tên chu kỳ</p>
                        <p className="font-semibold text-foreground mt-0.5">{cycle.name || '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trạng thái</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          {cycle.status === 'CC' ? '🟢 Có cá / Đang nuôi' : cycle.status === 'CT' ? '⚪ Chưa thả / Quay vòng' : cycle.status || '—'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ngày thả</p>
                        <p className="font-semibold text-foreground mt-0.5">{formatDateDisplay(cycle.stock_date)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tổng cá thả</p>
                        <p className="font-semibold text-foreground mt-0.5">{fmtNumber(cycle.total_fish)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Size giống</p>
                        <p className="font-semibold text-foreground mt-0.5">{cycle.seed_size != null ? `${cycle.seed_size} cm` : '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">TL giống</p>
                        <p className="font-semibold text-foreground mt-0.5">{cycle.seed_weight != null ? `${cycle.seed_weight} g` : '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mật độ thả</p>
                        <p className="font-semibold text-foreground mt-0.5">{cycle.density != null ? `${cycle.density} con/m²` : '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Số cá hiện tại</p>
                        <p className="font-semibold text-foreground mt-0.5">{fmtNumber(cycle.current_fish ?? cycle.total_fish)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tỷ lệ sống</p>
                        <p className="font-semibold text-foreground mt-0.5">{cycle.survival_rate != null ? `${cycle.survival_rate}%` : '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">TL thu kỳ vọng</p>
                        <p className="font-semibold text-foreground mt-0.5">{cycle.target_weight != null ? `${cycle.target_weight} g` : '—'}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">SL dự kiến</p>
                        <p className="font-semibold text-foreground mt-0.5">{cycle.expected_yield != null ? `${fmtNumber(cycle.expected_yield)} kg` : '—'}</p>
                      </div>
                    </div>

                    <div className="border-t border-border pt-3 space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Mốc thời gian</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Thu DK (gốc)</p>
                          <p className="font-semibold text-foreground mt-0.5">{formatDateDisplay(cycle.initial_expected_harvest_date)}</p>
                        </div>
                        <div className="rounded-lg border border-border p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Thu DK (điều chỉnh)</p>
                          <p className="font-semibold text-foreground mt-0.5">{formatDateDisplay(cycle.expected_harvest_date)}</p>
                        </div>
                        <div className="rounded-lg border border-border p-2 col-span-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hết ngưng thuốc</p>
                          <p className="font-semibold text-foreground mt-0.5">{formatDateDisplay(cycle.withdrawal_end_date)}</p>
                        </div>
                      </div>
                    </div>

                    {cycle.notes && (
                      <div className="rounded-lg border border-border p-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ghi chú</p>
                        <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{cycle.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6 space-y-3">
                    {/* Thông tin ao */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Thông tin ao</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-border p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mã ao</p>
                          <p className="font-mono font-bold text-foreground mt-0.5">{pond?.code || cycle.pond_code || '—'}</p>
                        </div>
                        <div className="rounded-lg border border-border p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chủ hộ</p>
                          <p className="font-semibold text-foreground mt-0.5">{pond?.owner_name || '—'}</p>
                        </div>
                        <div className="rounded-lg border border-border p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Đại lý</p>
                          <p className="font-semibold text-foreground mt-0.5">{pond?.agency_code || '—'}</p>
                        </div>
                        <div className="rounded-lg border border-border p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Diện tích</p>
                          <p className="font-semibold text-foreground mt-0.5">{pond?.area ? `${pond.area} m²` : '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Thống kê thức ăn & FCR */}
                    <div className="rounded-xl border border-border bg-blue-50/30 p-4 space-y-2">
                      <p className="text-[11px] font-bold text-blue-900/90 uppercase tracking-wider">Thức ăn & FCR</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-blue-200 bg-white p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tổng thức ăn</p>
                          <p className="font-bold text-blue-700 mt-0.5">{cycle.total_feed_used != null ? `${fmtNumber(cycle.total_feed_used)} kg` : '—'}</p>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-white p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">FCR</p>
                          <p className="font-bold text-blue-700 mt-0.5">
                            {cycle.fcr != null ? (
                              <span className={cycle.fcr <= 1.3 ? 'text-green-600' : cycle.fcr <= 1.6 ? 'text-yellow-600' : 'text-red-600'}>
                                {cycle.fcr}
                              </span>
                            ) : '—'}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-blue-700/70">FCR = Tổng thức ăn ÷ Sản lượng thực thu</p>
                    </div>

                    {/* Kết quả thu hoạch */}
                    <div className="rounded-xl border border-border bg-green-50/30 p-4 space-y-2">
                      <p className="text-[11px] font-bold text-green-900/90 uppercase tracking-wider">Kết quả thu hoạch</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-green-200 bg-white p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Thực thu</p>
                          <p className="font-bold text-green-700 mt-0.5">{cycle.actual_yield != null ? `${fmtNumber(cycle.actual_yield)} kg` : '—'}</p>
                        </div>
                        <div className="rounded-lg border border-green-200 bg-white p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Đã thu hoạch</p>
                          <p className="font-bold text-green-700 mt-0.5">{cycle.harvest_done ? '✅ Đã chốt' : '⏳ Chưa'}</p>
                        </div>
                        <div className="rounded-lg border border-green-200 bg-white p-2 col-span-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Đạt kế hoạch</p>
                          <p className="font-bold text-green-700 mt-0.5">
                            {cycle.actual_yield != null && cycle.expected_yield != null ? (
                              `${Math.round((cycle.actual_yield / cycle.expected_yield) * 100)}%`
                            ) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mã lô truy xuất */}
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Mã lô truy xuất gợi ý</p>
                      <p className="font-mono text-sm font-bold text-primary">{pond?.code ? `LOT-${pond.code}-${String(new Date().toISOString().slice(0, 10)).replace(/-/g, '')}` : '—'}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Dùng khi ghi phiếu thu hoạch</p>
                    </div>
                  </div>
                </div>
                )}
              </TabsContent>

              <TabsContent value="logs" className="mt-3 outline-none">
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                  <div className="px-3 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                      Bảng chi tiết giống trang Nhật ký — kéo ngang để xem đủ cột ({logs.length} dòng).
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label="Cuộn bảng sang trái"
                        onClick={() => logTableScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label="Cuộn bảng sang phải"
                        onClick={() => logTableScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div
                    ref={logTableScrollRef}
                    role="region"
                    aria-label="Bảng nhật ký chu kỳ"
                    className="overflow-x-auto overscroll-x-contain touch-pan-x scroll-smooth min-h-[200px] max-w-full"
                  >
                    <table className="w-full text-xs sm:text-sm min-w-[1680px] border-collapse">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="sticky left-0 z-10 w-[6.25rem] min-w-[6.25rem] max-w-[6.25rem] bg-muted/95 backdrop-blur-sm text-left px-2 sm:px-3 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-r border-border/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                            NGÀY
                          </th>
                          <th className="sticky left-[6.25rem] z-10 min-w-[7.5rem] bg-muted/95 backdrop-blur-sm text-left px-2 sm:px-3 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-r border-border/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                            MÃ AO
                          </th>
                          <th className="text-left px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            ĐẠI LÝ
                          </th>
                          <th className="text-left px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[7rem]">
                            CHU KỲ
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            HAO HỤT
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            THẢ THÊM
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            THỨC ĂN (KG)
                          </th>
                          <th className="text-left px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            MÃ TA
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            pH
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            T°
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            DO
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            NH3
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            NO2
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            H2S
                          </th>
                          <th className="text-left px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[6rem]">
                            MÀU NC
                          </th>
                          <th className="text-right px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            TL TB
                          </th>
                          <th className="text-left px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[8rem]">
                            THUỐC
                          </th>
                          <th className="text-left px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap min-w-[8rem]">
                            GHI CHÚ
                          </th>
                          <th className="sticky right-0 z-10 bg-muted/95 backdrop-blur-sm px-2 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap w-28 border-l border-border/80 shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                            THAO TÁC
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {logs.length === 0 ? (
                          <tr>
                            <td colSpan={19} className="text-center py-10 text-muted-foreground">
                              Chưa có nhật ký
                            </td>
                          </tr>
                        ) : (
                          logs.map((l) => {
                            const agency = pond?.agency_code || '—';
                            const pondCodeCell = l.pond_code || cycle?.pond_code || '—';
                            const medicineBits = [
                              l.medicine_used ? `💊 ${l.medicine_used}` : null,
                              l.withdrawal_end_date
                                ? `Hết NT: ${l.withdrawal_end_date}`
                                : l.withdrawal_days
                                  ? `Ngưng ${l.withdrawal_days} ngày`
                                  : null,
                            ].filter(Boolean);
                            const medicineStr = medicineBits.length ? medicineBits.join(' · ') : '—';
                            return (
                              <tr key={l.id} className="hover:bg-primary/5 group transition-colors bg-white">
                                <td className="sticky left-0 z-[1] w-[6.25rem] min-w-[6.25rem] max-w-[6.25rem] bg-white group-hover:bg-primary/5 px-2 sm:px-3 py-2.5 sm:py-3 text-slate-500 font-medium whitespace-nowrap border-r border-border/60 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.04)]">
                                  {formatDateDisplay(l.log_date)}
                                </td>
                                <td className="sticky left-[6.25rem] z-[1] min-w-[7.5rem] bg-white group-hover:bg-primary/5 px-2 sm:px-3 py-2.5 sm:py-3 font-bold text-slate-700 whitespace-nowrap border-r border-border/60 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.04)]">
                                  {pondCodeCell}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600 whitespace-nowrap">{agency}</td>
                                <td
                                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600 max-w-[10rem] truncate"
                                  title={cycleLabelForRow}
                                >
                                  {cycleLabelForRow}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right font-bold text-red-600 whitespace-nowrap">
                                  {Number(l.dead_fish) > 0 ? `-${l.dead_fish}` : '—'}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                  {Number(l.stocked_fish) > 0 ? `+${l.stocked_fish}` : '—'}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right font-bold text-blue-600 whitespace-nowrap">
                                  {l.feed_amount != null && l.feed_amount !== '' ? `${l.feed_amount}` : '—'}
                                </td>
                                <td
                                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600 whitespace-nowrap max-w-[6rem] truncate"
                                  title={l.feed_code || ''}
                                >
                                  {cellDash(l.feed_code)}
                                </td>
                                <td
                                  className={`px-3 sm:px-4 py-2.5 sm:py-3 text-right font-semibold whitespace-nowrap ${l.ph != null && l.ph !== '' && (Number(l.ph) < 6.5 || Number(l.ph) > 8.5) ? 'text-red-600' : 'text-slate-600'}`}
                                >
                                  {cellDash(l.ph)}
                                </td>
                                <td
                                  className={`px-3 sm:px-4 py-2.5 sm:py-3 text-right font-semibold whitespace-nowrap ${l.temperature != null && l.temperature !== '' && (Number(l.temperature) < 25 || Number(l.temperature) > 32) ? 'text-red-600' : 'text-slate-600'}`}
                                >
                                  {cellDash(l.temperature)}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-slate-600 whitespace-nowrap">{cellDash(l.do)}</td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-slate-600 whitespace-nowrap">{cellDash(l.nh3)}</td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-slate-600 whitespace-nowrap">{cellDash(l.no2)}</td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-slate-600 whitespace-nowrap">{cellDash(l.h2s)}</td>
                                <td
                                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600 max-w-[8rem] truncate"
                                  title={l.water_color || ''}
                                >
                                  {cellDash(l.water_color)}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-slate-600 whitespace-nowrap">
                                  {l.avg_weight != null && l.avg_weight !== '' ? `${l.avg_weight}` : '—'}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600 max-w-[10rem]">
                                  <div className="truncate" title={medicineStr !== '—' ? medicineStr : ''}>
                                    {medicineStr}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-slate-600 max-w-[12rem]">
                                  <div className="truncate" title={l.notes || l.disease_notes || ''}>
                                    {cellDash(l.notes || l.disease_notes)}
                                  </div>
                                </td>
                                <td className="sticky right-0 z-[1] px-2 sm:px-4 py-2.5 sm:py-3 text-right whitespace-nowrap bg-white group-hover:bg-primary/5 border-l border-border/60 shadow-[-2px_0_6px_-2px_rgba(0,0,0,0.04)]">
                                  <div className="flex items-center justify-end gap-1 sm:gap-2">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" aria-label="Thêm">
                                          <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem onClick={() => setEditLog(l)}>
                                          <Pencil className="w-4 h-4 mr-2" /> Sửa nhật ký
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-red-600 focus:text-red-600"
                                          onClick={async () => {
                                            if (!window.confirm('Xóa nhật ký này?')) return;
                                            setDeletingLogId(l.id);
                                            try {
                                              await base44.entities.PondLog.delete(l.id);
                                              await reloadAfterLogMutation();
                                            } catch (e) {
                                              alert(formatSupabaseError(e));
                                            } finally {
                                              setDeletingLogId(null);
                                            }
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" /> Xóa
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                    <button
                                      type="button"
                                      onClick={() => setEditLog(l)}
                                      className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 shrink-0"
                                      title="Sửa nhật ký"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-slate-600" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!window.confirm('Xóa nhật ký này?')) return;
                                        setDeletingLogId(l.id);
                                        try {
                                          await base44.entities.PondLog.delete(l.id);
                                          await reloadAfterLogMutation();
                                        } catch (e) {
                                          alert(formatSupabaseError(e));
                                        } finally {
                                          setDeletingLogId(null);
                                        }
                                      }}
                                      disabled={deletingLogId === l.id}
                                      className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 disabled:opacity-50 shrink-0"
                                      title="Xóa nhật ký"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="harvest" className="mt-3 outline-none">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-muted-foreground">Lịch sử phiếu thu hoạch (read-only).</p>
                  <Button type="button" onClick={() => setHarvestOpen(true)} disabled={!pond} className="bg-primary text-white">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Ghi thu hoạch
                  </Button>
                </div>
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">NGÀY THU</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">THỰC THU (KG)</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">SỐ CÁ THU</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">TL TB (G)</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">GIÁ (Đ/KG)</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">TỔNG (Đ)</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">MÃ LÔ</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">GHI CHÚ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {harvests.length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Chưa có phiếu thu hoạch</td></tr>
                        ) : harvests.map((h) => (
                          <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{formatDateDisplay(h.harvest_date)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">{h.actual_yield != null ? fmtNumber(h.actual_yield) : '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{h.fish_count_harvested != null ? fmtNumber(h.fish_count_harvested) : '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{h.avg_weight_harvest != null ? fmtNumber(h.avg_weight_harvest) : '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{h.price_per_kg != null ? fmtNumber(h.price_per_kg) : '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{h.total_value != null ? fmtNumber(h.total_value) : '—'}</td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">{h.lot_code || '—'}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-[22rem] truncate" title={h.notes || ''}>{h.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => { setTab('harvest'); setHarvestOpen(true); }} disabled={!cycle || !pond}>
            <ShoppingCart className="w-4 h-4 mr-2" />
            Thu hoạch
          </Button>
          <Button type="button" variant="outline" onClick={() => onEdit?.(cycle)} disabled={!cycle}>
            <Pencil className="w-4 h-4 mr-2" />
            Sửa chu kỳ
          </Button>
        </DialogFooter>

        <PondLogEditDialog
          open={Boolean(editLog)}
          log={editLog}
          onClose={() => setEditLog(null)}
          onSaved={async () => {
            setEditLog(null);
            try {
              await reloadAfterLogMutation();
            } catch (e) {
              alert(formatSupabaseError(e));
            }
          }}
        />

        <Dialog open={harvestOpen} onOpenChange={setHarvestOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Thu hoạch — {pond?.code || cycle?.pond_code || ''} {cycle?.name ? `· ${cycle.name}` : ''}</DialogTitle>
            </DialogHeader>
            {pond && cycle ? (
              <PondHarvestTab
                pond={pond}
                cycle={cycle}
                isWithdrawal={Boolean(cycle.withdrawal_end_date)}
                onUpdate={async () => {
                  const [h, rows] = await Promise.all([
                    base44.entities.HarvestRecord.filter({ pond_cycle_id: cycleId }, '-harvest_date', 500),
                    base44.entities.PondCycle.filter({ id: cycleId }, '-updated_at', 1),
                  ]);
                  setHarvests(h || []);
                  setCycle(rows?.[0] || cycle);
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Đang tải dữ liệu ao/chu kỳ…</p>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

