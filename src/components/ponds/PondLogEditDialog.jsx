import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';

const WATER_COLORS = ['Xanh lá', 'Xanh trà', 'Nâu', 'Nâu đỏ', 'Vàng nhạt', 'Trong'];

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
    dead_fish: '',
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
      dead_fish: log.dead_fish ?? '',
      avg_weight: log.avg_weight ?? '',
      medicine_used: log.medicine_used || '',
      medicine_dosage: log.medicine_dosage || '',
      withdrawal_days: log.withdrawal_days ?? '',
      disease_notes: log.disease_notes || '',
      notes: log.notes || '',
    });
  }, [open, log?.id]);

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
        dead_fish: toNumOrNull(form.dead_fish) ?? 0,
        avg_weight: toNumOrNull(form.avg_weight),
        medicine_used: form.medicine_used?.trim() || null,
        medicine_dosage: form.medicine_dosage?.trim() || null,
        withdrawal_days: toNumOrNull(form.withdrawal_days),
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
          return;
        }
        await base44.entities.PondLog.create({
          ...payload,
          pond_id: log.pond_id,
          pond_cycle_id: log.pond_cycle_id,
        });
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {log?.id ? `Sửa nhật ký — ${log?.pond_code || ''} ${log?.log_date ? `· ${log.log_date}` : ''}` : `Ghi nhật ký mới — ${log?.pond_code || ''}`}
          </DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="space-y-4 py-1">
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">pH</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.ph} onChange={set('ph')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">T°</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.temperature} onChange={set('temperature')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DO</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.do} onChange={set('do')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">NH3</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.nh3} onChange={set('nh3')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">NO2</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.no2} onChange={set('no2')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">H2S</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.h2s} onChange={set('h2s')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã thức ăn</Label>
              <Input className="mt-1" value={form.feed_code} onChange={set('feed_code')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lượng thức ăn (kg)</Label>
              <Input className="mt-1" type="number" value={form.feed_amount} onChange={set('feed_amount')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hao hụt (con)</Label>
              <Input className="mt-1" type="number" value={form.dead_fish} onChange={set('dead_fish')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL TB ước tính (g)</Label>
              <Input className="mt-1" type="number" value={form.avg_weight} onChange={set('avg_weight')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thuốc/Sản phẩm</Label>
              <Input className="mt-1" value={form.medicine_used} onChange={set('medicine_used')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Liều lượng</Label>
              <Input className="mt-1" value={form.medicine_dosage} onChange={set('medicine_dosage')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngưng thuốc (ngày)</Label>
              <Input className="mt-1" type="number" value={form.withdrawal_days} onChange={set('withdrawal_days')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nhật ký xử lý bệnh</Label>
              <Textarea className="mt-1 h-24 text-sm" value={form.disease_notes} onChange={set('disease_notes')} />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ghi chú</Label>
              <Textarea className="mt-1 h-24 text-sm" value={form.notes} onChange={set('notes')} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSave} disabled={saving} className="bg-primary text-white">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Đang lưu...' : log?.id ? 'Lưu' : 'Tạo nhật ký'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

