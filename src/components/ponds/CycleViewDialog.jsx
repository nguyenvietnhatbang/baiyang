import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, ClipboardList, ShoppingCart, MoreHorizontal, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import PondLogEditDialog from '@/components/ponds/PondLogEditDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';

function fmtNumber(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

export default function CycleViewDialog({ open, onClose, cycleId, onEdit }) {
  const [tab, setTab] = useState('logs');
  const [cycle, setCycle] = useState(null);
  const [logs, setLogs] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editLog, setEditLog] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTab('logs');
  }, [open]);

  useEffect(() => {
    if (!open || !cycleId) {
      setCycle(null);
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
        const [l, h] = await Promise.all([
          base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', 500),
          base44.entities.HarvestRecord.filter({ pond_cycle_id: cycleId }, '-harvest_date', 500),
        ]);
        if (!cancelled) {
          setCycle(c);
          setLogs(l || []);
          setHarvests(h || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatSupabaseError(e));
          setCycle(null);
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

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-6xl">
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
                <p className="font-semibold text-foreground mt-0.5">{cycle.stock_date || '—'}</p>
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
                <TabsTrigger value="logs" className="flex items-center gap-1.5 text-xs">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Nhật ký
                </TabsTrigger>
                <TabsTrigger value="harvest" className="flex items-center gap-1.5 text-xs">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Thu hoạch
                </TabsTrigger>
              </TabsList>

              <TabsContent value="logs" className="mt-3 outline-none">
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">NGÀY</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">pH</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">T°</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">DO</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">MÀU NƯỚC</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">TA (KG)</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">HAO HỤT</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">THUỐC</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">GHI CHÚ</th>
                          <th className="px-4 py-3 w-12" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {logs.length === 0 ? (
                          <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">Chưa có nhật ký</td></tr>
                        ) : logs.map((l) => (
                          <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{l.log_date || '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{l.ph ?? '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{l.temperature ?? '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{l.do ?? '—'}</td>
                            <td className="px-4 py-3 text-slate-600">{l.water_color || '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{l.feed_amount != null ? fmtNumber(l.feed_amount) : '—'}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{l.dead_fish != null ? fmtNumber(l.dead_fish) : '—'}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {l.medicine_used ? `${l.medicine_used}${l.withdrawal_days ? ` (${l.withdrawal_days} ngày)` : ''}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-[22rem] truncate" title={l.notes || ''}>
                              {l.notes || l.disease_notes || '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem onClick={() => setEditLog(l)}>
                                    <Pencil className="w-4 h-4 mr-2" /> Sửa nhật ký
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={async () => {
                                      if (!window.confirm('Xóa nhật ký này?')) return;
                                      try {
                                        await base44.entities.PondLog.delete(l.id);
                                        const next = await base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', 500);
                                        setLogs(next || []);
                                      } catch (e) {
                                        alert(formatSupabaseError(e));
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Xóa
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="harvest" className="mt-3 outline-none">
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
                            <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{h.harvest_date || '—'}</td>
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
            const next = await base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', 500);
            setLogs(next || []);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

