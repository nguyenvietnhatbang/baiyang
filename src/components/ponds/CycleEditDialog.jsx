import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Save, Trash2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';

const STATUS_ITEMS = [
  { value: 'CC', label: 'CC — Có cá / đang nuôi' },
  { value: 'CT', label: 'CT — Chưa thả / quay vòng' },
];

export default function CycleEditDialog({ open, onClose, cycleId, onSaved }) {
  const [cycle, setCycle] = useState(null);
  const [form, setForm] = useState({
    name: '',
    status: 'CT',
    stock_date: '',
    total_fish: '',
    survival_rate: 90,
    target_weight: 800,
    initial_expected_harvest_date: '',
    current_fish: '',
    expected_harvest_date: '',
    withdrawal_end_date: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const title = useMemo(() => {
    const pondCode = cycle?.pond_code ? String(cycle.pond_code) : '';
    const cycleName = cycle?.name ? String(cycle.name) : '';
    return [pondCode, cycleName].filter(Boolean).join(' · ');
  }, [cycle]);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open || !cycleId) {
      setCycle(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await base44.entities.PondCycle.filter({ id: cycleId }, '-updated_at', 1);
        const c = rows?.[0] || null;
        if (!cancelled) {
          setCycle(c);
          setForm({
            name: c?.name || '',
            status: c?.status || 'CT',
            stock_date: c?.stock_date || '',
            total_fish: c?.total_fish ?? '',
            survival_rate: c?.survival_rate ?? 90,
            target_weight: c?.target_weight ?? 800,
            initial_expected_harvest_date: c?.initial_expected_harvest_date || '',
            current_fish: c?.current_fish ?? c?.total_fish ?? '',
            expected_harvest_date: c?.expected_harvest_date || '',
            withdrawal_end_date: c?.withdrawal_end_date || '',
            notes: c?.notes || '',
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatSupabaseError(e));
          setCycle(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cycleId]);

  const computedExpectedYield = useMemo(() => {
    const cur = Number(form.current_fish);
    const sr = Number(form.survival_rate);
    const tw = Number(form.target_weight);
    if (!Number.isFinite(cur) || cur <= 0) return null;
    if (!Number.isFinite(sr) || sr <= 0) return null;
    if (!Number.isFinite(tw) || tw <= 0) return null;
    return Math.round((cur * (sr / 100) * tw) / 1000);
  }, [form.current_fish, form.survival_rate, form.target_weight]);

  const handleSave = async () => {
    if (!cycleId) return;
    setSaving(true);
    setError('');
    try {
      await base44.entities.PondCycle.update(cycleId, {
        name: form.name?.trim() || null,
        status: form.status || 'CT',
        stock_date: form.stock_date || null,
        total_fish: form.total_fish === '' ? null : Number(form.total_fish),
        survival_rate: form.survival_rate === '' ? null : Number(form.survival_rate),
        target_weight: form.target_weight === '' ? null : Number(form.target_weight),
        initial_expected_harvest_date: form.initial_expected_harvest_date || null,
        current_fish: form.current_fish === '' ? null : Number(form.current_fish),
        expected_yield: computedExpectedYield ?? null,
        expected_harvest_date: form.expected_harvest_date || null,
        withdrawal_end_date: form.withdrawal_end_date || null,
        notes: form.notes?.trim() || null,
      });
      await onSaved?.();
      onClose?.();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!cycleId) return;
    setDeleting(true);
    setError('');
    try {
      await base44.entities.PondCycle.delete(cycleId);
      await onSaved?.();
      onClose?.();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setDeleting(false);
  };

  const f = (key) => ({ value: form[key], onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })) });

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Sửa chu kỳ — {title || cycleId || ''}</DialogTitle>
        </DialogHeader>

        {loading && <div className="text-sm text-muted-foreground py-4 text-center">Đang tải…</div>}

        {!loading && (
          <>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

            {!confirmDelete ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 py-1">
                <div className="lg:col-span-4 space-y-4">
                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên chu kỳ</Label>
                      <Input className="mt-1" placeholder="Ví dụ: Thả T3/2026" {...f('name')} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trạng thái</Label>
                        <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))} items={STATUS_ITEMS}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ITEMS.map((it) => (
                              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày thả</Label>
                        <Input className="mt-1" type="date" {...f('stock_date')} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ghi chú</Label>
                    <Textarea className="mt-1 h-32 text-sm" placeholder="Ghi chú..." {...f('notes')} />
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Kế hoạch ban đầu</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tổng cá thả (con)</Label>
                        <Input className="mt-1" type="number" {...f('total_fish')} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thu DK (gốc)</Label>
                        <Input className="mt-1" type="date" {...f('initial_expected_harvest_date')} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tỷ lệ sống (%)</Label>
                        <Input className="mt-1" type="number" {...f('survival_rate')} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL kỳ vọng (g)</Label>
                        <Input className="mt-1" type="number" {...f('target_weight')} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                  <div className="rounded-lg border border-border p-3 space-y-3 bg-amber-50/30">
                    <p className="text-[11px] font-bold text-amber-900/90 uppercase tracking-wider">Kế hoạch điều chỉnh</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Số cá hiện tại</Label>
                        <Input className="mt-1" type="number" {...f('current_fish')} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SL mục tiêu (tự tính)</Label>
                        <Input className="mt-1 bg-muted/40" readOnly value={computedExpectedYield != null ? computedExpectedYield : ''} placeholder="—" />
                        <p className="text-[10px] text-muted-foreground mt-1">= số cá hiện tại × tỷ lệ sống × TL thu ÷ 1.000</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Mốc vận hành</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thu hoạch dự kiến</Label>
                        <Input className="mt-1" type="date" {...f('expected_harvest_date')} />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hết ngưng thuốc</Label>
                        <Input className="mt-1" type="date" {...f('withdrawal_end_date')} />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmDelete(true)}
                      disabled={saving || deleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Xóa chu kỳ
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving || deleting} className="bg-primary text-white">
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Đang lưu...' : 'Lưu'}
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-700 text-sm">Xóa chu kỳ này?</p>
                    <p className="text-xs text-red-600 mt-0.5">Nhật ký và phiếu thu hoạch sẽ bị xóa theo. Không thể hoàn tác.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1" disabled={deleting}>
                    Hủy
                  </Button>
                  <Button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

