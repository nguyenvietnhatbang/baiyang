import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import WaterColorCombobox from '@/components/ponds/WaterColorCombobox';
import { recalculateCycleMetrics } from '@/lib/recalculateCycleMetrics';

function toDateInputValue(d) {
  if (d == null || d === '') return '';
  if (typeof d === 'string') return d.length >= 10 ? d.slice(0, 10) : '';
  try {
    return format(new Date(d), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function calcWithdrawalDays(logDate, withdrawalEndDate) {
  if (!logDate || !withdrawalEndDate) return null;
  const start = new Date(logDate);
  const end = new Date(withdrawalEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((end - start) / msPerDay));
}

function addDaysToDate(logDate, days) {
  if (!logDate || days == null || days === '') return '';
  const base = new Date(logDate);
  const n = Number(days);
  if (Number.isNaN(base.getTime()) || !Number.isFinite(n)) return '';
  return format(new Date(base.getTime() + n * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
}

export default function PondLogEditDialog({ open, onClose, log, onSaved }) {
  const [form, setForm] = useState({
    log_date: '',
    ph: '',
    temperature: '',
    do: '',
    nh3: '',
    no2: '',
    h2s: '',
    water_color: '',
    feed_code: '',
    feed_amount: '',
    stocked_fish: '',
    dead_fish: '',
    avg_weight: '',
    growth_g: '',
    medicine_used: '',
    medicine_dosage: '',
    withdrawal_end_date: '',
    disease_notes: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expectedHarvestDate, setExpectedHarvestDate] = useState('');
  const [initialExpectedHarvestDate, setInitialExpectedHarvestDate] = useState('');

  useEffect(() => {
    if (!open || !log) return;
    setError('');
    setForm({
      log_date: log.log_date || '',
      ph: log.ph ?? '',
      temperature: log.temperature ?? '',
      do: log.do ?? '',
      nh3: log.nh3 ?? '',
      no2: log.no2 ?? '',
      h2s: log.h2s ?? '',
      water_color: log.water_color || '',
      feed_code: log.feed_code || '',
      feed_amount: log.feed_amount ?? '',
      stocked_fish: log.stocked_fish ?? '',
      dead_fish: log.dead_fish ?? '',
      avg_weight: log.avg_weight ?? '',
      growth_g: log.growth_g ?? '',
      medicine_used: log.medicine_used || '',
      medicine_dosage: log.medicine_dosage || '',
      withdrawal_end_date: addDaysToDate(log.log_date || '', log.withdrawal_days),
      disease_notes: log.disease_notes || '',
      notes: log.notes || '',
    });

    let cancelled = false;
    if (!log.pond_cycle_id) {
      setExpectedHarvestDate('');
      setInitialExpectedHarvestDate('');
      return () => {
        cancelled = true;
      };
    }
    setExpectedHarvestDate('');
    setInitialExpectedHarvestDate('');
    void (async () => {
      try {
        const rows = await base44.entities.PondCycle.filter({ id: log.pond_cycle_id }, '-updated_at', 1);
        const c = rows[0];
        if (cancelled) return;
        const val = toDateInputValue(c?.expected_harvest_date);
        setExpectedHarvestDate(val);
        setInitialExpectedHarvestDate(val);
      } catch {
        if (!cancelled) {
          setExpectedHarvestDate('');
          setInitialExpectedHarvestDate('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, log?.id, log?.pond_cycle_id]);

  // growth_g là nhập tay, không tự tính

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const toNumOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const handleSave = async () => {
    if (!form.log_date) {
      setError('Chọn ngày ghi');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        log_date: form.log_date,
        ph: toNumOrNull(form.ph),
        temperature: toNumOrNull(form.temperature),
        do: toNumOrNull(form.do),
        nh3: toNumOrNull(form.nh3),
        no2: toNumOrNull(form.no2),
        h2s: toNumOrNull(form.h2s),
        water_color: form.water_color?.trim() || null,
        feed_code: form.feed_code?.trim() || null,
        feed_amount: toNumOrNull(form.feed_amount),
        stocked_fish: toNumOrNull(form.stocked_fish) ?? 0,
        dead_fish: toNumOrNull(form.dead_fish) ?? 0,
        avg_weight: toNumOrNull(form.avg_weight),
        growth_g: toNumOrNull(form.growth_g),
        medicine_used: form.medicine_used?.trim() || null,
        medicine_dosage: form.medicine_dosage?.trim() || null,
        withdrawal_days: calcWithdrawalDays(form.log_date, form.withdrawal_end_date),
        disease_notes: form.disease_notes?.trim() || null,
        notes: form.notes?.trim() || null,
      };

      if (log?.id) {
        // Sửa nhật ký đã có
        await base44.entities.PondLog.update(log.id, payload);
      } else {
        // Tạo nhật ký mới
        if (!log?.pond_id || !log?.pond_cycle_id) {
          setError('Thiếu thông tin ao hoặc chu kỳ');
          setSaving(false);
          return;
        }
        await base44.entities.PondLog.create({
          ...payload,
          pond_id: log.pond_id,
          pond_cycle_id: log.pond_cycle_id,
        });
      }

      if (log?.pond_cycle_id) {
        const nextNorm = expectedHarvestDate.trim() || null;
        const prevNorm = initialExpectedHarvestDate.trim() || null;
        if (nextNorm !== prevNorm) {
          await base44.entities.PondCycle.update(log.pond_cycle_id, { expected_harvest_date: nextNorm });
        }
        await recalculateCycleMetrics(log.pond_cycle_id);
      }

      await onSaved?.();
      onClose?.();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {log?.id ? `Sửa nhật ký — ${log?.pond_code || ''} ${log?.log_date ? `· ${log.log_date}` : ''}` : `Ghi nhật ký mới — ${log?.pond_code || ''}`}
          </DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ghi *</Label>
              <Input className="mt-1 h-9 text-sm" type="date" value={form.log_date} onChange={set('log_date')} />
            </div>
            <div>
              <Label htmlFor="edit-log-water-color" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Màu nước
              </Label>
              <div className="mt-1">
                <WaterColorCombobox
                  id="edit-log-water-color"
                  value={form.water_color}
                  onChange={(v) => setForm((p) => ({ ...p, water_color: v }))}
                />
              </div>
            </div>
          </div>

          {log?.pond_cycle_id && (
            <div>
              <Label htmlFor="edit-log-expected-harvest" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Ngày thu hoạch dự kiến (chu kỳ)
              </Label>
              <Input
                id="edit-log-expected-harvest"
                type="date"
                className="mt-1 h-9 text-sm w-full sm:max-w-[11rem]"
                value={expectedHarvestDate}
                onChange={(e) => setExpectedHarvestDate(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">pH</Label>
              <Input className="mt-1 h-9 text-sm" type="number" step="0.01" value={form.ph} onChange={set('ph')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">T°</Label>
              <Input className="mt-1 h-9 text-sm" type="number" step="0.01" value={form.temperature} onChange={set('temperature')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DO</Label>
              <Input className="mt-1 h-9 text-sm" type="number" step="0.01" value={form.do} onChange={set('do')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">NH3</Label>
              <Input className="mt-1 h-9 text-sm" type="number" step="0.01" value={form.nh3} onChange={set('nh3')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">NO2</Label>
              <Input className="mt-1 h-9 text-sm" type="number" step="0.01" value={form.no2} onChange={set('no2')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">H2S</Label>
              <Input className="mt-1 h-9 text-sm" type="number" step="0.01" value={form.h2s} onChange={set('h2s')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã thức ăn</Label>
              <Input className="mt-1 h-9 text-sm" value={form.feed_code} onChange={set('feed_code')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lượng thức ăn (kg)</Label>
              <Input className="mt-1 h-9 text-sm" type="number" value={form.feed_amount} onChange={set('feed_amount')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thả thêm (con)</Label>
              <Input className="mt-1 h-9 text-sm" type="number" value={form.stocked_fish} onChange={set('stocked_fish')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hao hụt (con)</Label>
              <Input className="mt-1 h-9 text-sm" type="number" value={form.dead_fish} onChange={set('dead_fish')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL TB ước tính (g)</Label>
              <Input className="mt-1 h-9 text-sm" type="number" value={form.avg_weight} onChange={set('avg_weight')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tăng trưởng (g)</Label>
              <Input className="mt-1 h-9 text-sm" type="number" value={form.growth_g} onChange={set('growth_g')} placeholder="Nhập tay" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thuốc/Sản phẩm</Label>
              <Input className="mt-1 h-9 text-sm" value={form.medicine_used} onChange={set('medicine_used')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Liều lượng</Label>
              <Input className="mt-1 h-9 text-sm" value={form.medicine_dosage} onChange={set('medicine_dosage')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ngưng thuốc</Label>
              <Input className="mt-1 h-9 text-sm" type="date" value={form.withdrawal_end_date} onChange={set('withdrawal_end_date')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nhật ký xử lý bệnh</Label>
              <Textarea className="mt-1 h-16 text-sm resize-none" value={form.disease_notes} onChange={set('disease_notes')} placeholder="Ghi chú về bệnh và cách xử lý..." />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ghi chú</Label>
              <Textarea className="mt-1 h-16 text-sm resize-none" value={form.notes} onChange={set('notes')} placeholder="Ghi chú chung..." />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1 sm:flex-none">
            Hủy
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="bg-primary text-white flex-1 sm:flex-none">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : log?.id ? 'Lưu' : 'Tạo nhật ký'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

