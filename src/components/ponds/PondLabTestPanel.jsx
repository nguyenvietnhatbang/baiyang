import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FlaskConical, Plus, Save, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';
import {
  DEFAULT_LAB_CUSTOMER,
  DEFAULT_LAB_NAME,
  LAB_ANALYTES,
  countDetectedAnalytes,
  defaultAnalyteResults,
  formatAnalyteResultDisplay,
  isAnalyteDetected,
  mergeAnalyteResults,
  normalizeAnalyteResultInput,
} from '@/lib/pondLabTestAnalytes';
import { cn } from '@/lib/utils';

export function normalizePondCycles(p) {
  if (!p) return [];
  const list = Array.isArray(p.pond_cycles) ? [...p.pond_cycles] : [];
  const ac = p.active_cycle;
  if (ac?.id && !list.some((c) => String(c.id) === String(ac.id))) list.push(ac);
  return list;
}

export function pondChoiceLabel(p) {
  if (!p) return '—';
  const code = p.code || '—';
  const owner = p.owner_name || p.households?.name || '';
  const agency = p.agency_code || '';
  return [code, owner, agency ? `ĐL ${agency}` : ''].filter(Boolean).join(' · ');
}

function sampleInfoForPond(p) {
  if (!p) return '';
  const owner = p.owner_name || p.households?.name || '';
  const code = p.code || '';
  if (owner && code) return `Mẫu cá – ${owner}, ${code}`;
  if (code) return `Mẫu cá – ${code}`;
  return owner ? `Mẫu cá – ${owner}` : '';
}

function addressForPond(p) {
  if (!p) return '';
  return String(p.location || p.households?.address || '').trim();
}

