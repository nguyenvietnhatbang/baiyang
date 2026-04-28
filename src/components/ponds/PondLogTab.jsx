import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, ChevronDown, ChevronUp, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { submitPondLogEntry } from '@/lib/pondLogSubmit';
import { POND_LOG_ENV_RANGES, pondLogEnvOutOfRange } from '@/lib/pondLogEnvRanges';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function isAlert(key, value) {
  return pondLogEnvOutOfRange(key, value);
}

export default function PondLogTab({ pond, cycle, onUpdate }) {
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState([]);
  const [feedDateFrom, setFeedDateFrom] = useState('');
  const [feedDateTo, setFeedDateTo] = useState('');
  const [sumRpcRange, setSumRpcRange] = useState(null);
  const [form, setForm] = useState({
    log_date: format(new Date(), 'yyyy-MM-dd'),
    ph: '', temperature: '', do: '', nh3: '', no2: '', h2s: '',
    water_color: '', feed_code: '', feed_amount: '',
    dead_fish: 0, medicine_used: '', medicine_dosage: '',
    withdrawal_days: '', disease_notes: '', avg_weight: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const loadLogs = async () => {
    if (!cycle?.id) {
      setLogs([]);
      return;
    }
    const data = await base44.entities.PondLog.filter({ pond_cycle_id: cycle.id }, '-log_date', 500);
    setLogs(data);
  };

  useEffect(() => {
    void loadLogs();
  }, [pond.id, cycle?.id]);

  useEffect(() => {
    if (!feedDateFrom || !feedDateTo || !cycle?.id) {
      setSumRpcRange(null);
      return;
    }
    let cancelled = false;
    base44
      .rpc('sum_pond_cycle_feed', { p_pond_cycle_id: cycle.id, p_from: feedDateFrom, p_to: feedDateTo })
      .then((v) => {
        if (!cancelled) setSumRpcRange(Number(v));
      })
      .catch(() => {
        if (!cancelled) setSumRpcRange(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cycle?.id, feedDateFrom, feedDateTo]);

  const filteredLogs = logs.filter((l) => {
    if (feedDateFrom && l.log_date < feedDateFrom) return false;
    if (feedDateTo && l.log_date > feedDateTo) return false;
    return true;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await submitPondLogEntry({ pond, cycle, form });
      onUpdate();
      loadLogs();
      setForm((f) => ({
        ...f,
        dead_fish: 0,
        feed_amount: '',
        medicine_used: '',
        medicine_dosage: '',
        withdrawal_days: '',
      }));
    } finally {
      setSaving(false);
    }
  };

  const chartData = [...filteredLogs].reverse().slice(-14).map(l => ({
    date: l.log_date.slice(5),
    pH: l.ph,
    'Nhiệt độ': l.temperature,
    DO: l.do,
  }));

  return (
    <div className="space-y-5">
      <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lọc &amp; lũy kế thức ăn</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-[10px] text-muted-foreground">Từ ngày</Label>
            <Input type="date" className="h-8 text-xs mt-0.5" value={feedDateFrom} onChange={(e) => setFeedDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Đến ngày</Label>
            <Input type="date" className="h-8 text-xs mt-0.5" value={feedDateTo} onChange={(e) => setFeedDateTo(e.target.value)} />
          </div>
        </div>
        <div className="text-xs text-foreground space-y-0.5">
          {feedDateFrom && feedDateTo && sumRpcRange != null && (
            <p><span className="text-muted-foreground">Tổng TA trong khoảng (SQL):</span> <strong>{sumRpcRange.toLocaleString()} kg</strong></p>
          )}
          <p><span className="text-muted-foreground">Lũy kế toàn ao (hệ thống):</span> <strong>{(pond.total_feed_used || 0).toLocaleString()} kg</strong></p>
          <p className="text-muted-foreground">FCR trên ao cập nhật theo tổng TA / tổng thu hoạch thực tế (sau khi có bản ghi thu hoạch).</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(POND_LOG_ENV_RANGES).map(([key, cfg]) => (
          <div key={key}>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {cfg.label}
              <span className="text-muted-foreground/60 normal-case font-normal ml-1">
                [{cfg.min}–{cfg.max}]
              </span>
            </Label>
            <Input
              type="number"
              step="0.01"
              value={form[key]}
              onChange={e => setForm({...form, [key]: e.target.value})}
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Màu nước</Label>
          <Input value={form.water_color} onChange={e => setForm({...form, water_color: e.target.value})} className="mt-1" placeholder="VD: xanh lá, nâu..." />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ghi</Label>
          <Input type="date" value={form.log_date} onChange={e => setForm({...form, log_date: e.target.value})} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mã thức ăn</Label>
          <Input value={form.feed_code} onChange={e => setForm({...form, feed_code: e.target.value})} className="mt-1" placeholder="VD: TA-501" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lượng thức ăn (kg)</Label>
          <Input type="number" value={form.feed_amount} onChange={e => setForm({...form, feed_amount: e.target.value})} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-red-600">Số cá hao hụt (con)</Label>
          <Input type="number" value={form.dead_fish} onChange={e => setForm({...form, dead_fish: e.target.value})} className="mt-1 border-red-200" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trọng lượng TB ước tính (g)</Label>
          <Input type="number" value={form.avg_weight} onChange={e => setForm({...form, avg_weight: e.target.value})} className="mt-1" />
        </div>
      </div>

      <div className="border-t border-dashed border-orange-200 pt-4">
        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-3">Thuốc & Xử lý bệnh</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tên thuốc/Sản phẩm</Label>
            <Input value={form.medicine_used} onChange={e => setForm({...form, medicine_used: e.target.value})} className="mt-1" placeholder="Để trống nếu không dùng" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Liều lượng</Label>
            <Input value={form.medicine_dosage} onChange={e => setForm({...form, medicine_dosage: e.target.value})} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ngày ngưng thuốc (ngày)</Label>
            <Input type="number" value={form.withdrawal_days} onChange={e => setForm({...form, withdrawal_days: e.target.value})} className="mt-1" placeholder="VD: 14" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nhật ký xử lý bệnh</Label>
            <Textarea value={form.disease_notes} onChange={e => setForm({...form, disease_notes: e.target.value})} className="mt-1 h-16 text-sm" />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-primary text-white">
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Đang lưu...' : 'Lưu nhật ký'}
      </Button>

      {/* History */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Lịch sử nhật ký ({filteredLogs.length}/{logs.length} bản ghi)
        </span>
        {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showHistory && (
        <div className="space-y-4">
          {chartData.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Biểu đồ môi trường 14 ngày</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="pH" stroke="hsl(213,65%,45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Nhiệt độ" stroke="hsl(38,85%,55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="DO" stroke="hsl(145,55%,42%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-2">
            {filteredLogs.map(log => (
              <div key={log.id} className="bg-muted/50 rounded-lg p-3 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-foreground">{log.log_date}</span>
                  {log.dead_fish > 0 && <span className="text-red-500 font-medium">-{log.dead_fish} con</span>}
                  {log.feed_amount && <span className="text-blue-600">TA: {log.feed_amount}kg</span>}
                </div>
                {(log.ph || log.temperature || log.do) && (
                  <div className="flex gap-3 text-muted-foreground">
                    {log.ph && <span className={`${isAlert('ph', log.ph) ? 'text-red-500 font-bold' : ''}`}>pH: {log.ph}</span>}
                    {log.temperature && <span className={`${isAlert('temperature', log.temperature) ? 'text-red-500 font-bold' : ''}`}>T°: {log.temperature}</span>}
                    {log.do && <span>DO: {log.do}</span>}
                    {log.water_color && <span>Màu: {log.water_color}</span>}
                  </div>
                )}
                {log.medicine_used && (
                  <div className="mt-1 text-orange-600 font-medium">💊 {log.medicine_used} — {log.withdrawal_days} ngày ngưng</div>
                )}
                {log.disease_notes && <p className="mt-1 text-muted-foreground">{log.disease_notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}