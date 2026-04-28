import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Save, AlertTriangle, RefreshCw, Lock, ClipboardCopy } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';

function calcInitialRegisterYield(totalFish, survivalRate, targetWeight) {
  if (!totalFish || !survivalRate || !targetWeight) return 0;
  return Math.round((Number(totalFish) * (Number(survivalRate) / 100) * Number(targetWeight)) / 1000);
}

function calcExpectedYield(fishCount, survivalRate, targetWeight) {
  return calcInitialRegisterYield(fishCount, survivalRate, targetWeight);
}

export default function PondPlanTab({
  pond,
  cycle,
  onUpdate,
  isWithdrawal,
  canEditPlan = false,
  canEditAdjustedPlan = false,
  isAdmin = false,
  siblingPonds = [],
}) {
  const [initialForm, setInitialForm] = useState({
    cycle_name: '',
    stock_date: '',
    total_fish: '',
    seed_size: '',
    seed_weight: '',
    survival_rate: 90,
    target_weight: 800,
    initial_expected_harvest_date: '',
  });
  const [adjustedForm, setAdjustedForm] = useState({
    current_fish: '',
    expected_harvest_date: '',
  });
  const [templatePickValue, setTemplatePickValue] = useState('__none__');

  const [nextCycleForm, setNextCycleForm] = useState({
    enabled: false,
    gap_days: 20,
    name: '',
    total_fish: '',
    survival_rate: 90,
    target_weight: 800,
  });

  const [companyAdjustReason, setCompanyAdjustReason] = useState('');
  const [savingInitial, setSavingInitial] = useState(false);
  const [savingAdjusted, setSavingAdjusted] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!cycle) return;
    setInitialForm({
      cycle_name: cycle.name || '',
      stock_date: cycle.stock_date || '',
      total_fish: cycle.total_fish ?? '',
      seed_size: cycle.seed_size ?? '',
      seed_weight: cycle.seed_weight ?? '',
      survival_rate: cycle.survival_rate ?? 90,
      target_weight: cycle.target_weight ?? 800,
      initial_expected_harvest_date: cycle.initial_expected_harvest_date || '',
    });
    setAdjustedForm({
      current_fish: cycle.current_fish ?? cycle.total_fish ?? '',
      expected_harvest_date: cycle.expected_harvest_date || '',
    });
    setCompanyAdjustReason('');
    setError('');
    setTemplatePickValue('__none__');
  }, [cycle?.id, cycle?.updated_at]);

  const initialYield = calcInitialRegisterYield(
    initialForm.total_fish,
    initialForm.survival_rate,
    initialForm.target_weight
  );

  const regSurvival = Number(cycle?.survival_rate ?? initialForm.survival_rate) || 90;
  const regTarget = Number(cycle?.target_weight ?? initialForm.target_weight) || 800;
  const adjustedYieldComputed = calcExpectedYield(adjustedForm.current_fish, regSurvival, regTarget);

  const nextStockDate = adjustedForm.expected_harvest_date
    ? format(
        addDays(parseISO(adjustedForm.expected_harvest_date), Number(nextCycleForm.gap_days) || 20),
        'yyyy-MM-dd'
      )
    : '';

  const nextExpectedYield = calcExpectedYield(
    nextCycleForm.total_fish,
    nextCycleForm.survival_rate,
    nextCycleForm.target_weight
  );

  const templatePonds = useMemo(() => {
    return siblingPonds
      .filter((p) => p.id !== pond.id && (p.household_id === pond.household_id || p.agency_code === pond.agency_code))
      .sort((a, b) => {
        const sa = String(a.stock_date || pickActiveCycle(a.pond_cycles)?.stock_date || '');
        const sb = String(b.stock_date || pickActiveCycle(b.pond_cycles)?.stock_date || '');
        return sb.localeCompare(sa);
      });
  }, [siblingPonds, pond.id, pond.household_id, pond.agency_code]);

  const templatePickItems = useMemo(
    () => [
      { value: '__none__', label: 'Chọn ao cùng hộ / đại lý…' },
      ...templatePonds.map((p) => {
        const sd = p.stock_date || pickActiveCycle(p.pond_cycles)?.stock_date;
        const ed =
          p.initial_expected_harvest_date ||
          p.expected_harvest_date ||
          pickActiveCycle(p.pond_cycles)?.initial_expected_harvest_date ||
          pickActiveCycle(p.pond_cycles)?.expected_harvest_date;
        return {
          value: p.id,
          label: `${p.code}${sd ? ` · thả ${sd}` : ''}${ed ? ` · thu ${ed}` : ''}`,
        };
      }),
    ],
    [templatePonds]
  );

  const applyPondTemplate = (tpl) => {
    if (!tpl) return;
    const src = pickActiveCycle(tpl.pond_cycles) || tpl;
    setInitialForm((f) => ({
      ...f,
      stock_date: src.stock_date || f.stock_date,
      initial_expected_harvest_date:
        src.initial_expected_harvest_date || src.expected_harvest_date || f.initial_expected_harvest_date,
    }));
  };

  const handleSaveInitial = async () => {
    if (!canEditPlan || !cycle) return;
    setError('');
    setSavingInitial(true);
    try {
      const y = initialYield;
      const curFish = Number(adjustedForm.current_fish) || Number(initialForm.total_fish) || 0;
      await base44.entities.PondCycle.update(cycle.id, {
        name: initialForm.cycle_name?.trim() || null,
        stock_date: initialForm.stock_date || null,
        total_fish: Number(initialForm.total_fish) || null,
        seed_size: initialForm.seed_size === '' ? null : Number(initialForm.seed_size),
        seed_weight: initialForm.seed_weight === '' ? null : Number(initialForm.seed_weight),
        survival_rate: Number(initialForm.survival_rate) || null,
        target_weight: Number(initialForm.target_weight) || null,
        initial_expected_harvest_date: initialForm.initial_expected_harvest_date || null,
        season_id: null,
        stocking_batch_id: null,
        initial_plan_locked: false,
        ...(cycle.expected_yield == null || cycle.expected_yield === 0 ? { expected_yield: y } : {}),
        status: curFish > 0 ? 'CC' : 'CT',
      });
      onUpdate();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSavingInitial(false);
  };

  const handleSaveAdjusted = async () => {
    if (!canEditAdjustedPlan || !cycle) return;
    setError('');
    setSavingAdjusted(true);
    try {
      const {
        data: { user },
      } = await base44.supabase.auth.getSession();
      const nextCurrent = Number(adjustedForm.current_fish);
      const nextYield =
        adjustedForm.current_fish === '' || !Number.isFinite(nextCurrent) || nextCurrent <= 0
          ? null
          : adjustedYieldComputed > 0
            ? adjustedYieldComputed
            : null;
      const nextHarvest = adjustedForm.expected_harvest_date || null;

      const doNextCycle =
        canEditPlan && nextCycleForm.enabled && nextStockDate && nextCycleForm.total_fish && isAdmin;

      if (!doNextCycle) {
        await base44.entities.PondCycle.update(cycle.id, {
          current_fish: adjustedForm.current_fish === '' ? null : nextCurrent,
          expected_yield: nextYield,
          expected_harvest_date: nextHarvest,
          status: nextCurrent > 0 ? 'CC' : 'CT',
        });
      } else {
        await base44.entities.PondCycle.update(cycle.id, {
          current_fish: adjustedForm.current_fish === '' ? null : nextCurrent,
          expected_yield: nextYield,
          expected_harvest_date: nextHarvest,
        });
      }

      if (isAdmin && companyAdjustReason.trim()) {
        await base44.entities.PlanAdjustment.create({
          pond_cycle_id: cycle.id,
          adjustment_type: 'manual_company',
          field_name: 'adjusted_plan',
          old_value: {
            current_fish: cycle.current_fish,
            expected_yield: cycle.expected_yield,
            expected_harvest_date: cycle.expected_harvest_date,
          },
          new_value: {
            current_fish: nextCurrent,
            expected_yield: nextYield,
            expected_harvest_date: nextHarvest,
          },
          reason: companyAdjustReason.trim(),
          actor_id: user?.id || null,
        });
        setCompanyAdjustReason('');
      }

      if (doNextCycle) {
        const ny = calcExpectedYield(
          nextCycleForm.total_fish,
          nextCycleForm.survival_rate,
          nextCycleForm.target_weight
        );
        await base44.entities.PondCycle.update(cycle.id, {
          status: 'CT',
          current_fish: 0,
          harvest_done: true,
          expected_yield: null,
        });
        await base44.entities.PondCycle.create({
          pond_id: pond.id,
          status: 'CC',
          name: nextCycleForm.name?.trim() || null,
          stock_date: nextStockDate,
          total_fish: Number(nextCycleForm.total_fish),
          current_fish: Number(nextCycleForm.total_fish),
          survival_rate: Number(nextCycleForm.survival_rate),
          target_weight: Number(nextCycleForm.target_weight),
          expected_yield: ny,
          notes: `Sau thu ${adjustedForm.expected_harvest_date || '—'} · ${pond.code}`,
        });
      }

      onUpdate();
    } catch (e) {
      setError(formatSupabaseError(e));
    }
    setSavingAdjusted(false);
  };

  const roInitial = !canEditPlan;
  const roAdjusted = !canEditAdjustedPlan;

  if (!cycle) {
    return <p className="text-sm text-muted-foreground">Không có chu kỳ được chọn.</p>;
  }

  return (
    <div className="space-y-6">
      {!(canEditPlan && canEditAdjustedPlan) && (
        <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Kế hoạch ao:</strong> tài khoản của bạn không khớp <strong>đại lý</strong> hoặc <strong>hộ nuôi</strong> của ao này trên hệ thống — chỉ xem, không lưu được. Liên hệ admin nếu cần gán đúng hộ / đại lý.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Kế hoạch ban đầu (đăng ký)</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Chỉ tiêu thả và đăng ký gốc. Admin có thể chỉnh và lưu bất cứ lúc nào.
          </p>
        </div>

        {canEditPlan && templatePonds.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <ClipboardCopy className="w-3.5 h-3.5" /> Gợi ý mốc thời gian từ ao khác
              </Label>
              <Select
                modal={false}
                value={templatePickValue}
                onValueChange={(v) => {
                  setTemplatePickValue('__none__');
                  if (v === '__none__') return;
                  const tpl = templatePonds.find((p) => p.id === v);
                  if (tpl) applyPondTemplate(tpl);
                }}
                items={templatePickItems}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sao chép ngày thả / thu dự kiến từ ao khác" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">— Chọn ao mẫu —</SelectItem>
                  {templatePonds.map((p) => {
                    const it = templatePickItems.find((x) => x.value === p.id);
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {it?.label || p.code}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên chu kỳ</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">Đặt khi tạo chu kỳ hoặc sửa tại đây (tuỳ chọn).</p>
          <Input
            readOnly={roInitial}
            value={initialForm.cycle_name}
            onChange={(e) => setInitialForm({ ...initialForm, cycle_name: e.target.value })}
            placeholder="Ví dụ: Thả T3/2026"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày thả</Label>
            <Input
              type="date"
              readOnly={roInitial}
              value={initialForm.stock_date}
              onChange={(e) => setInitialForm({ ...initialForm, stock_date: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày thu dự kiến (đăng ký gốc)</Label>
            <Input
              type="date"
              readOnly={roInitial}
              value={initialForm.initial_expected_harvest_date}
              onChange={(e) => setInitialForm({ ...initialForm, initial_expected_harvest_date: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tổng số cá thả (con)</Label>
            <Input
              type="number"
              readOnly={roInitial}
              value={initialForm.total_fish}
              onChange={(e) => setInitialForm({ ...initialForm, total_fish: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Size giống (cm)</Label>
            <Input
              type="number"
              step="0.1"
              readOnly={roInitial}
              value={initialForm.seed_size}
              onChange={(e) => setInitialForm({ ...initialForm, seed_size: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL giống (g)</Label>
            <Input
              type="number"
              readOnly={roInitial}
              value={initialForm.seed_weight}
              onChange={(e) => setInitialForm({ ...initialForm, seed_weight: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tỷ lệ sống kỳ vọng (%)</Label>
            <Input
              type="number"
              readOnly={roInitial}
              value={initialForm.survival_rate}
              onChange={(e) => setInitialForm({ ...initialForm, survival_rate: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL kỳ vọng lúc thu (gram)</Label>
            <Input
              type="number"
              readOnly={roInitial}
              value={initialForm.target_weight}
              onChange={(e) => setInitialForm({ ...initialForm, target_weight: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Calculator className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-blue-600 font-medium">Sản lượng đăng ký ban đầu (theo tổng thả × TL thu)</p>
            <p className="text-2xl font-bold text-blue-700">{initialYield.toLocaleString()} kg</p>
            <p className="text-xs text-blue-500 mt-0.5">
              = {Number(initialForm.total_fish || 0).toLocaleString()} con × {initialForm.survival_rate}% × {initialForm.target_weight}g ÷ 1.000
            </p>
          </div>
        </div>

        {canEditPlan && (
          <Button onClick={handleSaveInitial} disabled={savingInitial} className="w-full bg-primary text-white">
            <Save className="w-4 h-4 mr-2" />
            {savingInitial ? 'Đang lưu...' : 'Lưu kế hoạch ban đầu'}
          </Button>
        )}
      </div>

      <div className="rounded-xl border-2 border-amber-200/80 bg-amber-50/30 p-4 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-bold text-amber-900/90 uppercase tracking-widest">Kế hoạch điều chỉnh (vận hành)</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Điều chỉnh <strong>số cá hiện tại</strong> và <strong>ngày thu dự kiến</strong>. Sản lượng mục tiêu <strong>tự tính</strong> theo đăng ký gốc (tỷ lệ sống × TL thu lúc thu) — không nhập tay.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Số cá hiện tại (con)</Label>
            <Input
              type="number"
              {...(roAdjusted ? { readOnly: true } : {})}
              value={adjustedForm.current_fish}
              onChange={(e) => setAdjustedForm({ ...adjustedForm, current_fish: e.target.value })}
              className={`mt-1 ${roAdjusted ? 'bg-muted/50' : ''}`}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày thu hoạch dự kiến (điều chỉnh)</Label>
            <Input
              type="date"
              {...(roAdjusted ? { readOnly: true } : {})}
              value={adjustedForm.expected_harvest_date}
              onChange={(e) => setAdjustedForm({ ...adjustedForm, expected_harvest_date: e.target.value })}
              className={`mt-1 ${roAdjusted ? 'bg-muted/50' : ''}`}
            />
          </div>
        </div>

        <div className="bg-white/80 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Calculator className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-900/90 font-medium">Sản lượng mục tiêu điều chỉnh (tự tính)</p>
            <p className="text-2xl font-bold text-amber-800 mt-0.5">
              {adjustedYieldComputed > 0 ? `${adjustedYieldComputed.toLocaleString()} kg` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              = {Number(adjustedForm.current_fish || 0).toLocaleString()} con × {regSurvival}% × {regTarget}g ÷ 1.000
              <span className="block mt-0.5">(theo chỉ tiêu đăng ký gốc; đổi số cá hoặc sửa KH ban đầu nếu cần đổi % / TL thu)</span>
            </p>
          </div>
        </div>

        {isAdmin && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lý do thay đổi (công ty) — tuỳ chọn</Label>
            <Textarea
              value={companyAdjustReason}
              onChange={(e) => setCompanyAdjustReason(e.target.value)}
              placeholder="Ghi khi điều chỉnh theo chỉ tiêu công ty — lưu lịch sử"
              className="mt-1 h-20 text-sm"
            />
          </div>
        )}

        {isWithdrawal && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <p className="text-xs text-orange-700 font-medium">Đang trong thời gian ngưng thuốc — không lên lịch thu hoạch mới</p>
          </div>
        )}

        {adjustedForm.expected_harvest_date && isAdmin && (
          <div className={`border rounded-lg overflow-hidden ${nextCycleForm.enabled ? 'border-primary/40' : 'border-dashed border-primary/30'}`}>
            <button
              type="button"
              onClick={() => setNextCycleForm((f) => ({ ...f, enabled: !f.enabled }))}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Chu kỳ nuôi tiếp theo</span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${nextCycleForm.enabled ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {nextCycleForm.enabled ? 'Bật' : 'Tắt'}
              </span>
            </button>

            {nextCycleForm.enabled && (
              <div className="px-4 pb-4 space-y-3 border-t border-border bg-primary/5">
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Số ngày sau thu để thả lại</Label>
                    <Input
                      type="number"
                      value={nextCycleForm.gap_days}
                      onChange={(e) => setNextCycleForm((f) => ({ ...f, gap_days: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dự kiến ngày thả chu kỳ sau</Label>
                    <Input type="date" value={nextStockDate} readOnly className="mt-1 bg-muted/50 text-muted-foreground" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Số cá thả (con)</Label>
                    <Input
                      type="number"
                      value={nextCycleForm.total_fish}
                      onChange={(e) => setNextCycleForm((f) => ({ ...f, total_fish: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tỷ lệ sống (%)</Label>
                    <Input
                      type="number"
                      value={nextCycleForm.survival_rate}
                      onChange={(e) => setNextCycleForm((f) => ({ ...f, survival_rate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL kỳ vọng lúc thu (gram)</Label>
                    <Input
                      type="number"
                      value={nextCycleForm.target_weight}
                      onChange={(e) => setNextCycleForm((f) => ({ ...f, target_weight: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                {nextExpectedYield > 0 && (
                  <div className="bg-white border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                    <Calculator className="w-4 h-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-primary/70 font-medium">SL dự kiến chu kỳ sau (tự tính)</p>
                      <p className="text-lg font-bold text-primary">{nextExpectedYield.toLocaleString()} kg</p>
                      <p className="text-xs text-primary/60">
                        Tạo <strong>chu kỳ mới</strong> trên ao <strong>{pond.code}</strong> — trạng thái đang nuôi (CC)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSaveAdjusted}
          disabled={savingAdjusted || !canEditAdjustedPlan}
          className="w-full bg-amber-700 hover:bg-amber-800 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {savingAdjusted ? 'Đang lưu...' : nextCycleForm.enabled ? 'Lưu điều chỉnh + Tạo chu kỳ mới' : 'Lưu kế hoạch điều chỉnh'}
        </Button>
      </div>
    </div>
  );
}
