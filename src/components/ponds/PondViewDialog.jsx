import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Fish, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import PondQRCode from '@/components/ponds/PondQRCode';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
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

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                Xem ao {pond?.code || ''}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Chế độ chỉ xem — muốn chỉnh sửa hãy bấm <strong>Sửa</strong>.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => onEdit?.(pond)}
              disabled={!pond}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Sửa
            </Button>
          </div>
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {cycles.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Chưa có chu kỳ</td></tr>
                      ) : cycles.map((c, idx) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Tab này chỉ xem. Chỉnh sửa chu kỳ: vào tab <strong>Chu kỳ</strong> ở trang danh sách và bấm <strong>Sửa</strong>.
              </p>
            </TabsContent>

            <TabsContent value="qr" className="mt-3 outline-none">
              <div className="flex flex-col items-center py-2">
                <PondQRCode pond={pond} size={220} />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

