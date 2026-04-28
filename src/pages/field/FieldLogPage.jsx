import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, differenceInDays, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { submitPondLogEntry } from '@/lib/pondLogSubmit';
import { POND_LOG_ENV_RANGES, pondLogEnvOutOfRange } from '@/lib/pondLogEnvRanges';
import { useAuth } from '@/lib/AuthContext';
import { pickActiveCycle } from '@/lib/pondCycleHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PondStatusBadge from '@/components/ponds/PondStatusBadge';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react';

const MAIN_ENV_KEYS = ['ph', 'temperature', 'do'];
const EXTRA_ENV_KEYS = ['nh3', 'no2', 'h2s'];

const emptyForm = () => ({
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
  medicine_used: '',
  medicine_dosage: '',
  withdrawal_days: '',
  disease_notes: '',
  avg_weight: '',
  notes: '',
});

function EnvField({ fieldKey, onChange, form }) {
  const cfg = POND_LOG_ENV_RANGES[fieldKey];
  const bad = pondLogEnvOutOfRange(fieldKey, form[fieldKey]);
  return (
    <div>
      <Label className="text-stone-800 text-sm font-semibold">
        {cfg.label}
        <span className="text-stone-500 font-normal text-xs ml-1">
          [{cfg.min}–{cfg.max}]
        </span>
      </Label>
      <Input
        type="number"
        step="0.01"
        inputMode="decimal"
        value={form[fieldKey]}
        onChange={(e) => onChange({ ...form, [fieldKey]: e.target.value })}
        className={`mt-1.5 h-12 text-base border-stone-300 bg-white text-stone-900 ${bad ? 'border-red-400 bg-red-50' : ''}`}
        placeholder="—"
      />
      {bad && (
        <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Ngoài ngưỡng gợi ý
        </p>
      )}
    </div>
  );
}

function SectionToggle({ open, onToggle, label, subtitle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-left hover:bg-stone-100/90 transition-colors"
    >
      <div>
        <p className="text-sm font-bold text-stone-900">{label}</p>
        {subtitle ? <p className="text-xs text-stone-600 mt-0.5">{subtitle}</p> : null}
      </div>
      {open ? <ChevronUp className="w-5 h-5 text-stone-600 shrink-0" /> : <ChevronDown className="w-5 h-5 text-stone-600 shrink-0" />}
    </button>
  );
}

