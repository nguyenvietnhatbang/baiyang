import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, ChevronDown, ChevronUp, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { submitPondLogEntry } from '@/lib/pondLogSubmit';
import { POND_LOG_ENV_RANGES, pondLogEnvOutOfRange } from '@/lib/pondLogEnvRanges';

function isAlert(key, value) {
  return pondLogEnvOutOfRange(key, value);
}

export default function PondLogTab({ pond, cycle, onUpdate }) {
  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState([]);
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

  const filteredLogs = logs;

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

  return (
    <div className="space-y-5 pt-2">

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
          <Select value={form.water_color} onValueChange={(v) => setForm({ ...form, water_color: v })}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Chọn màu nước..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Xanh lá">Xanh lá</SelectItem>
              <SelectItem value="Xanh trà">Xanh trà</SelectItem>
              <SelectItem value="Nâu">Nâu</SelectItem>
              <SelectItem value="Nâu đỏ">Nâu đỏ</SelectItem>
              <SelectItem value="Vàng nhạt">Vàng nhạt</SelectItem>
              <SelectItem value="Trong">Trong</SelectItem>
            </SelectContent>
          </Select>
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