import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckSquare, Square, Save, AlertTriangle, ShieldCheck, Package } from 'lucide-react';
import { format } from 'date-fns';
import { latestActualHarvestDate } from '@/lib/reportPondDedupe';
function CheckItem({ label, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 w-full text-left p-2 rounded hover:bg-muted transition-colors">
      {checked
        ? <CheckSquare className="w-4 h-4 text-green-500 flex-shrink-0" />
        : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      }
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}

const HARVEST_ACTION_ITEMS = [
  { value: 'approved', label: '✅ Chấp nhận toàn bộ' },
  { value: 'reject_load', label: '❌ Từ chối cả xe' },
  { value: 'deduct_weight', label: '⚖️ Trừ khối lượng' },
  { value: 'deduct_price', label: '💸 Trừ % giá trị' },
];

export default function PondHarvestTab({ pond, cycle, onUpdate, isWithdrawal }) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    harvest_date: format(new Date(), 'yyyy-MM-dd'),
    actual_yield: '',
    fish_count_harvested: '',
    avg_weight_harvest: '',
    dead_fish_count: '',
    reject_fish_count: '',
    sick_yellow_fish: '',
    thin_fish: '',
    stomach_ratio: '',
    water_quality_ok: false,
    antibiotic_residue_ok: false,
    heavy_metal_ok: false,
    pesticide_ok: false,
    action_taken: 'approved',
    price_per_kg: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cycle?.id) {
      setRecords([]);
      return;
    }
    base44.entities.HarvestRecord.filter({ pond_cycle_id: cycle.id }, '-harvest_date', 500).then(setRecords);
  }, [pond.id, cycle?.id]);

  const lastHarvestSummary = records.length > 0
    ? {
        lastDate: latestActualHarvestDate(records),
        totalKg: records.reduce((s, h) => s + (Number(h.actual_yield) || 0), 0),
      }
    : null;

  const lotCode = `LOT-${pond.code}-${form.harvest_date?.replace(/-/g, '')}`;
  const totalValue = form.actual_yield && form.price_per_kg
    ? (Number(form.actual_yield) * Number(form.price_per_kg)).toLocaleString()
    : null;

  // Auto-suggest action based on quality checklist
  const qualityIssues = [];
  if (Number(form.thin_fish) > 0) qualityIssues.push(`Cá gầy <42% phi-lê: ${form.thin_fish}kg`);
  if (Number(form.sick_yellow_fish) > 0) qualityIssues.push(`Cá vàng thịt/bệnh: ${form.sick_yellow_fish}kg`);
  const hasFoodInStomach = Number(form.stomach_ratio) > 10;
  if (hasFoodInStomach) qualityIssues.push(`Tỷ lệ dạ dày cao: ${form.stomach_ratio}%`);
  const failedChecks = !form.antibiotic_residue_ok || !form.heavy_metal_ok || !form.pesticide_ok;

  const suggestedAction = failedChecks ? 'reject_load'
    : qualityIssues.length >= 2 ? 'deduct_price'
      : qualityIssues.length === 1 ? 'deduct_weight'
        : 'approved';

  const handleSave = async () => {
    if (isWithdrawal || !cycle?.id) return;
    setSaving(true);

    // Tạo HarvestRecord
    await base44.entities.HarvestRecord.create({
      ...form,
      pond_id: pond.id,
      pond_cycle_id: cycle.id,
      pond_code: pond.code,
      owner_name: pond.owner_name,
      agency_code: pond.agency_code,
      planned_yield: cycle.expected_yield,
      actual_yield: Number(form.actual_yield),
      fish_count_harvested: Number(form.fish_count_harvested),
      avg_weight_harvest: Number(form.avg_weight_harvest),
      dead_fish_count: Number(form.dead_fish_count),
      reject_fish_count: Number(form.reject_fish_count),
      sick_yellow_fish: Number(form.sick_yellow_fish),
      thin_fish: Number(form.thin_fish),
      stomach_ratio: Number(form.stomach_ratio),
      price_per_kg: Number(form.price_per_kg),
      total_value: totalValue ? Number(form.actual_yield) * Number(form.price_per_kg) : null,
      lot_code: lotCode,
    });

    // Tính tổng actual_yield từ tất cả harvest records của chu kỳ này
    const allHarvests = await base44.entities.HarvestRecord.filter({ pond_cycle_id: cycle.id });
    const totalActualYield = allHarvests.reduce((sum, h) => sum + (h.actual_yield || 0), 0);

    // Tính FCR nếu có total_feed_used
    let fcr = null;
    if (cycle.total_feed_used && totalActualYield > 0) {
      fcr = Math.round((cycle.total_feed_used / totalActualYield) * 100) / 100;
    }

    // Cập nhật PondCycle với actual_yield tổng và FCR
    const isHarvested = totalActualYield > 0;
    await base44.entities.PondCycle.update(cycle.id, {
      actual_yield: totalActualYield,
      harvest_done: isHarvested,
      status: isHarvested ? 'CT' : cycle.status,
      fcr: fcr,
      ...(isHarvested ? { current_fish: 0 } : {}),
    });

    base44.entities.HarvestRecord.filter({ pond_cycle_id: cycle.id }, '-harvest_date', 500).then(setRecords);
    onUpdate();
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {isWithdrawal && (
        <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-700 font-semibold">Không thể thu hoạch — Đang trong thời gian ngưng thuốc!</p>
        </div>
      )}

      {lastHarvestSummary?.lastDate && (
        <div className="bg-slate-50 border border-border rounded-lg p-3 text-xs space-y-0.5">
          <p className="font-semibold text-muted-foreground uppercase tracking-wide">Theo các phiếu đã nhập trong chu kỳ</p>
          <p>
            <span className="text-muted-foreground">Ngày thu TT gần nhất:</span>{' '}
            <strong className="text-foreground">{lastHarvestSummary.lastDate}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Tổng lũy kế thực thu:</span>{' '}
            <strong className="text-foreground">{lastHarvestSummary.totalKg.toLocaleString()} kg</strong>
          </p>
        </div>
      )}

      {/* Lot code */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
        <Package className="w-5 h-5 text-primary flex-shrink-0" />
        <div>
          <p className="text-xs text-primary/70 font-medium">Mã lô truy xuất nguồn gốc</p>
          <p className="font-bold text-primary text-sm font-mono">{lotCode}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày thu hoạch</Label>
          <Input type="date" value={form.harvest_date} onChange={e => setForm({ ...form, harvest_date: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sản lượng thực thu (kg)</Label>
          <Input type="number" value={form.actual_yield} onChange={e => setForm({ ...form, actual_yield: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Số cá thu (con)</Label>
          <Input type="number" value={form.fish_count_harvested} onChange={e => setForm({ ...form, fish_count_harvested: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">TL TB lúc thu (g)</Label>
          <Input type="number" value={form.avg_weight_harvest} onChange={e => setForm({ ...form, avg_weight_harvest: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cá chết (kg)</Label>
          <Input type="number" value={form.dead_fish_count} onChange={e => setForm({ ...form, dead_fish_count: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cá phế phẩm (kg)</Label>
          <Input type="number" value={form.reject_fish_count} onChange={e => setForm({ ...form, reject_fish_count: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cá vàng thịt/bệnh (kg)</Label>
          <Input type="number" value={form.sick_yellow_fish} onChange={e => setForm({ ...form, sick_yellow_fish: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cá gầy &lt;42% phi-lê (kg)</Label>
          <Input type="number" value={form.thin_fish} onChange={e => setForm({ ...form, thin_fish: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tỷ lệ dạ dày (%)</Label>
          <Input type="number" value={form.stomach_ratio} onChange={e => setForm({ ...form, stomach_ratio: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giá thu mua (đ/kg)</Label>
          <Input type="number" value={form.price_per_kg} onChange={e => setForm({ ...form, price_per_kg: e.target.value })} className="mt-1" />
        </div>
      </div>

      {totalValue && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-xs text-green-600 font-medium">Tổng giá trị lô hàng</p>
          <p className="text-xl font-bold text-green-700">{totalValue} đ</p>
        </div>
      )}

      {/* Quality Checklist */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Kiểm tra chất lượng</p>
        </div>
        <div className="space-y-1">
          <CheckItem label="Chất lượng nước/bùn đạt tiêu chuẩn" checked={form.water_quality_ok} onChange={v => setForm({ ...form, water_quality_ok: v })} />
          <CheckItem label="Dư lượng kháng sinh trong ngưỡng cho phép" checked={form.antibiotic_residue_ok} onChange={v => setForm({ ...form, antibiotic_residue_ok: v })} />
          <CheckItem label="Kim loại nặng không phát hiện" checked={form.heavy_metal_ok} onChange={v => setForm({ ...form, heavy_metal_ok: v })} />
          <CheckItem label="Thuốc trừ sâu không phát hiện" checked={form.pesticide_ok} onChange={v => setForm({ ...form, pesticide_ok: v })} />
        </div>
      </div>

      {/* Auto-suggested action */}
      {qualityIssues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">⚠️ Phát hiện vấn đề chất lượng</p>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
            {qualityIssues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-xs text-amber-600">Đề xuất xử lý:</p>
            <button
              onClick={() => setForm({ ...form, action_taken: suggestedAction })}
              className="text-xs font-semibold px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition-colors"
            >
              Áp dụng: {suggestedAction === 'deduct_weight' ? '⚖️ Trừ KL' : suggestedAction === 'deduct_price' ? '💸 Trừ giá' : '❌ Từ chối'}
            </button>
          </div>
        </div>
      )}
      {failedChecks && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 font-medium">
          ❌ Chưa đủ điều kiện: dư lượng kháng sinh / kim loại nặng / thuốc trừ sâu chưa đạt
        </div>
      )}

      {/* Action */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phương án xử lý</Label>
        <Select value={form.action_taken} onValueChange={v => setForm({ ...form, action_taken: v })} items={HARVEST_ACTION_ITEMS}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HARVEST_ACTION_ITEMS.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Textarea
        placeholder="Ghi chú..."
        value={form.notes}
        onChange={e => setForm({ ...form, notes: e.target.value })}
        className="h-16 text-sm"
      />

      <Button onClick={handleSave} disabled={saving || isWithdrawal} className="w-full bg-primary text-white">
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Đang lưu...' : 'Ghi nhận thu hoạch'}
      </Button>

      {records.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lịch sử thu hoạch</p>
          {records.map(r => (
            <div key={r.id} className="border border-border rounded-lg p-3 mb-2 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">{r.harvest_date}</span>
                <span className="text-primary font-bold">{r.actual_yield?.toLocaleString()} kg</span>
              </div>
              <div className="text-muted-foreground mt-1 font-mono">{r.lot_code}</div>
              <div className="flex gap-3 mt-1">
                {r.planned_yield && <span>KH: {r.planned_yield?.toLocaleString()} kg</span>}
                <span className={Number(r.actual_yield) >= Number(r.planned_yield) ? 'text-green-600' : 'text-red-500'}>
                  {r.planned_yield ? `${Math.round((r.actual_yield / r.planned_yield) * 100)}% kế hoạch` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}