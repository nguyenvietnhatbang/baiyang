import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WaterColorCombobox from '@/components/ponds/WaterColorCombobox';
import { Save, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { POND_LOG_ENV_RANGES, pondLogEnvOutOfRange } from '@/lib/pondLogEnvRanges';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';

function cycleSelectLabel(c, idx) {
  const n = c?.name?.trim();
  return n || (c?.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${idx + 1}`);
}

/** Nhãn một dòng cho ô chọn / trigger (không dùng UUID). */
function cycleChoiceLine(c, cycles) {
  if (!c) return '';
  const i = Math.max(0, cycles.findIndex((x) => String(x.id) === String(c.id)));
  return `${cycleSelectLabel(c, i)} · ${c.status || '—'} · Số cá: ${c.current_fish != null ? c.current_fish.toLocaleString() : '—'}`;
}

function isAlert(key, value) {
  return pondLogEnvOutOfRange(key, value);
}

function toDateInputValue(d) {
  if (d == null || d === '') return '';
  if (typeof d === 'string') return d.length >= 10 ? d.slice(0, 10) : '';
  try {
    return format(new Date(d), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export default function PondLogCreateDialog({ open, onClose, pond, onSaved }) {
  const cycles = useMemo(() => {
    const raw = Array.isArray(pond?.pond_cycles) ? [...pond.pond_cycles] : [];
    raw.sort((a, b) => {
      const da = String(a.stock_date || a.created_at || '');
      const db = String(b.stock_date || b.created_at || '');
      if (da !== db) return db.localeCompare(da);
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
    return raw;
  }, [pond?.pond_cycles]);

  const [selectedCycleId, setSelectedCycleId] = useState('');

  const [form, setForm] = useState({
    log_date: format(new Date(), 'yyyy-MM-dd'),
    ph: '',
    temperature: '',
    do: '',
    nh3: '',
    no2: '',
    h2s: '',
    water_color: '',
    feed_code: '',
    feed_amount: '',
    dead_fish: 0,
    avg_weight: '',
    medicine_used: '',
    medicine_dosage: '',
    withdrawal_days: '',
    disease_notes: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expectedHarvestDate, setExpectedHarvestDate] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      log_date: format(new Date(), 'yyyy-MM-dd'),
      ph: '',
      temperature: '',
      do: '',
      nh3: '',
      no2: '',
      h2s: '',
      water_color: '',
      feed_code: '',
      feed_amount: '',
      dead_fish: 0,
      avg_weight: '',
      medicine_used: '',
      medicine_dosage: '',
      withdrawal_days: '',
      disease_notes: '',
      notes: '',
    });
    setSelectedCycleId('');
  }, [open, pond?.id, cycles]);

  const resolvedCycleId = String(selectedCycleId || pickActiveCycle(cycles)?.id || '');

  const selectedCycle = useMemo(() => {
    if (!resolvedCycleId) return null;
    return cycles.find((c) => String(c.id) === resolvedCycleId) || null;
  }, [cycles, resolvedCycleId]);

  useEffect(() => {
    if (!open) {
      setExpectedHarvestDate('');
      return;
    }
    if (!selectedCycle) {
      setExpectedHarvestDate('');
      return;
    }
    setExpectedHarvestDate(toDateInputValue(selectedCycle.expected_harvest_date));
  }, [open, selectedCycle?.id, selectedCycle?.expected_harvest_date]);

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
    if (!pond?.id || !selectedCycle?.id) {
      setError('Thiếu thông tin ao hoặc chu kỳ');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await base44.entities.PondLog.create({
        pond_id: pond.id,
        pond_code: pond.code,
        pond_cycle_id: selectedCycle.id,
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
        dead_fish: toNumOrNull(form.dead_fish) ?? 0,
        avg_weight: toNumOrNull(form.avg_weight),
        medicine_used: form.medicine_used?.trim() || null,
        medicine_dosage: form.medicine_dosage?.trim() || null,
        withdrawal_days: toNumOrNull(form.withdrawal_days),
        disease_notes: form.disease_notes?.trim() || null,
        notes: form.notes?.trim() || null,
      });
      const nextHarvest = expectedHarvestDate.trim() || null;
      const prevHarvest = toDateInputValue(selectedCycle.expected_harvest_date) || null;
      if (nextHarvest !== prevHarvest) {
        await base44.entities.PondCycle.update(selectedCycle.id, { expected_harvest_date: nextHarvest });
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
          <DialogTitle>Ghi nhật ký mới — {pond?.code || ''}</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="space-y-4 py-1">
          {/* Thông tin ao */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm space-y-2">
            {cycles.length === 0 && (
              <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-[11px] leading-snug">
                Ao chưa có chu kỳ nuôi — tạo chu kỳ trong Quản lý ao trước khi ghi nhật ký.
              </p>
            )}
            {cycles.length > 1 && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-stone-600">Chu kỳ ghi nhật ký</Label>
                <Select
                  value={resolvedCycleId || undefined}
                  onValueChange={(v) => setSelectedCycleId(v)}
                >
                  <SelectTrigger className="mt-0 h-9 bg-white text-xs">
                    <SelectValue placeholder="Chọn chu kỳ...">
                      {selectedCycle ? cycleChoiceLine(selectedCycle, cycles) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cycles.map((c, i) => (
                      <SelectItem key={String(c.id)} value={String(c.id)}>
                        {cycleChoiceLine(c, cycles)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 leading-tight">
              <div>
                <span className="text-slate-500">Mã ao:</span>{' '}
                <span className="font-bold text-slate-700">{pond?.code}</span>
              </div>
              <div>
                <span className="text-slate-500">Chủ hộ:</span>{' '}
                <span className="font-medium text-slate-700">{pond?.owner_name}</span>
              </div>
              <div>
                <span className="text-slate-500">Chu kỳ:</span>{' '}
                <span className="font-medium text-slate-700">
                  {selectedCycle
                    ? cycleSelectLabel(
                        selectedCycle,
                        Math.max(0, cycles.findIndex((c) => String(c.id) === String(selectedCycle.id)))
                      )
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Số cá:</span>{' '}
                <span className="font-medium text-slate-700">{selectedCycle?.current_fish?.toLocaleString() || '—'}</span>
              </div>
            </div>
            {selectedCycle && (
              <div className="space-y-1 pt-1.5 border-t border-slate-200/80">
                <Label htmlFor="pond-log-expected-harvest" className="text-[11px] font-semibold text-stone-600">
                  Ngày thu hoạch dự kiến
                </Label>
                <Input
                  id="pond-log-expected-harvest"
                  type="date"
                  className="h-9 text-xs bg-white w-full sm:max-w-[11rem]"
                  value={expectedHarvestDate}
                  onChange={(e) => setExpectedHarvestDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Ngày ghi và màu nước */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ghi *</Label>
              <Input className="mt-1" type="date" value={form.log_date} onChange={set('log_date')} />
            </div>
            <div>
              <Label htmlFor="create-log-water-color" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Màu nước
              </Label>
              <div className="mt-1">
                <WaterColorCombobox
                  id="create-log-water-color"
                  value={form.water_color}
                  onChange={(v) => setForm((p) => ({ ...p, water_color: v }))}
                />
              </div>
            </div>
          </div>

          {/* Thông số môi trường */}
          <div>
            <Label className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 block">Thông số môi trường</Label>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(POND_LOG_ENV_RANGES).map(([key, cfg]) => (
                <div key={key}>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {cfg.label}
                    <span className="text-muted-foreground/60 normal-case font-normal ml-1 text-[10px]">
                      [{cfg.min}–{cfg.max}]
                    </span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form[key]}
                    onChange={set(key)}
                    className={`mt-1 text-sm ${isAlert(key, form[key]) ? 'border-red-400 bg-red-50' : ''}`}
                    placeholder="—"
                  />
                  {isAlert(key, form[key]) && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3" /> Vượt ngưỡng!
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Thức ăn và hao hụt */}
          <div>
            <Label className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 block">Thức ăn & Hao hụt</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã thức ăn</Label>
                <Input className="mt-1" value={form.feed_code} onChange={set('feed_code')} placeholder="VD: TA-501" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lượng thức ăn (kg)</Label>
                <Input className="mt-1" type="number" value={form.feed_amount} onChange={set('feed_amount')} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-red-600 uppercase tracking-wide">Số cá hao hụt (con)</Label>
                <Input className="mt-1 border-red-200" type="number" value={form.dead_fish} onChange={set('dead_fish')} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL TB ước tính (g)</Label>
                <Input className="mt-1" type="number" value={form.avg_weight} onChange={set('avg_weight')} />
              </div>
            </div>
          </div>

          {/* Thuốc & Xử lý bệnh */}
          <div className="border-t border-dashed border-orange-200 pt-4">
            <Label className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 block">Thuốc & Xử lý bệnh</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên thuốc/Sản phẩm</Label>
                <Input className="mt-1" value={form.medicine_used} onChange={set('medicine_used')} placeholder="Để trống nếu không dùng" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Liều lượng</Label>
                <Input className="mt-1" value={form.medicine_dosage} onChange={set('medicine_dosage')} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ngưng thuốc (ngày)</Label>
                <Input className="mt-1" type="number" value={form.withdrawal_days} onChange={set('withdrawal_days')} placeholder="VD: 14" />
              </div>
            </div>
            <div className="mt-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nhật ký xử lý bệnh</Label>
              <Textarea className="mt-1 h-20 text-sm" value={form.disease_notes} onChange={set('disease_notes')} />
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ghi chú chung</Label>
            <Textarea className="mt-1 h-20 text-sm" value={form.notes} onChange={set('notes')} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedCycle?.id}
            className="flex-1 bg-primary text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu nhật ký'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