export default function FieldLogPage() {
  const { harvestAlertDays } = useAuth();
  const [params] = useSearchParams();
  const pondId = params.get('pond');

  const [pond, setPond] = useState(null);
  const [fieldCycleId, setFieldCycleId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExtraEnv, setShowExtraEnv] = useState(false);
  const [showMedicine, setShowMedicine] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadLogs = async (cycleId) => {
    if (!cycleId) {
      setLogs([]);
      return;
    }
    const data = await base44.entities.PondLog.filter({ pond_cycle_id: cycleId }, '-log_date', 80);
    setLogs(data || []);
  };

  useEffect(() => {
    if (!pondId) {
      setLoading(false);
      setPond(null);
      setLogs([]);
      setFieldCycleId('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    base44.entities.Pond
      .getWithCycles(pondId)
      .then((p) => {
        if (cancelled) return;
        setPond(p || null);
        const cycles = p?.pond_cycles || [];
        const def = pickActiveCycle(cycles)?.id || cycles[0]?.id || '';
        setFieldCycleId((prev) => {
          if (prev && cycles.some((c) => c.id === prev)) return prev;
          return def;
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Không tải được ao');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pondId]);

  useEffect(() => {
    if (!fieldCycleId) {
      setLogs([]);
      return;
    }
    void loadLogs(fieldCycleId).catch(() => {});
  }, [fieldCycleId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!pond) return;
    const cycle = pond.pond_cycles?.find((c) => c.id === fieldCycleId) || pickActiveCycle(pond.pond_cycles);
    if (!cycle?.id) {
      toast.error('Chưa có chu kỳ nuôi — tạo chu kỳ trên trang quản lý ao');
      return;
    }
    if (!form.log_date) {
      toast.error('Chọn ngày');
      return;
    }
    setSaving(true);
    try {
      await submitPondLogEntry({ pond, cycle, form });
      toast.success('Đã lưu nhật ký');
      const refreshed = await base44.entities.Pond.getWithCycles(pond.id);
      if (refreshed) setPond(refreshed);
      await loadLogs(cycle.id);
      setForm((f) => ({
        ...emptyForm(),
        log_date: f.log_date,
      }));
    } catch (err) {
      toast.error(err?.message || 'Không lưu được');
    }
    setSaving(false);
  };

  if (!pondId) {
    return (
      <div className="text-center py-14 space-y-4 px-2">
        <p className="text-stone-800 text-base leading-relaxed">Chọn ao ở trang chủ hoặc quét mã QR trên ao.</p>
        <Button asChild variant="outline" className="h-12 text-base border-stone-300">
          <Link to="/field">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <p className="text-center text-stone-800 py-14 text-base font-medium">Đang tải thông tin ao…</p>;
  }

  if (!pond) {
    return (
      <div className="text-center py-14 space-y-4 px-2">
        <p className="text-stone-800 text-base">Không tìm thấy ao hoặc bạn chưa được phép xem.</p>
        <Button asChild variant="outline" className="h-12 text-base border-stone-300">
          <Link to="/field">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  const cycle =
    pond.pond_cycles?.find((c) => c.id === fieldCycleId) || pickActiveCycle(pond.pond_cycles) || null;

  if (!cycle) {
    return (
      <div className="text-center py-14 space-y-4 px-2">
        <p className="text-stone-800 text-base">Ao chưa có chu kỳ thả. Vào trang quản lý ao để tạo chu kỳ trước khi nhập nhật ký.</p>
        <Button asChild variant="outline" className="h-12 text-base border-stone-300">
          <Link to="/field">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  const today = new Date();
  const harvestDiff = cycle.expected_harvest_date
    ? differenceInDays(parseISO(cycle.expected_harvest_date), today)
    : null;
  const harvestUrgent = harvestDiff !== null && harvestDiff <= (harvestAlertDays ?? 7);
  const harvestOverdue = harvestDiff !== null && harvestDiff < 0;
  const inWithdrawal =
    cycle.withdrawal_end_date && differenceInDays(parseISO(cycle.withdrawal_end_date), today) >= 0;

  return (
    <div className="space-y-5 pb-8">
      <Link
        to="/field"
        className="inline-flex items-center gap-0.5 text-base font-semibold text-teal-800 hover:text-teal-950"
      >
        <ChevronLeft className="w-5 h-5" />
        Trang chủ
      </Link>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Nhật ký cho ao</p>
            <p className="text-xl font-bold text-stone-950 mt-0.5">{pond.code}</p>
            <p className="text-sm text-stone-700 mt-0.5">{pond.owner_name || '—'}</p>
          </div>
          <PondStatusBadge status={cycle.status} />
        </div>

        {(pond.pond_cycles?.length || 0) > 1 && (
          <div>
            <Label className="text-xs font-semibold text-stone-600">Chu kỳ ghi nhật ký</Label>
            <select
              value={fieldCycleId}
              onChange={(e) => setFieldCycleId(e.target.value)}
              className="mt-1 w-full h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-900"
            >
              {pond.pond_cycles.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.stock_date ? `Thả ${c.stock_date}` : `Chu kỳ ${i + 1}`} · {c.status}
                  {c.expected_yield != null ? ` · ~${c.expected_yield} kg` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {inWithdrawal && (
          <p className="text-xs font-semibold text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            Đang trong thời gian cách ly thuốc — kiểm tra ngày kết thúc trước khi thu hoạch.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-2 py-2.5">
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Diện tích</p>
            <p className="text-sm font-bold text-stone-900 mt-0.5">{pond.area != null ? `${pond.area} m²` : '—'}</p>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-2 py-2.5">
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Số cá</p>
            <p className="text-sm font-bold text-stone-900 mt-0.5">
              {cycle.current_fish != null ? cycle.current_fish.toLocaleString() : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-2 py-2.5 col-span-2 sm:col-span-1">
            <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">SL dự kiến</p>
            <p className="text-sm font-bold text-stone-900 mt-0.5">
              {cycle.expected_yield != null ? `${cycle.expected_yield.toLocaleString()} kg` : '—'}
            </p>
          </div>
        </div>

        <dl className="grid gap-1.5 text-sm border-t border-stone-100 pt-3">
          <div className="flex justify-between gap-2">
            <dt className="text-stone-600">Đại lý</dt>
            <dd className="font-semibold text-stone-900 text-right">{pond.agency_code || '—'}</dd>
          </div>
          {pond.location ? (
            <div className="flex justify-between gap-2">
              <dt className="text-stone-600">Địa điểm</dt>
              <dd className="font-medium text-stone-900 text-right leading-snug">{pond.location}</dd>
            </div>
          ) : null}
          {cycle.stock_date ? (
            <div className="flex justify-between gap-2">
              <dt className="text-stone-600">Ngày thả</dt>
              <dd className="font-semibold text-stone-900">{cycle.stock_date}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-2 items-center">
            <dt className="text-stone-600">Thu dự kiến</dt>
            <dd
              className={`font-semibold text-right ${
                harvestOverdue ? 'text-red-600' : harvestUrgent ? 'text-amber-700' : 'text-stone-900'
              }`}
            >
              {cycle.expected_harvest_date || '—'}
              {harvestOverdue && ' (quá hạn)'}
              {harvestUrgent && !harvestOverdue && ' (sắp tới)'}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-stone-600">Lũy kế thức ăn</dt>
            <dd className="font-semibold text-stone-900">
              {cycle.total_feed_used != null ? `${cycle.total_feed_used.toLocaleString()} kg` : '—'}
            </dd>
          </div>
          {cycle.fcr != null ? (
            <div className="flex justify-between gap-2">
              <dt className="text-stone-600">FCR</dt>
              <dd
                className={`font-bold ${
                  cycle.fcr <= 1.3 ? 'text-green-700' : cycle.fcr <= 1.6 ? 'text-amber-700' : 'text-red-700'
                }`}
              >
                {cycle.fcr}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-4">
          <p className="text-xs font-bold text-stone-600 uppercase tracking-wide">Chỉ số môi trường</p>
          <div>
            <Label className="text-stone-800 text-sm font-semibold">Ngày ghi</Label>
            <Input
              type="date"
              required
              value={form.log_date}
              onChange={(e) => setForm({ ...form, log_date: e.target.value })}
              className="mt-1.5 h-12 text-base border-stone-300 bg-white text-stone-900"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MAIN_ENV_KEYS.map((key) => (
              <EnvField key={key} fieldKey={key} onChange={setForm} form={form} />
            ))}
          </div>

          <div className="space-y-3">
            <SectionToggle
              open={showExtraEnv}
              onToggle={() => setShowExtraEnv((v) => !v)}
              label="Thêm: NH₃, NO₂, H₂S"
              subtitle="Giống màn hình quản lý — dùng khi đo đầy đủ"
            />
            {showExtraEnv && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {EXTRA_ENV_KEYS.map((key) => (
                  <EnvField key={key} fieldKey={key} onChange={setForm} form={form} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
          <p className="text-xs font-bold text-stone-600 uppercase tracking-wide">Thức ăn &amp; đàn cá</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-stone-800 text-sm font-semibold">Màu nước</Label>
              <Input
                value={form.water_color}
                onChange={(e) => setForm({ ...form, water_color: e.target.value })}
                className="mt-1.5 h-12 text-base border-stone-300"
                placeholder="VD: xanh lá, nâu…"
              />
            </div>
            <div>
              <Label className="text-stone-800 text-sm font-semibold">Mã thức ăn</Label>
              <Input
                value={form.feed_code}
                onChange={(e) => setForm({ ...form, feed_code: e.target.value })}
                className="mt-1.5 h-12 text-base border-stone-300"
                placeholder="VD: TA-501"
              />
            </div>
            <div>
              <Label className="text-stone-800 text-sm font-semibold">Lượng thức ăn (kg)</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.feed_amount}
                onChange={(e) => setForm({ ...form, feed_amount: e.target.value })}
                className="mt-1.5 h-12 text-base border-stone-300"
                placeholder="—"
              />
            </div>
            <div>
              <Label className="text-stone-800 text-sm font-semibold text-red-700">Cá chết / hao hụt (con)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.dead_fish}
                onChange={(e) => setForm({ ...form, dead_fish: e.target.value })}
                className="mt-1.5 h-12 text-base border-red-100"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-stone-800 text-sm font-semibold">Trọng lượng TB ước tính (g/con)</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.avg_weight}
                onChange={(e) => setForm({ ...form, avg_weight: e.target.value })}
                className="mt-1.5 h-12 text-base border-stone-300"
                placeholder="—"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SectionToggle
            open={showMedicine}
            onToggle={() => setShowMedicine((v) => !v)}
            label="Thuốc &amp; xử lý bệnh"
            subtitle="Tên thuốc, liều, ngày cách ly, ghi chú bệnh"
          />
          {showMedicine && (
            <div className="rounded-2xl border border-orange-200/80 bg-orange-50/40 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-stone-800 text-sm font-semibold">Tên thuốc / sản phẩm</Label>
                  <Input
                    value={form.medicine_used}
                    onChange={(e) => setForm({ ...form, medicine_used: e.target.value })}
                    className="mt-1.5 h-12 text-base border-stone-300 bg-white"
                    placeholder="Để trống nếu không dùng"
                  />
                </div>
                <div>
                  <Label className="text-stone-800 text-sm font-semibold">Liều lượng</Label>
                  <Input
                    value={form.medicine_dosage}
                    onChange={(e) => setForm({ ...form, medicine_dosage: e.target.value })}
                    className="mt-1.5 h-12 text-base border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-stone-800 text-sm font-semibold">Thời gian cách ly (ngày)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.withdrawal_days}
                    onChange={(e) => setForm({ ...form, withdrawal_days: e.target.value })}
                    className="mt-1.5 h-12 text-base border-stone-300 bg-white"
                    placeholder="VD: 14"
                  />
                </div>
              </div>
              <div>
                <Label className="text-stone-800 text-sm font-semibold">Nhật ký xử lý bệnh</Label>
                <Textarea
                  value={form.disease_notes}
                  onChange={(e) => setForm({ ...form, disease_notes: e.target.value })}
                  rows={3}
                  className="mt-1.5 text-base border-stone-300 bg-white min-h-[5rem]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <Label className="text-stone-800 text-sm font-semibold">Ghi chú thêm</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="mt-1.5 text-base border-stone-300 bg-white min-h-[5rem]"
            placeholder="Tình hình ăn, bọt, khí quyển…"
          />
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-14 text-lg font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md"
        >
          {saving ? 'Đang lưu…' : 'Lưu nhật ký'}
        </Button>
      </form>

      {logs.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
          >
            <span className="text-sm font-bold text-stone-900">Lịch sử gần đây ({logs.length} bản ghi)</span>
            {showHistory ? <ChevronUp className="w-5 h-5 text-stone-600" /> : <ChevronDown className="w-5 h-5 text-stone-600" />}
          </button>
          {showHistory && (
            <ul className="border-t border-stone-100 divide-y divide-stone-100 max-h-[22rem] overflow-y-auto px-2 py-2">
              {logs.slice(0, 25).map((log) => (
                <li key={log.id} className="px-2 py-3 text-sm">
                  <div className="flex justify-between gap-2 font-semibold text-stone-900">
                    <span>{log.log_date}</span>
                    <span className="text-stone-600 font-normal text-xs shrink-0">
                      {log.feed_amount != null && log.feed_amount !== '' && `${log.feed_amount} kg TA`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-stone-600">
                    {log.ph != null && (
                      <span className={pondLogEnvOutOfRange('ph', log.ph) ? 'text-red-600 font-semibold' : ''}>
                        pH {log.ph}
                      </span>
                    )}
                    {log.temperature != null && (
                      <span
                        className={
                          pondLogEnvOutOfRange('temperature', log.temperature) ? 'text-red-600 font-semibold' : ''
                        }
                      >
                        {log.temperature}°C
                      </span>
                    )}
                    {log.do != null && <span>DO {log.do}</span>}
                    {log.water_color && <span>Màu: {log.water_color}</span>}
                  </div>
                  {log.dead_fish > 0 && <p className="text-xs text-red-600 font-medium mt-1">−{log.dead_fish} con</p>}
                  {log.medicine_used && (
                    <p className="text-xs text-orange-700 mt-1">
                      Thuốc: {log.medicine_used}
                      {log.withdrawal_days != null && ` · ${log.withdrawal_days} ngày CL`}
                    </p>
                  )}
                  {log.notes && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{log.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
