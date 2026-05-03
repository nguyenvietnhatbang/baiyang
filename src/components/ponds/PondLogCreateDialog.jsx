import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { POND_LOG_ENV_RANGES, pondLogEnvOutOfRange } from '@/lib/pondLogEnvRanges';

const WATER_COLORS = ['Xanh lá', 'Xanh trà', 'Nâu', 'Nâu đỏ', 'Vàng nhạt', 'Trong'];

function isAlert(key, value) {
  return pondLogEnvOutOfRange(key, value);
}

export default function PondLogCreateDialog({ open, onClose, pond, cycle, onSaved }) {
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

  useEffect(() => {
    if (open) {
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
    }
  }, [open]);

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
    if (!pond?.id || !cycle?.id) {
      setError('Thiếu thông tin ao hoặc chu kỳ');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await base44.entities.PondLog.create({
        pond_id: pond.id,
        pond_cycle_id: cycle.id,
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
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
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
                <span className="font-medium text-slate-700">{cycle?.name || cycle?.stock_date || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Số cá:</span>{' '}
                <span className="font-medium text-slate-700">{cycle?.current_fish?.toLocaleString() || '—'}</span>
              </div>
            </div>
          </div>

          {/* Ngày ghi và màu nước */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ghi *</Label>
              <Input className="mt-1" type="date" value={form.log_date} onChange={set('log_date')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Màu nước</Label>
              <Select value={form.water_color || '__none__'} onValueChange={(v) => setForm((p) => ({ ...p, water_color: v === '__none__' ? '' : v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn màu..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {WATER_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <Button type="button" onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-white">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : 'Lưu nhật ký'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