function cycleChoiceLine(c, cycles) {
  if (!c) return '';
  const i = Math.max(0, (cycles || []).findIndex((x) => String(x.id) === String(c.id)));
  const title = c.name?.trim() || (c.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${i + 1}`);
  const fish = c.total_fish != null ? Number(c.total_fish).toLocaleString() : null;
  const parts = [
    title,
    c.stock_date ? `ngày thả ${c.stock_date}` : null,
    fish ? `${fish} con` : null,
    c.status ? c.status : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

/** Các trường tự điền khi chọn ao / chu kỳ. */
export function autoFieldsFromPond(p, cycleId) {
  const cycles = normalizePondCycles(p);
  const cid = cycleId || pickActiveCycle(cycles)?.id || '';
  return {
    pond_id: p?.id ? String(p.id) : '',
    sample_info: sampleInfoForPond(p),
    address: addressForPond(p),
    pond_cycle_id: cid ? String(cid) : '',
  };
}

function emptyForm(p, cycleId) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return {
    id: null,
    ...autoFieldsFromPond(p, cycleId),
    report_code: '',
    lab_name: DEFAULT_LAB_NAME,
    customer_name: DEFAULT_LAB_CUSTOMER,
    sample_received_date: today,
    result_date: today,
    analytes: defaultAnalyteResults(),
    notes: '',
  };
}

async function resolvePondWithCycles(pondId, pondOptions) {
  const fromList = (pondOptions || []).find((x) => String(x.id) === String(pondId));
  const cyclesFromList = normalizePondCycles(fromList);
  if (fromList && cyclesFromList.length > 0) {
    return { pond: fromList, cycles: cyclesFromList };
  }
  if (fromList) {
    const full = await base44.entities.Pond.getWithCycles(pondId);
    return { pond: full || fromList, cycles: normalizePondCycles(full || fromList) };
  }
  const full = await base44.entities.Pond.getWithCycles(pondId);
  return { pond: full, cycles: normalizePondCycles(full) };
}

export default function PondLabTestPanel({
  pond,
  pondOptions = [],
  onActivePondChange,
  selectedCycleId = '',
  canEditDelete = false,
  compact = false,
}) {
  const [activePond, setActivePond] = useState(pond);
  const [activeCycles, setActiveCycles] = useState(() => normalizePondCycles(pond));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(pond, selectedCycleId));
  const [formCycles, setFormCycles] = useState(() => normalizePondCycles(pond));

  const selectablePonds = useMemo(() => {
    const map = new Map();
    for (const p of [pond, ...pondOptions, activePond].filter(Boolean)) {
      map.set(String(p.id), p);
    }
    return [...map.values()].sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi'));
  }, [pond, pondOptions, activePond]);

  const showPondPicker = selectablePonds.length > 1;

  useEffect(() => {
    if (!pond?.id) return;
    setActivePond(pond);
    setActiveCycles(normalizePondCycles(pond));
  }, [pond?.id]);

  const applyActivePond = useCallback(
    async (pondId, { syncForm = false, cycleId } = {}) => {
      const resolved = await resolvePondWithCycles(pondId, selectablePonds);
      if (!resolved.pond) return;
      setActivePond(resolved.pond);
      setActiveCycles(resolved.cycles);
      onActivePondChange?.(resolved.pond);
      if (syncForm) {
        const auto = autoFieldsFromPond(resolved.pond, cycleId ?? pickActiveCycle(resolved.cycles)?.id);
        setForm((prev) => ({
          ...prev,
          ...auto,
          report_code: prev.report_code,
          lab_name: prev.lab_name,
          customer_name: prev.customer_name,
          sample_received_date: prev.sample_received_date,
          result_date: prev.result_date,
          analytes: prev.analytes,
          notes: prev.notes,
        }));
        setFormCycles(resolved.cycles);
      }
    },
    [selectablePonds, onActivePondChange]
  );

  const loadRecords = useCallback(async () => {
    const pid = activePond?.id;
    if (!pid) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await base44.entities.PondLabTest.filter({ pond_id: pid }, '-result_date', 100);
      setRecords(rows || []);
    } catch (e) {
      setError(formatSupabaseError(e));
      setRecords([]);
    }
    setLoading(false);
  }, [activePond?.id]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const cyclesForForm = formOpen && form.id ? activeCycles : formCycles.length ? formCycles : activeCycles;

  const cycleItems = useMemo(
    () => [
      { value: '__none__', label: '— Không gắn chu kỳ —' },
      ...cyclesForForm.map((c) => ({
        value: String(c.id),
        label: cycleChoiceLine(c, cyclesForForm),
      })),
    ],
    [cyclesForForm]
  );

  const selectedCycleValue = form.pond_cycle_id ? String(form.pond_cycle_id) : '__none__';

  const selectedCycleTriggerLabel = useMemo(() => {
    if (!form.pond_cycle_id) return '— Không gắn chu kỳ —';
    const it = cycleItems.find((x) => x.value === String(form.pond_cycle_id));
    if (it?.label) return it.label;
    const c = cyclesForForm.find((x) => String(x.id) === String(form.pond_cycle_id));
    if (c) return cycleChoiceLine(c, cyclesForForm);
    return 'Chu kỳ đã chọn';
  }, [form.pond_cycle_id, cycleItems, cyclesForForm]);

  const formPondId = form.pond_id || activePond?.id || '';
  const formPondLabel = useMemo(() => {
    const p = selectablePonds.find((x) => String(x.id) === String(formPondId));
    return p ? pondChoiceLabel(p) : pondChoiceLabel(activePond);
  }, [formPondId, selectablePonds, activePond]);

  const openNew = () => {
    const p = activePond || pond;
    const cycles = normalizePondCycles(p);
    setFormCycles(cycles);
    setForm(emptyForm(p, selectedCycleId || pickActiveCycle(cycles)?.id));
    setFormOpen(true);
    setError('');
  };

  const openEdit = (row) => {
    setForm({
      id: row.id,
      pond_id: row.pond_id ? String(row.pond_id) : String(activePond?.id || ''),
      pond_cycle_id: row.pond_cycle_id != null ? String(row.pond_cycle_id) : '',
      report_code: row.report_code || '',
      lab_name: row.lab_name || DEFAULT_LAB_NAME,
      customer_name: row.customer_name || DEFAULT_LAB_CUSTOMER,
      sample_info: row.sample_info || '',
      address: row.address || '',
      sample_received_date: row.sample_received_date || '',
      result_date: row.result_date || '',
      analytes: mergeAnalyteResults(row.analytes),
      notes: row.notes || '',
    });
    setFormOpen(true);
    setError('');
  };

  const handleFormPondChange = async (pondId) => {
    if (!pondId || form.id) return;
    setError('');
    try {
      const resolved = await resolvePondWithCycles(pondId, selectablePonds);
      if (!resolved.pond) return;
      setFormCycles(resolved.cycles);
      setForm((prev) => ({
        ...prev,
        ...autoFieldsFromPond(resolved.pond, pickActiveCycle(resolved.cycles)?.id),
        report_code: prev.report_code,
        lab_name: prev.lab_name,
        customer_name: prev.customer_name,
        sample_received_date: prev.sample_received_date,
        result_date: prev.result_date,
        analytes: prev.analytes,
        notes: prev.notes,
      }));
      if (String(activePond?.id) !== String(pondId)) {
        setActivePond(resolved.pond);
        setActiveCycles(resolved.cycles);
        onActivePondChange?.(resolved.pond);
      }
    } catch (e) {
      setError(formatSupabaseError(e));
    }
  };

  const handleFormCycleChange = (cycleId) => {
    const c = cyclesForForm.find((x) => String(x.id) === String(cycleId));
    const p =
      selectablePonds.find((x) => String(x.id) === String(form.pond_id || activePond?.id)) || activePond;
    setForm((prev) => ({
      ...prev,
      pond_cycle_id: cycleId,
      sample_info: c && p ? sampleInfoForPond(p) : prev.sample_info,
    }));
  };

  const setAnalyteResult = (key, value) => {
    setForm((prev) => ({
      ...prev,
      analytes: prev.analytes.map((r) =>
        r.key === key ? { ...r, result: normalizeAnalyteResultInput(value) } : r
      ),
    }));
  };

  const handleSave = async () => {
    if (!canEditDelete) return;
    const savePondId = form.pond_id || activePond?.id;
    if (!savePondId) {
      setError('Chọn ao nuôi.');
      return;
    }
    if (!form.result_date) {
      setError('Nhập ngày trả kết quả.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        pond_id: savePondId,
        pond_cycle_id: form.pond_cycle_id && form.pond_cycle_id !== '__none__' ? form.pond_cycle_id : null,
        report_code: form.report_code?.trim() || null,
        lab_name: form.lab_name?.trim() || DEFAULT_LAB_NAME,
        customer_name: form.customer_name?.trim() || null,
        sample_info: form.sample_info?.trim() || null,
        address: form.address?.trim() || null,
        sample_received_date: form.sample_received_date || null,
        result_date: form.result_date,
        analytes: form.analytes,
        notes: form.notes?.trim() || null,
      };
      if (form.id) {
        await base44.entities.PondLabTest.update(form.id, payload);
      } else {
        await base44.entities.PondLabTest.create(payload);
      }
      if (String(activePond?.id) !== String(savePondId)) {
        await applyActivePond(savePondId);
      }
      setFormOpen(false);
      await loadRecords();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSaving(false);
  };

  const handleDelete = async (row) => {
    if (!canEditDelete || !row?.id) return;
    const ok = window.confirm(`Xóa phiếu kiểm nghiệm ${row.report_code || row.result_date || ''}?`);
    if (!ok) return;
    setError('');
    try {
      await base44.entities.PondLabTest.delete(row.id);
      if (form.id === row.id) setFormOpen(false);
      await loadRecords();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
  };

  const detectedCount = countDetectedAnalytes(form.analytes);

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-emerald-600" />
            Kiểm nghiệm kháng sinh
          </h3>
          {showPondPicker ? (
            <div className="max-w-xl">
              <Label className="text-xs text-muted-foreground">Ao nuôi (xem phiếu &amp; tạo mới)</Label>
              <Select
                value={activePond?.id ? String(activePond.id) : undefined}
                onValueChange={(v) => void applyActivePond(v)}
              >
                <SelectTrigger className="mt-1 h-auto min-h-9 py-2 text-left">
                  <SelectValue placeholder="Chọn ao nuôi…">{pondChoiceLabel(activePond)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[min(96vw,36rem)]">
                  {selectablePonds.map((p) => (
                    <SelectItem key={String(p.id)} value={String(p.id)} className="whitespace-normal">
                      {pondChoiceLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ao {activePond?.code || pond?.code || '—'} · Phiếu kết quả phòng lab (15 chỉ tiêu LC-MS/MS)
            </p>
          )}
        </div>
        {canEditDelete ? (
          <Button type="button" size="sm" className="gap-1.5 shrink-0" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" />
            Thêm phiếu
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
      ) : null}

      {formOpen && canEditDelete ? (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {form.id ? 'Sửa phiếu kiểm nghiệm' : 'Phiếu kiểm nghiệm mới'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs">Ao nuôi *</Label>
              {form.id ? (
                <p className="mt-1 text-sm font-semibold text-foreground py-2">{formPondLabel}</p>
              ) : (
                <Select value={formPondId || undefined} onValueChange={(v) => void handleFormPondChange(v)}>
                  <SelectTrigger className="mt-1 h-auto min-h-9 py-2 text-left">
                    <SelectValue placeholder="Chọn ao nuôi…">{formPondLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(96vw,36rem)]">
                    {selectablePonds.map((p) => (
                      <SelectItem key={String(p.id)} value={String(p.id)} className="whitespace-normal">
                        {pondChoiceLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Chọn ao → tự điền thông tin mẫu, địa chỉ và chu kỳ tương ứng.
              </p>
            </div>
            <div>
              <Label className="text-xs">Mã phiếu / Code</Label>
              <Input
                className="mt-1 h-9"
                value={form.report_code}
                onChange={(e) => setForm((p) => ({ ...p, report_code: e.target.value }))}
                placeholder="VD: CT261907-019"
              />
            </div>
            <div>
              <Label className="text-xs">Phòng lab</Label>
              <Input
                className="mt-1 h-9"
                value={form.lab_name}
                onChange={(e) => setForm((p) => ({ ...p, lab_name: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Khách hàng</Label>
              <Input
                className="mt-1 h-9"
                value={form.customer_name}
                onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Thông tin mẫu</Label>
              <Input
                className="mt-1 h-9"
                value={form.sample_info}
                onChange={(e) => setForm((p) => ({ ...p, sample_info: e.target.value }))}
                placeholder="Mẫu cá – Hộ nuôi, mã ao …"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Địa chỉ</Label>
              <Input
                className="mt-1 h-9"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
            {cyclesForForm.length > 0 ? (
              <div className="sm:col-span-2">
                <Label className="text-xs">Chu kỳ (tuỳ chọn)</Label>
                <Select
                  value={selectedCycleValue}
                  onValueChange={(v) => handleFormCycleChange(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="mt-1 h-auto min-h-9 py-2 text-left">
                    <SelectValue placeholder="Chọn chu kỳ…">{selectedCycleTriggerLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(96vw,36rem)]">
                    {cycleItems.map((it) => (
                      <SelectItem key={it.value} value={it.value} className="whitespace-normal">
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <Label className="text-xs">Ngày nhận mẫu</Label>
              <Input
                type="date"
                className="mt-1 h-9"
                value={form.sample_received_date}
                onChange={(e) => setForm((p) => ({ ...p, sample_received_date: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Ngày trả kết quả *</Label>
              <Input
                type="date"
                className="mt-1 h-9"
                value={form.result_date}
                onChange={(e) => setForm((p) => ({ ...p, result_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-2 py-2 font-bold text-muted-foreground w-8">#</th>
                  <th className="text-left px-2 py-2 font-bold text-muted-foreground">Chỉ tiêu</th>
                  <th className="text-left px-2 py-2 font-bold text-muted-foreground w-28">Kết quả (ppb)</th>
                  <th className="text-right px-2 py-2 font-bold text-muted-foreground w-20">LOD</th>
                  <th className="text-left px-2 py-2 font-bold text-muted-foreground w-24">PP</th>
                </tr>
              </thead>
              <tbody>
                {form.analytes.map((row, idx) => {
                  const detected = isAnalyteDetected(row.result);
                  const meta = LAB_ANALYTES.find((a) => a.key === row.key);
                  return (
                    <tr key={row.key} className={cn('border-b border-border/60', detected && 'bg-amber-50/80')}>
                      <td className="px-2 py-1.5 text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1.5 font-medium">{row.name}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          className={cn('h-8 text-xs', detected && 'border-amber-400 bg-amber-50 font-bold')}
                          value={row.result === 'ND' ? '' : row.result}
                          placeholder="ND"
                          onChange={(e) => setAnalyteResult(row.key, e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{meta?.lod ?? row.lod}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{meta?.method ?? row.method}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {detectedCount > 0 ? (
            <p className="text-xs text-amber-700 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Có {detectedCount} chỉ tiêu phát hiện dương tính — kiểm tra lại trước khi lưu.
            </p>
          ) : null}

          <div>
            <Label className="text-xs">Ghi chú</Label>
            <Textarea
              className="mt-1 min-h-[60px]"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Đang lưu…' : 'Lưu phiếu'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-4">Đang tải…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">
            Chưa có phiếu kiểm nghiệm cho ao {activePond?.code || 'này'}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">Ngày KQ</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">Mã phiếu</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">Mẫu</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Phát hiện</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">Chi tiết (+)</th>
                  {canEditDelete ? (
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground w-24">Thao tác</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {records.map((r) => {
                  const analytes = mergeAnalyteResults(r.analytes);
                  const detected = analytes.filter((a) => isAnalyteDetected(a.result));
                  return (
                    <tr key={r.id} className="hover:bg-muted/20 align-top">
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">{r.result_date || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.report_code || '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate" title={r.sample_info || ''}>
                        {r.sample_info || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {detected.length > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                            {detected.length}
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-xs font-semibold">OK</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {detected.length > 0
                          ? detected.map((d) => `${d.name}: ${formatAnalyteResultDisplay(d.result)}`).join(' · ')
                          : 'Tất cả ND'}
                      </td>
                      {canEditDelete ? (
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(r)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
