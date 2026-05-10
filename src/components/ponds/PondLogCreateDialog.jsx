import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WaterColorCombobox from '@/components/ponds/WaterColorCombobox';
import { Save, AlertTriangle, ClipboardList, Droplets, Wheat, Pill, StickyNote } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { POND_LOG_ENV_RANGES, pondLogEnvOutOfRange } from '@/lib/pondLogEnvRanges';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';
import { recalculateCycleMetrics } from '@/lib/recalculateCycleMetrics';
import { plannedHarvestDateForDisplay } from '@/lib/planReportHelpers';

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

function calcWithdrawalDays(logDate, withdrawalEndDate) {
  if (!logDate || !withdrawalEndDate) return null;
  const start = new Date(logDate);
  const end = new Date(withdrawalEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((end - start) / msPerDay));
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
    stocked_fish: 0,
    dead_fish: 0,
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
  const [logTab, setLogTab] = useState('chung');
  // growth_g là nhập tay, không tự tính trong form

  useEffect(() => {
    if (!open) return;
    setLogTab('chung');
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
      stocked_fish: 0,
      dead_fish: 0,
      avg_weight: '',
      growth_g: '',
      medicine_used: '',
      medicine_dosage: '',
      withdrawal_end_date: '',
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

  // growth_g là nhập tay, không tự tính

  const cycleYieldBreakdown = useMemo(() => {
    if (!selectedCycle) return { cc: 0, ct: 0, th: 0 };
    const yieldKg = Number(selectedCycle.expected_yield) || 0;
    const st = String(selectedCycle.status || 'CT').toUpperCase();
    return {
      cc: st === 'CC' ? yieldKg : 0,
      ct: st === 'CT' ? yieldKg : 0,
      th: yieldKg,
    };
  }, [selectedCycle]);

  useEffect(() => {
    if (!open) {
      setExpectedHarvestDate('');
      return;
    }
    if (!selectedCycle) {
      setExpectedHarvestDate('');
      return;
    }
    setExpectedHarvestDate(toDateInputValue(plannedHarvestDateForDisplay(selectedCycle)));
  }, [open, selectedCycle?.id, selectedCycle?.expected_harvest_date, selectedCycle?.initial_expected_harvest_date]);

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
        stocked_fish: toNumOrNull(form.stocked_fish) ?? 0,
        dead_fish: toNumOrNull(form.dead_fish) ?? 0,
        avg_weight: toNumOrNull(form.avg_weight),
        growth_g: toNumOrNull(form.growth_g),
        medicine_used: form.medicine_used?.trim() || null,
        medicine_dosage: form.medicine_dosage?.trim() || null,
        withdrawal_days: calcWithdrawalDays(form.log_date, form.withdrawal_end_date),
        disease_notes: form.disease_notes?.trim() || null,
        notes: form.notes?.trim() || null,
      });
      const nextHarvest = expectedHarvestDate.trim() || null;
      const prevHarvest = toDateInputValue(plannedHarvestDateForDisplay(selectedCycle)) || null;
      if (nextHarvest !== prevHarvest) {
        await base44.entities.PondCycle.update(selectedCycle.id, { expected_harvest_date: nextHarvest });
      }
      await recalculateCycleMetrics(selectedCycle.id);
      await onSaved?.();
      onClose?.();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose?.() : null)}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-4 sm:max-w-3xl sm:p-6">
        <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
          <DialogTitle className="text-base leading-snug sm:text-lg">Ghi nhật ký mới — {pond?.code || ''}</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="mt-2 shrink-0 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}

        <Tabs value={logTab} onValueChange={setLogTab} className="mt-3 flex min-h-0 flex-1 flex-col gap-0">
          <TabsList
            variant="line"
            className="mb-2 flex h-auto w-full max-w-full shrink-0 flex-nowrap justify-start gap-0.5 overflow-x-auto overflow-y-hidden rounded-none border-0 border-b border-border bg-transparent p-0 pb-0 shadow-none sm:flex-wrap sm:overflow-x-visible sm:pb-1"
          >
            <TabsTrigger value="chung" className="shrink-0 gap-1 rounded-md px-2.5 py-2 text-[11px] sm:text-xs data-active:after:bottom-0">
              <ClipboardList className="size-3.5 opacity-70" />
              Chung
            </TabsTrigger>
            <TabsTrigger value="moi-truong" className="shrink-0 gap-1 rounded-md px-2.5 py-2 text-[11px] sm:text-xs data-active:after:bottom-0">
              <Droplets className="size-3.5 opacity-70" />
              Nước
            </TabsTrigger>
            <TabsTrigger value="thuc-an" className="shrink-0 gap-1 rounded-md px-2.5 py-2 text-[11px] sm:text-xs data-active:after:bottom-0">
              <Wheat className="size-3.5 opacity-70" />
              Thức ăn
            </TabsTrigger>
            <TabsTrigger value="thuoc" className="shrink-0 gap-1 rounded-md px-2.5 py-2 text-[11px] sm:text-xs data-active:after:bottom-0">
              <Pill className="size-3.5 opacity-70" />
              Thuốc
            </TabsTrigger>
            <TabsTrigger value="ghi-chu" className="shrink-0 gap-1 rounded-md px-2.5 py-2 text-[11px] sm:text-xs data-active:after:bottom-0">
              <StickyNote className="size-3.5 opacity-70" />
              Ghi chú
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 [-webkit-overflow-scrolling:touch]">
            <TabsContent value="chung" className="mt-0 outline-none">
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm space-y-2">
                  {cycles.length === 0 && (
                    <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-[11px] leading-snug">
                      Ao chưa có chu kỳ nuôi — tạo chu kỳ trong Quản lý ao trước khi ghi nhật ký.
                    </p>
                  )}
                  {cycles.length > 1 && (
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-stone-600">Chu kỳ ghi nhật ký</Label>
                      <Select value={resolvedCycleId || undefined} onValueChange={(v) => setSelectedCycleId(v)}>
                        <SelectTrigger className="mt-0 h-9 bg-white text-xs">
                          <SelectValue placeholder="Chọn chu kỳ...">
                            {selectedCycle ? cycleChoiceLine(selectedCycle, cycles) : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {cycles.map((c) => (
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
                    <div className="col-span-2">
                      <span className="text-slate-500">Số cá ban đầu thả:</span>{' '}
                      <span className="font-medium text-slate-700">{selectedCycle?.total_fish?.toLocaleString() || '—'}</span>
                    </div>
                  </div>
                  {selectedCycle && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80">
                      <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-blue-700 uppercase">CC</p>
                        <p className="text-xs font-bold text-blue-800 mt-0.5">
                          {cycleYieldBreakdown.cc > 0 ? cycleYieldBreakdown.cc.toLocaleString() : '0'}
                        </p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-slate-700 uppercase">CT</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">
                          {cycleYieldBreakdown.ct > 0 ? cycleYieldBreakdown.ct.toLocaleString() : '0'}
                        </p>
                      </div>
                      <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-emerald-700 uppercase">TH</p>
                        <p className="text-xs font-bold text-emerald-800 mt-0.5">
                          {cycleYieldBreakdown.th > 0 ? cycleYieldBreakdown.th.toLocaleString() : '0'}
                        </p>
                      </div>
                    </div>
                  )}
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ghi *</Label>
                    <Input className="mt-1 h-11 text-base sm:h-10 sm:text-sm" type="date" value={form.log_date} onChange={set('log_date')} />
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
              </div>
            </TabsContent>

            <TabsContent value="moi-truong" className="mt-0 outline-none">
              <div>
                <Label className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 block">Thông số môi trường</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                        className={`mt-1 h-11 text-base sm:h-10 sm:text-sm ${isAlert(key, form[key]) ? 'border-red-400 bg-red-50' : ''}`}
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
            </TabsContent>

            <TabsContent value="thuc-an" className="mt-0 outline-none">
              <div>
                <Label className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 block">Thức ăn & Hao hụt</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã thức ăn</Label>
                    <Input className="mt-1 h-11 text-base sm:h-10 sm:text-sm" value={form.feed_code} onChange={set('feed_code')} placeholder="VD: TA-501" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lượng thức ăn (kg)</Label>
                    <Input className="mt-1 h-11 text-base sm:h-10 sm:text-sm" type="number" value={form.feed_amount} onChange={set('feed_amount')} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Số cá thả thêm (con)</Label>
                    <Input className="mt-1 h-11 border-emerald-200 text-base sm:h-10 sm:text-sm" type="number" value={form.stocked_fish} onChange={set('stocked_fish')} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-red-600 uppercase tracking-wide">Số cá hao hụt (con)</Label>
                    <Input className="mt-1 h-11 border-red-200 text-base sm:h-10 sm:text-sm" type="number" value={form.dead_fish} onChange={set('dead_fish')} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL TB ước tính (g)</Label>
                    <Input className="mt-1 h-11 text-base sm:h-10 sm:text-sm" type="number" value={form.avg_weight} onChange={set('avg_weight')} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tăng trưởng (g)</Label>
                    <Input className="mt-1 h-11 text-base sm:h-10 sm:text-sm" type="number" value={form.growth_g} onChange={set('growth_g')} placeholder="Nhập tay" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="thuoc" className="mt-0 outline-none">
              <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/30 p-3 sm:p-4">
                <Label className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 block">Thuốc & Xử lý bệnh</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên thuốc/Sản phẩm</Label>
                    <Input className="mt-1 h-11 text-base sm:h-10 sm:text-sm" value={form.medicine_used} onChange={set('medicine_used')} placeholder="Để trống nếu không dùng" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Liều lượng</Label>
                    <Input className="mt-1 h-11 text-base sm:h-10 sm:text-sm" value={form.medicine_dosage} onChange={set('medicine_dosage')} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ngưng thuốc</Label>
                    <Input className="mt-1 h-11 max-w-full text-base sm:h-10 sm:max-w-[12rem] sm:text-sm" type="date" value={form.withdrawal_end_date} onChange={set('withdrawal_end_date')} />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nhật ký xử lý bệnh</Label>
                  <Textarea className="mt-1 min-h-[5.5rem] text-base sm:text-sm" value={form.disease_notes} onChange={set('disease_notes')} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ghi-chu" className="mt-0 outline-none">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ghi chú chung</Label>
                <Textarea className="mt-1 min-h-[8rem] text-base sm:text-sm" value={form.notes} onChange={set('notes')} />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="mt-3 flex shrink-0 gap-2 border-t border-border pt-3">
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
