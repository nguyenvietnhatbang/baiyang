import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Fish, QrCode, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import PondQRCode from '@/components/ponds/PondQRCode';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import CycleViewDialog from '@/components/ponds/CycleViewDialog';
import CycleEditDialog from '@/components/ponds/CycleEditDialog';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';
import { formatSupabaseError } from '@/lib/supabaseErrors';

function cycleLabel(c, idx) {
  const n = String(c?.name || '').trim();
  return n || (c?.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${idx + 1}`);
}

export default function PondViewDialog({ open, onClose, pondId, onEdit }) {
  const [tab, setTab] = useState('info');
  const [pond, setPond] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showCycleView, setShowCycleView] = useState(false);
  const [showCycleEdit, setShowCycleEdit] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('info');
  }, [open]);

  useEffect(() => {
    if (!open || !pondId) {
      setPond(null);
      setError('');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const p = await base44.entities.Pond.getWithCycles(pondId);
        if (!cancelled) setPond(p);
      } catch (e) {
        if (!cancelled) {
          setError(formatSupabaseError(e));
          setPond(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pondId]);

  const cycles = useMemo(() => (Array.isArray(pond?.pond_cycles) ? pond.pond_cycles : []), [pond]);

  const handleDeleteCycle = async (cycle) => {
    if (!confirm(`Xóa chu kỳ "${cycleLabel(cycle, 0)}"?\n\nThao tác này không thể hoàn tác.`)) return;
    try {
      await base44.entities.PondCycle.delete(cycle.id);
      // Reload pond data
      const p = await base44.entities.Pond.getWithCycles(pondId);
      setPond(p);
    } catch (e) {
      alert('Lỗi xóa chu kỳ: ' + formatSupabaseError(e));
    }
  };

  const handleCycleSaved = async () => {
    // Reload pond data
    const p = await base44.entities.Pond.getWithCycles(pondId);
    setPond(p);
    setShowCycleEdit(false);
    setSelectedCycle(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-10">
            <Eye className="w-4 h-4 text-muted-foreground" />
            Xem ao {pond?.code || ''}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Chế độ chỉ xem — muốn chỉnh sửa hãy bấm <strong>Sửa</strong>.
          </p>
        </DialogHeader>

        {loading && <div className="text-sm text-muted-foreground py-6 text-center">Đang tải…</div>}
        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
        )}

        {!loading && pond && (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="bg-muted flex-wrap h-auto gap-1 py-1">
              <TabsTrigger value="info" className="flex items-center gap-1.5 text-xs">
                <Fish className="w-3.5 h-3.5" />
                Thông tin ao
              </TabsTrigger>
              <TabsTrigger value="cycles" className="flex items-center gap-1.5 text-xs">
                <Fish className="w-3.5 h-3.5" />
                Chu kỳ
              </TabsTrigger>
              <TabsTrigger value="qr" className="flex items-center gap-1.5 text-xs">
                <QrCode className="w-3.5 h-3.5" />
                Mã QR
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-3 outline-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Mã ao</p>
                  <p className="font-bold text-foreground mt-1 font-mono">{pond.code}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chủ hộ</p>
                  <p className="font-semibold text-foreground mt-1">{pond.owner_name || '—'}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Đại lý</p>
                  <p className="font-semibold text-foreground mt-1">{pond.agency_code || '—'}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Trạng thái</p>
                  <div className="mt-1">
                    <PondStatusBadge status={pond.active_cycle?.status || 'CT'} />
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Diện tích</p>
                  <p className="font-semibold text-foreground mt-1">{pond.area != null ? `${pond.area} m²` : '—'}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Độ sâu</p>
                  <p className="font-semibold text-foreground mt-1">{pond.depth != null ? `${pond.depth} m` : '—'}</p>
                </div>
                <div className="rounded-lg border border-border p-3 sm:col-span-2">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Địa điểm</p>
                  <p className="font-semibold text-foreground mt-1">{pond.location || '—'}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cycles" className="mt-3 outline-none">
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">CHU KỲ</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">TRẠNG THÁI</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">NGÀY THẢ</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">THU HOẠCH DK</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">SỐ CÁ</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">SL DỰ KIẾN</th>
                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {cycles.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Chưa có chu kỳ</td></tr>
                      ) : cycles.map((c, idx) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-3 font-medium text-slate-700">{cycleLabel(c, idx)}</td>
                          <td className="px-4 py-3"><PondStatusBadge status={c.status || 'CT'} /></td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{c.stock_date || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{plannedHarvestDateForDisplay(c) || '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">
                            {c.current_fish != null && !Number.isNaN(Number(c.current_fish))
                              ? Number(c.current_fish).toLocaleString()
                              : (c.total_fish != null ? Number(c.total_fish).toLocaleString() : '—')}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {c.expected_yield != null ? `${Number(c.expected_yield).toLocaleString()} kg` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setSelectedCycle(c);
                                  setShowCycleView(true);
                                }}
                                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                title="Xem chi tiết"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCycle(c);
                                  setShowCycleEdit(true);
                                }}
                                className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
                                title="Sửa chu kỳ"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteCycle(c)}
                                className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center hover:bg-red-200 transition-colors"
                                title="Xóa chu kỳ"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Hover vào hàng để hiện các nút thao tác: <strong>Xem</strong>, <strong>Sửa</strong>, <strong>Xóa</strong>.
              </p>
            </TabsContent>

            <TabsContent value="qr" className="mt-3 outline-none">
              <div className="flex flex-col items-center py-2">
                <PondQRCode pond={pond} size={220} />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onEdit?.(pond)} disabled={!pond}>
            <Pencil className="w-4 h-4 mr-2" />
            Sửa
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Dialog xem chi tiết chu kỳ */}
      {selectedCycle && showCycleView && (
        <CycleViewDialog
          open={showCycleView}
          onClose={() => {
            setShowCycleView(false);
            setSelectedCycle(null);
          }}
          cycle={selectedCycle}
          pond={pond}
        />
      )}

      {/* Dialog sửa chu kỳ */}
      {selectedCycle && showCycleEdit && (
        <CycleEditDialog
          open={showCycleEdit}
          onClose={() => {
            setShowCycleEdit(false);
            setSelectedCycle(null);
          }}
          cycle={selectedCycle}
          pond={pond}
          onSaved={handleCycleSaved}
        />
      )}
    </Dialog>
  );
}

